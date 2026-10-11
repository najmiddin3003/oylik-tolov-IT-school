"use server";

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { allocateAmount, type Allocation } from "@/lib/allocate";
import { requireAuth, requireOwner } from "@/lib/auth";
import { isId } from "@/lib/ids";
import { connectDB } from "@/lib/db";
import { LIVE, studentFee, type StudentLean } from "@/lib/ledger";
import { Payment, PAYMENT_METHODS, Student, type PaymentMethod } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { formatMoney, isoToDate, isValidMonth, monthLabel, todayISO } from "@/lib/time";
import type { FormState } from "./types";

const MAX_AMOUNT = 1_000_000_000;

export async function addPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { role } = await requireAuth({ fresh: true });

  const studentId = String(formData.get("studentId") ?? "");
  const month = String(formData.get("month") ?? "");
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const today = todayISO();
  // Administrator kiritganda sana tanlanmaydi — har doim bugungi sana (Toshkent vaqti)
  const paidIso = role === "admin" ? today : String(formData.get("paidAt") ?? "");
  const paidAt = isoToDate(paidIso);
  const methodRaw = String(formData.get("method") ?? "naqd");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const spread = formData.get("spread") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!isId(studentId)) fieldErrors.studentId = "O‘quvchini tanlang";
  if (!isValidMonth(month)) fieldErrors.month = "Oyni tanlang";
  if (amount === null || amount <= 0) fieldErrors.amount = "Summani kiriting";
  else if (amount > MAX_AMOUNT) fieldErrors.amount = "Summa juda katta — tekshirib ko‘ring";
  if (!paidAt) fieldErrors.paidAt = "Sanani tanlang";
  else if (paidIso > today) fieldErrors.paidAt = "Kelajakdagi sana tanlab bo‘lmaydi";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const method: PaymentMethod = (PAYMENT_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as PaymentMethod)
    : "naqd";

  await connectDB();
  const student = await Student.findById(studentId, { fullName: 1, monthlyFee: 1, feeHistory: 1 }).lean<StudentLean>();
  if (!student) return { error: "O‘quvchi topilmadi" };

  // Oylik to'lovdan ortiq summa keyingi oylarga o'tkaziladi (oldindan to'lov)
  const feeOf = (m: string) => studentFee(student, m);
  let parts: Allocation[] = [{ month, amount: amount! }];
  if (spread && feeOf(month) > 0) {
    const agg = await Payment.aggregate<{ _id: string; total: number }>([
      { $match: { ...LIVE, student: new mongoose.Types.ObjectId(studentId), month: { $gte: month } } },
      { $group: { _id: "$month", total: { $sum: "$amount" } } },
    ]);
    const paid = new Map(agg.map((a) => [a._id, a.total]));
    parts = allocateAmount(amount!, feeOf, month, paid);
  }

  await Payment.insertMany(
    parts.map((p) => ({
      student: studentId,
      month: p.month,
      amount: p.amount,
      paidAt: paidAt!,
      method,
      note,
      source: "site",
      createdBy: role,
    })),
  );
  refresh();
  const what =
    parts.length === 1
      ? `${monthLabel(parts[0].month)} uchun ${formatMoney(parts[0].amount)}`
      : parts.map((p) => `${monthLabel(p.month)} — ${formatMoney(p.amount)}`).join(", ");
  return { ok: true, message: `${student.fullName}: ${what} saqlandi`, nonce: Date.now() };
}

/** To'lovni arxivga o'tkazish: hech qayerda ko'rinmaydi va hisoblanmaydi (faqat rahbarning arxivida qoladi). */
export async function archivePayment(id: string): Promise<void> {
  const { role } = await requireAuth({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  await Payment.updateOne({ _id: id, ...LIVE }, { $set: { archivedAt: new Date(), archivedBy: role } });
  refresh();
}

/** Arxivdan qaytarish (faqat rahbar). */
export async function restorePayment(id: string): Promise<void> {
  await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  await Payment.updateOne({ _id: id, archivedAt: { $ne: null } }, { $set: { archivedAt: null, archivedBy: null } });
  refresh();
}

/** Arxivdagi to'lovni butunlay o'chirish (faqat rahbar, qaytarib bo'lmaydi). */
export async function purgePayment(id: string): Promise<void> {
  await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  await Payment.deleteOne({ _id: id, archivedAt: { $ne: null } });
  refresh();
}
