import "server-only";
// Xodimlar oyligi: foiz × tushum (o'qituvchi — o'z o'quvchilari to'lovlaridan, administrator — butun markazdan),
// shu oy uchun olingan oylik va avanslar ayiriladi. Hisob "qaysi oy uchun" to'langan pullar bo'yicha (hozirgidek).
import mongoose from "mongoose";
import { cache } from "react";
import { connectDB } from "./db";
import { LIVE, loadStudents } from "./ledger";
import { Payment, Salary } from "./models";
import { shareHistoryOf, type StaffLean } from "./staff";
import { payOf, staffPercent } from "./staff-rules";

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
  percent: number;
  /** Foiz olinadigan summa: o'z o'quvchilari yoki butun markaz tushumi */
  base: number;
  share: number;
  taken: number;
  left: number;
};

/** Shu oy uchun tushum: jami va o'qituvchilar bo'yicha (o'qituvchisi yo'q o'quvchilar — "unassigned"). */
export const monthCollections = cache(async (month: string) => {
  await connectDB();
  const [students, agg] = await Promise.all([
    loadStudents(),
    Payment.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
      { $match: { ...LIVE, month } },
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
  const base = staff.shareBase === "center" ? collections.total : (collections.byTeacher.get(id) ?? 0);
  const taken = (salaries.get(id) ?? []).reduce((s, x) => s + x.amount, 0);
  return { staffId: id, ...payOf(base, staffPercent(shareHistoryOf(staff), month), taken) };
}
