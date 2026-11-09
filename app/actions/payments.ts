"use server";

import mongoose from "mongoose";
import { logActivity } from "@/lib/activity";
import { dataChanged } from "@/lib/after-change";
import { allocateAmount, type Allocation } from "@/lib/allocate";
import { requireOwner, requireRole } from "@/lib/auth";
import { isId } from "@/lib/ids";
import { connectDB } from "@/lib/db";
import { LIVE, studentFee, type StudentLean } from "@/lib/ledger";
import { Payment, PAYMENT_METHODS, Student, type PaymentMethod } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { getSettings } from "@/lib/settings";
import { formatMoney, isoToDate, isValidMonth, monthLabel, todayISO } from "@/lib/time";
import type { FormState } from "./types";

const MAX_AMOUNT = 1_000_000_000;
const METHOD_LABEL: Record<PaymentMethod, string> = { naqd: "naqd", karta: "karta", otkazma: "o‘tkazma" };

/** Jurnal uchun: to'lov tavsifi ("Aliyev Vali: Oktabr uchun 300 000 so'm"). */
async function describePayment(id: string): Promise<string> {
  const p = await Payment.findById(id, { student: 1, month: 1, amount: 1 })
    .populate<{ student: { fullName: string } | null }>("student", "fullName")
    .lean();
  return p ? `${p.student?.fullName ?? "o‘chirilgan o‘quvchi"}: ${monthLabel(p.month)} uchun ${formatMoney(p.amount)}` : "to‘lov";
}

export async function addPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  // To'lovni rahbar va administrator kiritadi (o'qituvchi faqat ko'radi)
  const session = await requireRole(["owner", "admin"], { fresh: true });
  const { role, staffId } = session;

  const studentId = String(formData.get("studentId") ?? "");
  const month = String(formData.get("month") ?? "");
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const today = todayISO();
  // «To'langan sana» maydoni rahbar sozlamasi bilan yoqiladi (rol bo'yicha); o'chiq bo'lsa — har doim bugun (Toshkent vaqti)
  const { features } = await getSettings({ fresh: true });
  const canPickDate = role === "owner" ? features.paymentDate.owner : features.paymentDate.admin;
  const paidIso = canPickDate ? String(formData.get("paidAt") ?? "") : today;
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
      createdByStaff: staffId,
    })),
  );
  const what =
    parts.length === 1
      ? `${monthLabel(parts[0].month)} uchun ${formatMoney(parts[0].amount)}`
      : parts.map((p) => `${monthLabel(p.month)} — ${formatMoney(p.amount)}`).join(", ");
  await logActivity(session, "payment.add", `${student.fullName}: ${what} (${METHOD_LABEL[method]}${paidIso !== today ? `, to‘langan sana ${paidIso}` : ""})`);
  await dataChanged();
  return { ok: true, message: `${student.fullName}: ${what} saqlandi`, nonce: Date.now() };
}

/**
 * To'lov summasini tahrirlash (rahbar va administrator). Qarz, reja va oyliklar summadan hisoblanadi —
 * hammasi o'zi yangilanadi. Asl (birinchi kiritilgan) summa saqlanadi, to'lov «tahrirlangan» deb belgilanadi.
 */
export async function updatePaymentAmount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["owner", "admin"], { fresh: true });
  const id = String(formData.get("id") ?? "");
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (!isId(id)) return { error: "To‘lov topilmadi" };
  if (amount === null || amount <= 0) return { fieldErrors: { amount: "Summani kiriting" } };
  if (amount > MAX_AMOUNT) return { fieldErrors: { amount: "Summa juda katta — tekshirib ko‘ring" } };

  await connectDB();
  const p = await Payment.findOne({ _id: id, ...LIVE }, { student: 1, month: 1, amount: 1, originalAmount: 1 })
    .populate<{ student: { fullName: string } | null }>("student", "fullName")
    .lean();
  if (!p) return { error: "To‘lov topilmadi — o‘chirilgan yoki arxivga o‘tkazilgan bo‘lishi mumkin" };
  if (p.amount === amount) return { fieldErrors: { amount: "Summa o‘zgarmagan" } };

  // Shu orada boshqa kishi o'zgartirgan bo'lsa — ustidan yozilmaydi
  const res = await Payment.updateOne(
    { _id: id, ...LIVE, amount: p.amount },
    { $set: { amount, editedAt: new Date(), editedBy: session.role, originalAmount: p.originalAmount ?? p.amount } },
  );
  if (!res.modifiedCount) return { error: "To‘lov shu orada o‘zgargan — sahifani yangilab, qaytadan urinib ko‘ring" };

  const name = p.student?.fullName ?? "o‘chirilgan o‘quvchi";
  const change = `${formatMoney(p.amount)} → ${formatMoney(amount)}`;
  await logActivity(session, "payment.edit", `Summa tahrirlandi: ${name}, ${monthLabel(p.month)} uchun ${change}`);
  await dataChanged();
  return { ok: true, message: `${name}: ${monthLabel(p.month)} uchun summa ${change}`, nonce: Date.now() };
}

/** To'lovni arxivga o'tkazish: hech qayerda ko'rinmaydi va hisoblanmaydi (faqat rahbarning arxivida qoladi). */
export async function archivePayment(id: string): Promise<void> {
  const session = await requireRole(["owner", "admin"], { fresh: true });
  if (!isId(id)) return;
  await connectDB();
  const res = await Payment.updateOne({ _id: id, ...LIVE }, { $set: { archivedAt: new Date(), archivedBy: session.role } });
  if (res.modifiedCount) await logActivity(session, "payment.archive", `${session.role === "owner" ? "Arxivga o‘tkazildi" : "O‘chirildi"}: ${await describePayment(id)}`);
  await dataChanged();
}

/** Arxivdan qaytarish (faqat rahbar). */
export async function restorePayment(id: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  const res = await Payment.updateOne({ _id: id, archivedAt: { $ne: null } }, { $set: { archivedAt: null, archivedBy: null } });
  if (res.modifiedCount) await logActivity(session, "payment.restore", `Arxivdan qaytarildi: ${await describePayment(id)}`);
  await dataChanged();
}

/** Arxivdagi to'lovni butunlay o'chirish (faqat rahbar, qaytarib bo'lmaydi). */
export async function purgePayment(id: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  const what = await describePayment(id);
  const res = await Payment.deleteOne({ _id: id, archivedAt: { $ne: null } });
  if (res.deletedCount) await logActivity(session, "payment.purge", `Butunlay o‘chirildi: ${what}`);
  await dataChanged();
}
