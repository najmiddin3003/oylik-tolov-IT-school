import "server-only";
// Xodimlar oyligi: o'qituvchi — o'z o'quvchilari to'lovlaridan foiz, rahbar — butun markaz tushumidan foiz,
// administrator — belgilangan oylik (har oy bir xil summa). Shu oy uchun olingan oylik va avanslar ayiriladi.
// Hisob "qaysi oy uchun" to'langan pullar bo'yicha (hozirgidek).
import mongoose from "mongoose";
import { cache } from "react";
import { connectDB } from "./db";
import { LIVE, loadStudents } from "./ledger";
import { Payment, Salary } from "./models";
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
};

/**
 * Shu oy oyligi uchun tushum: jami va o'qituvchilar bo'yicha (o'qituvchisi yo'q o'quvchilar — "unassigned").
 * `salaryMonthOf` qoidasi: shu oyda olingan pul (o'tgan oylar qarzi uchun ham) va shu oy uchun oldinroq olingan pul;
 * shu oy uchun keyinroq olingani — olingan oyiga, keyingi oylar uchun oldindan to'lov — o'sha oyga.
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

export async function staffPay(staff: StaffLean, month: string): Promise<StaffPay> {
  const [collections, salaries] = await Promise.all([monthCollections(month), monthSalaries(month)]);
  const id = String(staff._id);
  const taken = (salaries.get(id) ?? []).reduce((s, x) => s + x.amount, 0);
  if (payKindOf(staff.role) === "fixed") return { staffId: id, ...fixedPayOf(staffSalary(salaryHistoryOf(staff), month), taken) };
  const base = staff.shareBase === "center" ? collections.total : (collections.byTeacher.get(id) ?? 0);
  return { staffId: id, ...payOf(base, staffPercent(shareHistoryOf(staff), month), taken) };
}
