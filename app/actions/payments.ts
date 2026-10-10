"use server";

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { allocateAmount, type Allocation } from "@/lib/allocate";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment, PAYMENT_METHODS, Student, type PaymentMethod } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { formatMoney, isoToDate, isValidMonth, monthLabel } from "@/lib/time";
import type { FormState } from "./types";

export async function addPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();

  const studentId = String(formData.get("studentId") ?? "");
  const month = String(formData.get("month") ?? "");
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const paidAt = isoToDate(String(formData.get("paidAt") ?? ""));
  const methodRaw = String(formData.get("method") ?? "naqd");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const spread = formData.get("spread") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!mongoose.isValidObjectId(studentId)) fieldErrors.studentId = "O‘quvchini tanlang";
  if (!isValidMonth(month)) fieldErrors.month = "Oyni tanlang";
  if (amount === null || amount <= 0) fieldErrors.amount = "Summani kiriting";
  if (!paidAt) fieldErrors.paidAt = "Sanani tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const method: PaymentMethod = (PAYMENT_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as PaymentMethod)
    : "naqd";

  await connectDB();
  const student = await Student.findById(studentId, { fullName: 1, monthlyFee: 1 }).lean();
  if (!student) return { error: "O‘quvchi topilmadi" };

  // Oylik to'lovdan ortiq summa keyingi oylarga o'tkaziladi (oldindan to'lov)
  let parts: Allocation[] = [{ month, amount: amount! }];
  if (spread && student.monthlyFee > 0 && amount! > 0) {
    const agg = await Payment.aggregate<{ _id: string; total: number }>([
      { $match: { student: new mongoose.Types.ObjectId(studentId), month: { $gte: month } } },
      { $group: { _id: "$month", total: { $sum: "$amount" } } },
    ]);
    const paid = new Map(agg.map((a) => [a._id, a.total]));
    parts = allocateAmount(amount!, student.monthlyFee, month, paid);
  }

  await Payment.insertMany(
    parts.map((p) => ({ student: studentId, month: p.month, amount: p.amount, paidAt: paidAt!, method, note, source: "site" })),
  );
  refresh();
  const what =
    parts.length === 1
      ? `${monthLabel(parts[0].month)} uchun ${formatMoney(parts[0].amount)}`
      : parts.map((p) => `${monthLabel(p.month)} — ${formatMoney(p.amount)}`).join(", ");
  return { ok: true, message: `${student.fullName}: ${what} saqlandi`, nonce: Date.now() };
}

export async function deletePayment(id: string): Promise<void> {
  await requireAuth();
  if (!mongoose.isValidObjectId(id)) return;
  await connectDB();
  await Payment.findByIdAndDelete(id);
  refresh();
}
