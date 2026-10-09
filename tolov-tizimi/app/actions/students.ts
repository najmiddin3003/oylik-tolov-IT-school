"use server";

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment, Student } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { isoToDate } from "@/lib/time";
import type { FormState } from "./types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveStudent(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const fullName = str(formData, "fullName").replace(/\s+/g, " ");
  const phone = str(formData, "phone");
  const parentPhone = str(formData, "parentPhone");
  const group = str(formData, "group");
  const feeRaw = str(formData, "monthlyFee");
  const startRaw = str(formData, "startDate");
  const note = str(formData, "note");
  const active = str(formData, "active") !== "false";

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 3) fieldErrors.fullName = "Ism-familiyani to'liq kiriting";
  if (fullName.length > 120) fieldErrors.fullName = "Juda uzun";
  for (const [key, value] of [["phone", phone], ["parentPhone", parentPhone]] as const) {
    if (value && value.replace(/\D/g, "").length < 9) fieldErrors[key] = "Telefon raqam noto'g'ri";
  }
  const monthlyFee = parseAmount(feeRaw);
  if (monthlyFee === null || monthlyFee < 0) fieldErrors.monthlyFee = "Oylik to'lov summasini kiriting";
  const startDate = isoToDate(startRaw);
  if (!startDate) fieldErrors.startDate = "Boshlagan sanani tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  const data = { fullName, phone, parentPhone, group, monthlyFee: monthlyFee!, startDate: startDate!, note, active };

  let savedId: string;
  if (id) {
    if (!mongoose.isValidObjectId(id)) return { error: "O'quvchi topilmadi" };
    const updated = await Student.findByIdAndUpdate(id, data, { runValidators: true });
    if (!updated) return { error: "O'quvchi topilmadi" };
    savedId = id;
  } else {
    const created = await Student.create(data);
    savedId = String(created._id);
  }
  redirect(`/students/${savedId}`);
}

/** O'quvchini va uning barcha to'lovlarini o'chiradi. */
export async function deleteStudent(id: string, redirectTo: string | null): Promise<void> {
  await requireAuth();
  if (!mongoose.isValidObjectId(id)) return;
  await connectDB();
  await Payment.deleteMany({ student: id });
  await Student.findByIdAndDelete(id);
  if (redirectTo) redirect(redirectTo);
  refresh();
}
