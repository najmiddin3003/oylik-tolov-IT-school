"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { isId } from "@/lib/ids";
import { connectDB } from "@/lib/db";
import { applyFeeFrom, changesAfter } from "@/lib/fees";
import { feeHistoryOf, studentFee, type StudentLean } from "@/lib/ledger";
import { Payment, Student } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { nextStudentSeq } from "@/lib/seq";
import { getSettings, standardFee } from "@/lib/settings";
import { currentMonth, isoToDate, isValidMonth, monthOfDate } from "@/lib/time";
import type { FormState } from "./types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveStudent(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner({ fresh: true });
  if (id !== null && !isId(id)) return { error: "O‘quvchi topilmadi" };

  const fullName = str(formData, "fullName").replace(/\s+/g, " ");
  const phone = str(formData, "phone");
  const parentPhone = str(formData, "parentPhone");
  const group = str(formData, "group").slice(0, 80);
  const feeRaw = str(formData, "monthlyFee");
  const feeFromRaw = str(formData, "feeFrom");
  const startRaw = str(formData, "startDate");
  const note = str(formData, "note").slice(0, 1000);
  const active = str(formData, "active") !== "false";

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 3) fieldErrors.fullName = "Ism-familiyani to‘liq kiriting";
  if (fullName.length > 120) fieldErrors.fullName = "Juda uzun";
  for (const [key, value] of [["phone", phone], ["parentPhone", parentPhone]] as const) {
    if (value && value.replace(/\D/g, "").length < 9) fieldErrors[key] = "Telefon raqam noto‘g‘ri";
  }
  const monthlyFee = parseAmount(feeRaw);
  if (monthlyFee === null || monthlyFee < 0) fieldErrors.monthlyFee = "Oylik to‘lov summasini kiriting";
  const startDate = isoToDate(startRaw);
  if (!startDate) fieldErrors.startDate = "Boshlagan sanani tanlang";
  const feeFrom = isValidMonth(feeFromRaw) ? feeFromRaw : currentMonth();
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  const base = { fullName, phone, parentPhone, group, startDate: startDate!, note, active };

  let savedId: string;
  if (id) {
    const existing = await Student.findById(id, { monthlyFee: 1, feeHistory: 1 }).lean<StudentLean>();
    if (!existing) return { error: "O‘quvchi topilmadi" };
    // Narx o'zgargan bo'lsa — tanlangan oydan boshlab (o'tgan oylar hisobi o'zgarmaydi)
    let fees = { monthlyFee: existing.monthlyFee, feeHistory: feeHistoryOf(existing) };
    if (monthlyFee !== studentFee(existing, feeFrom)) {
      fees = applyFeeFrom({ ...fees, startMonth: monthOfDate(startDate!) }, feeFrom, monthlyFee!);
    }
    await Student.updateOne({ _id: id }, { $set: { ...base, ...fees } }, { runValidators: true });
    savedId = id;
  } else {
    // Standart narx bilan qo'shilsa — rejalashtirilgan o'zgarishlar (masalan, "dekabrdan 350 000") unga ham qo'llanadi
    const settings = await getSettings();
    const startMonth = monthOfDate(startDate!);
    const feeHistory = standardFee(settings, startMonth) === monthlyFee ? changesAfter(settings.feeSchedule, startMonth) : [];
    const created = await Student.create({ ...base, monthlyFee: monthlyFee!, feeHistory, seq: await nextStudentSeq() });
    savedId = String(created._id);
  }
  redirect(`/students/${savedId}`);
}

/** O'quvchini va uning barcha to'lovlarini (arxivdagilari bilan) o'chiradi. */
export async function deleteStudent(id: string, redirectTo: string | null): Promise<void> {
  await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  await Payment.deleteMany({ student: id });
  await Student.findByIdAndDelete(id);
  // Faqat o'quvchilar ro'yxatiga qaytariladi (boshqa manzilga yo'naltirib bo'lmaydi)
  if (redirectTo === "/students") redirect("/students");
  refresh();
}

/** Tanlangan o'quvchilar ustida amal: faol/nofaol qilish yoki o'chirish (to'lovlari bilan). */
export async function bulkStudents(action: "activate" | "deactivate" | "delete", ids: string[]): Promise<void> {
  await requireOwner({ fresh: true });
  if (!["activate", "deactivate", "delete"].includes(action) || !Array.isArray(ids)) return;
  const valid = ids.filter(isId).slice(0, 1000);
  if (!valid.length) return;
  await connectDB();
  if (action === "delete") {
    await Payment.deleteMany({ student: { $in: valid } });
    await Student.deleteMany({ _id: { $in: valid } });
  } else {
    await Student.updateMany({ _id: { $in: valid } }, { $set: { active: action === "activate" } });
  }
  refresh();
}
