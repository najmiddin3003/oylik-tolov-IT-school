import "server-only";
// Xodimlar oyligi: o'qituvchi — o'z o'quvchilari to'lovlaridan foiz, rahbar — butun markaz tushumidan foiz,
// administrator — belgilangan oylik (har oy bir xil summa). Shu oy uchun olingan oylik va avanslar ayiriladi.
// Foizli oylik oy «oylik olindi» deb yozilguncha yopilmaydi — qaysi to'lov qaysi oyga, lib/salary-cycle.ts da.
import mongoose from "mongoose";
import { cache } from "react";
import { connectDB } from "./db";
import { LIVE, loadStudents } from "./ledger";
import { Payment, Salary } from "./models";
import { SALARY_CYCLE_FROM, salaryCycles, type CycleClose, type CyclePayment, type SalaryCycles } from "./salary-cycle";
import { salaryHistoryOf, shareHistoryOf, type StaffLean } from "./staff";
import { fixedPayOf, payKindOf, payOf, staffPercent, staffSalary, type PayKind } from "./staff-rules";
import { isoToDate, shiftMonth } from "./time";

export type SalaryRow = {
  id: string;
  kind: "oylik" | "avans";
  amount: number;
  date: string;
  month: string;
  note: string;
  /** Xodimning o'zi yozgan («Olingan avans/oylik» bo'limida) */
  selfReported: boolean;
};

type SalaryLean = {
  _id: unknown;
  kind: string;
  amount: number;
  date: Date;
  month: string;
  note?: string | null;
  selfReported?: boolean | null;
};

export function toSalaryRow(x: SalaryLean): SalaryRow {
  return {
    id: String(x._id),
    kind: x.kind === "avans" ? "avans" : "oylik",
    amount: x.amount,
    date: x.date.toISOString(),
    month: x.month,
    note: x.note ?? "",
    selfReported: Boolean(x.selfReported),
  };
}

export type StaffPay = {
  staffId: string;
  /** Oylik turi: tushumdan foiz yoki belgilangan summa (administrator) */
  kind: PayKind;
  /** Foiz (belgilangan oylikda — 0) */
  percent: number;
  /** Foiz olinadigan summa: o'z o'quvchilari yoki butun markaz tushumi (belgilangan oylikda — 0) */
  base: number;
  /** Shu oy uchun oylik */
  share: number;
  taken: number;
  left: number;
  /**
   * Oylik davri (foizli oylikda, SALARY_CYCLE_FROM dan boshlab; aks holda null): shu oy yopilgan kun («oylik» olingan) va
   * hozir tushgan to'lovlar qaysi oy oyligiga qo'shilayotgani.
   */
  cycle: { closedOn: string | null; current: string } | null;
};

/**
 * Shu oyda tushgan pul (kalendar bo'yicha): jami va o'qituvchilar bo'yicha (o'qituvchisi yo'q o'quvchilar — "unassigned").
 * `salaryMonthOf` qoidasi: shu oyda olingan pul (o'tgan oylar qarzi uchun ham) va shu oy uchun oldinroq olingan pul;
 * shu oy uchun keyinroq olingani — olingan oyiga, keyingi oylar uchun oldindan to'lov — o'sha oyga.
 * Foizli oylik SALARY_CYCLE_FROM gacha shu bo'yicha, undan keyin — oylik davri bo'yicha (`staffCycles`).
 */
export const monthCollections = cache(async (month: string) => {
  await connectDB();
  const start = isoToDate(`${month}-01`)!;
  const next = isoToDate(`${shiftMonth(month, 1)}-01`)!;
  const [students, agg] = await Promise.all([
    loadStudents(),
    Payment.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
      {
        $match: {
          ...LIVE,
          $or: [
            // Shu oy uchun — shu oy oxirigacha olingan
            { month, paidAt: { $lt: next } },
            // O'tgan oylar uchun — shu oyda olingan
            { month: { $lt: month }, paidAt: { $gte: start, $lt: next } },
          ],
        },
      },
      { $group: { _id: "$student", total: { $sum: "$amount" } } },
    ]),
  ]);
  const teacherOf = new Map(students.map((s) => [String(s._id), s.teacher ? String(s.teacher) : ""]));
  const byTeacher = new Map<string, number>();
  let total = 0;
  let unassigned = 0;
  for (const a of agg) {
    total += a.total;
    const t = teacherOf.get(String(a._id)) ?? "";
    if (t) byTeacher.set(t, (byTeacher.get(t) ?? 0) + a.total);
    else unassigned += a.total;
  }
  return { total, byTeacher, unassigned };
});

