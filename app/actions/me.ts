"use server";

// Xodimning o'zi uchun: olgan avans/oylikni yozish va shaxsiy sozlamalar.
import { refresh } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireAuth, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isId } from "@/lib/ids";
import { Salary, Staff } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { SALARY_CYCLE_FROM } from "@/lib/salary-cycle";
import { updateSettings } from "@/lib/settings";
import { formatMoney, isoToDate, isValidMonth, monthLabel, todayISO } from "@/lib/time";
import type { FormState } from "./types";

/** O'qituvchi yoki administrator o'zi olgan avans/oylikni yozadi (oylik hisobidan ayiriladi). */
export async function addMySalary(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireRole(["teacher", "admin"], { fresh: true });
  if (!session.staffId) return { error: "Bu bo‘lim xodim profili uchun" };
  const kind = String(fd.get("kind") ?? "") === "oylik" ? "oylik" : "avans";
  const amount = parseAmount(String(fd.get("amount") ?? ""));
  const dateIso = String(fd.get("date") ?? "");
  const date = isoToDate(dateIso);
  const month = String(fd.get("month") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);

  const fieldErrors: Record<string, string> = {};
  if (amount === null || amount <= 0) fieldErrors.amount = "Summani kiriting";
  else if (amount > 1_000_000_000) fieldErrors.amount = "Summa juda katta — tekshirib ko‘ring";
  if (!date) fieldErrors.date = "Sanani tanlang";
  else if (dateIso > todayISO()) fieldErrors.date = "Kelajakdagi sana tanlab bo‘lmaydi";
  if (!isValidMonth(month)) fieldErrors.month = "Qaysi oy uchun — tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  await Salary.create({ staff: session.staffId, kind, amount: amount!, date: date!, month, note, createdByStaff: session.staffId, selfReported: true });
  const what = `${kind === "oylik" ? "Oylik" : "Avans"} ${formatMoney(amount!)} (${monthLabel(month)} hisobidan)`;
  await logActivity(session, "salary.self_add", `Olingan pul yozildi: ${what}`);
  refresh();
  // Foizli oylikda (o'qituvchi) «oylik» oyni yopadi — keyingi to'lovlar keyingi oyga
  const closes = kind === "oylik" && session.role === "teacher" && month >= SALARY_CYCLE_FROM;
  return { ok: true, message: `${what} yozildi${closes ? ` — ${monthLabel(month)} yopildi, bundan keyin tushgan to‘lovlar keyingi oy oyligiga` : ""}`, nonce: Date.now() };
}

/** O'zi yozgan avans/oylik yozuvini o'chirish (rahbar yozganlarini faqat rahbar o'chiradi). */
export async function deleteMySalary(id: string): Promise<void> {
  const session = await requireRole(["teacher", "admin"], { fresh: true });
  if (!session.staffId || !isId(id)) return;
  await connectDB();
  const removed = await Salary.findOneAndDelete({ _id: id, staff: session.staffId, selfReported: true }).lean();
  if (removed) {
    await logActivity(session, "salary.self_delete", `O‘chirildi: ${removed.kind === "oylik" ? "oylik" : "avans"} ${formatMoney(removed.amount)} (${monthLabel(removed.month)})`);
  }
  refresh();
}

/** Google Sheets ogohlantiruvini o'zim uchun yoqish/o'chirish. */
export async function setMySyncAlert(on: boolean): Promise<void> {
  const session = await requireAuth({ fresh: true });
  await connectDB();
  if (session.staffId) await Staff.updateOne({ _id: session.staffId }, { $set: { "prefs.syncAlert": Boolean(on) } });
  else if (session.role === "owner") await updateSettings({ $set: { "legacyPrefs.syncAlert": Boolean(on) } });
  await logActivity(session, "settings.sync_alert", `Google Sheets ogohlantiruvi ${on ? "yoqildi" : "o‘chirildi"}`);
  refresh();
}
