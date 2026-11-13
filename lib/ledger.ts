// To'lov holati hisoblari — avtorizatsiyasiz yadro. Sahifalar lib/data.ts orqali (kirish tekshiriladi),
// SMS cron va eksport esa shu funksiyalarni to'g'ridan-to'g'ri ishlatadi.
import mongoose from "mongoose";
import { cache } from "react";
import { applyDiscount, discountAt, isDiscountKind, type DiscountChange } from "./discounts";
import { feeFor, type FeeChange } from "./fees";
import { Payment, Student } from "./models";
import { normalizeLessons, type Lesson } from "./schedule";
import { ensureStudentSeqs } from "./seq";
import { getSettings } from "./settings";
import { compareMonths, monthOfDate } from "./time";

export type PayStatus = "paid" | "partial" | "unpaid";

/** Hisobga olinadigan (arxivlanmagan) to'lovlar. Eski hujjatlarda maydon yo'q — bu ham null deb olinadi. */
export const LIVE = { archivedAt: null };

export type StudentLean = {
  _id: mongoose.Types.ObjectId;
  seq?: number | null;
  fullName: string;
  phone?: string | null;
  group?: string | null;
  monthlyFee: number;
  feeHistory?: { from?: string | null; fee?: number | null }[] | null;
  active?: boolean | null;
  startDate: Date;
  lessons?: { day?: number | null; start?: string | null; end?: string | null }[] | null;
  /** O'qituvchisi (xodim ID) */
  teacher?: mongoose.Types.ObjectId | null;
  discountHistory?: { from?: string | null; typeId?: string | null; name?: string | null; kind?: string | null; value?: number | null }[] | null;
};

export type StudentRow = {
  id: string;
  seq: number | null;
  fullName: string;
  phone: string;
  group: string;
  /** Tanlangan oy uchun oylik to'lov (narx tarixi hisobga olingan) */
  monthlyFee: number;
  active: boolean;
  paid: number;
  debt: number;
  status: PayStatus;
  /** Tanlangan oyda o'qishni boshlaganmi */
  started: boolean;
  /** Dars jadvali (kunlar va vaqt) */
  lessons: Lesson[];
  /** O'qituvchisi (xodim ID); biriktirilmagan — null */
  teacherId: string | null;
};

export function feeHistoryOf(s: { feeHistory?: StudentLean["feeHistory"] }): FeeChange[] {
  return (s.feeHistory ?? [])
    .filter((h) => h && typeof h.from === "string" && typeof h.fee === "number")
    .map((h) => ({ from: h.from!, fee: h.fee! }));
}

/** Ro'yxat narxi (chegirmasiz) — narx o'zgartirish va narx guruhlari uchun. */
export function listFee(s: Pick<StudentLean, "monthlyFee" | "feeHistory">, month: string): number {
  return feeFor({ monthlyFee: s.monthlyFee, feeHistory: feeHistoryOf(s) }, month);
}

/** O'quvchining chegirma tarixi (bazadagi qiymatdan tozalangan). */
export function discountHistoryOf(s: { discountHistory?: StudentLean["discountHistory"] }): DiscountChange[] {
  return (s.discountHistory ?? [])
    .filter((h) => h && typeof h.from === "string")
    .map((h) => ({ from: h.from!, typeId: h.typeId ?? null, name: h.name ?? "", kind: isDiscountKind(h.kind) ? h.kind : null, value: h.value ?? 0 }));
}

/**
 * To'lanishi kerak bo'lgan oylik summa: narx tarixi va chegirma bilan. Chegirmalar o'chiq bo'lsa — o'quvchi
 * `discountHistory` siz yuklanadi (`withDiscounts`), shunda chegirma hisoblanmaydi.
 */
export function studentFee(s: Pick<StudentLean, "monthlyFee" | "feeHistory" | "discountHistory">, month: string): number {
  return applyDiscount(listFee(s, month), discountAt(discountHistoryOf(s), month));
}

/** Chegirmalar o'chiq bo'lsa — chegirma tarixi olib tashlanadi (hisobga kirmaydi). */
export async function withDiscounts<T extends { discountHistory?: StudentLean["discountHistory"] }>(list: T[]): Promise<T[]> {
  if ((await getSettings()).discounts.enabled) return list;
  return list.map((s) => (s.discountHistory?.length ? { ...s, discountHistory: [] } : s));
}

export function statusOf(fee: number, paid: number): PayStatus {
  if (paid >= fee) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}

/** Barcha o'quvchilar (bitta sahifa so'rovi ichida bir marta o'qiladi — React cache). */
export const loadStudents = cache(async (): Promise<StudentLean[]> => {
  await ensureStudentSeqs();
  const list = await Student.find(
    {},
    { fullName: 1, phone: 1, group: 1, monthlyFee: 1, feeHistory: 1, discountHistory: 1, active: 1, startDate: 1, seq: 1, lessons: 1, teacher: 1 },
  )
    .sort({ fullName: 1 })
    .limit(5000)
    .lean<StudentLean[]>();
  return withDiscounts(list);
});

/** O'quvchi -> shu oy uchun to'langan summa (arxivlanganlarsiz). */
export const paidByStudent = cache(async (month: string): Promise<Map<string, number>> => {
  const agg = await Payment.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
    { $match: { ...LIVE, month } },
    { $group: { _id: "$student", total: { $sum: "$amount" } } },
  ]);
  return new Map(agg.map((a) => [String(a._id), a.total]));
});

export function toRow(s: StudentLean, paidMap: Map<string, number>, month: string): StudentRow {
  const fee = studentFee(s, month);
  const paid = paidMap.get(String(s._id)) ?? 0;
  return {
    id: String(s._id),
    seq: s.seq ?? null,
    fullName: s.fullName,
    phone: s.phone ?? "",
    group: s.group ?? "",
    monthlyFee: fee,
    active: s.active ?? true,
    paid,
    debt: Math.max(0, fee - paid),
    status: statusOf(fee, paid),
    started: compareMonths(monthOfDate(s.startDate), month) <= 0,
    lessons: normalizeLessons(s.lessons),
    teacherId: s.teacher ? String(s.teacher) : null,
  };
}

const byStatus: Record<PayStatus, number> = { unpaid: 0, partial: 1, paid: 2 };

export function sortDebtors(rows: StudentRow[]): StudentRow[] {
  return rows
    .filter((r) => r.status !== "paid")
    .sort((a, b) => byStatus[a.status] - byStatus[b.status] || a.fullName.localeCompare(b.fullName));
}

/** Shu oyda to'lashi kerak bo'lgan (faol, o'qishni boshlagan) o'quvchilar holati. */
export async function monthRows(month: string, students?: StudentLean[]): Promise<StudentRow[]> {
  const [list, paidMap] = await Promise.all([students ? Promise.resolve(students) : loadStudents(), paidByStudent(month)]);
  return list.map((s) => toRow(s, paidMap, month)).filter((r) => r.active && r.started);
}