/** Shu oy uchun olingan oylik va avanslar (xodim bo'yicha). */
export const monthSalaries = cache(async (month: string) => {
  await connectDB();
  const docs = await Salary.find({ month }).sort({ date: -1, createdAt: -1 }).lean();
  const byStaff = new Map<string, SalaryRow[]>();
  for (const x of docs) {
    const key = x.staff ? String(x.staff) : "";
    byStaff.set(key, [...(byStaff.get(key) ?? []), toSalaryRow(x)]);
  }
  return byStaff;
});

/** Oylik davri uchun: SALARY_CYCLE_FROM dan beri tushgan to'lovlar (o'qituvchilar bo'yicha) va xodimlarning «oylik» yozuvlari. */
const cycleInput = cache(async () => {
  await connectDB();
  const start = isoToDate(`${SALARY_CYCLE_FROM}-01`)!;
  const [students, payments, closes] = await Promise.all([
    loadStudents(),
    Payment.find({ ...LIVE, $or: [{ month: { $gte: SALARY_CYCLE_FROM } }, { paidAt: { $gte: start } }] }, { student: 1, month: 1, amount: 1, paidAt: 1, createdAt: 1 }).lean(),
    Salary.find({ kind: "oylik", staff: { $ne: null }, month: { $gte: SALARY_CYCLE_FROM } }, { staff: 1, month: 1, date: 1, createdAt: 1 }).lean(),
  ]);
  const teacherOf = new Map(students.map((s) => [String(s._id), s.teacher ? String(s.teacher) : ""]));
  const all: CyclePayment[] = [];
  const byTeacher = new Map<string, CyclePayment[]>();
  for (const p of payments) {
    const row: CyclePayment = { month: p.month, amount: p.amount, paidAt: p.paidAt, createdAt: p.createdAt };
    all.push(row);
    const t = teacherOf.get(String(p.student)) ?? "";
    if (!t) continue;
    const list = byTeacher.get(t);
    if (list) list.push(row);
    else byTeacher.set(t, [row]);
  }
  const closesByStaff = new Map<string, CycleClose[]>();
  for (const x of closes) {
    const key = String(x.staff);
    const row: CycleClose = { month: x.month, date: x.date, createdAt: x.createdAt };
    const list = closesByStaff.get(key);
    if (list) list.push(row);
    else closesByStaff.set(key, [row]);
  }
  return { all, byTeacher, closesByStaff };
});

/** Xodimning oylik davri: qaysi oy oyligiga qancha to'lov, qaysi oylar yopilgan, hozir qaysi oy ochiq. */
const staffCycles = cache(async (staffId: string, center: boolean): Promise<SalaryCycles> => {
  const { all, byTeacher, closesByStaff } = await cycleInput();
  return salaryCycles(center ? all : (byTeacher.get(staffId) ?? []), closesByStaff.get(staffId) ?? [], new Date());
});

export async function staffPay(staff: StaffLean, month: string): Promise<StaffPay> {
  const salaries = await monthSalaries(month);
  const id = String(staff._id);
  const taken = (salaries.get(id) ?? []).reduce((s, x) => s + x.amount, 0);
  if (payKindOf(staff.role) === "fixed") return { staffId: id, ...fixedPayOf(staffSalary(salaryHistoryOf(staff), month), taken), cycle: null };
  const center = staff.shareBase === "center";
  const percent = staffPercent(shareHistoryOf(staff), month);
  if (month < SALARY_CYCLE_FROM) {
    const collections = await monthCollections(month);
    const base = center ? collections.total : (collections.byTeacher.get(id) ?? 0);
    return { staffId: id, ...payOf(base, percent, taken), cycle: null };
  }
  const cycles = await staffCycles(id, center);
  // Foiz 0 bo'lsa (masalan, oylik olmaydigan rahbar) — oy holati ko'rsatilmaydi
  const cycle = percent > 0 ? { closedOn: cycles.closedOn(month), current: cycles.current } : null;
  return { staffId: id, ...payOf(cycles.bases.get(month) ?? 0, percent, taken), cycle };
}
