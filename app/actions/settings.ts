"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { isOwnerPassword, passwordVersion, requireOwner } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isId } from "@/lib/ids";
import { normalizeUzPhone } from "@/lib/eskiz";
import { applyFeeFrom, applyPercentFrom, feeFor, type FeeChange } from "@/lib/fees";
import { feeHistoryOf, studentFee, type StudentLean } from "@/lib/ledger";
import { Salary, Student } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { normalizeStartDay, templateHasCount } from "@/lib/reminders";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/passwords";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import { getSettings, updateSettings } from "@/lib/settings";
import { sendTestSms } from "@/lib/sms";
import { currentMonth, formatMoney, isoToDate, isValidMonth, monthLabel, monthOfDate, todayISO } from "@/lib/time";
import type { FormState } from "./types";

function str(fd: FormData, key: string, max = 200): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

// ---------- Umumiy ----------

export async function saveCenterName(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const centerName = str(fd, "centerName", 60).replace(/\s+/g, " ");
  if (centerName.length < 2) return { fieldErrors: { centerName: "Nomni kiriting" } };
  await updateSettings({ $set: { centerName } });
  refresh();
  return { ok: true, message: "Saqlandi" };
}

// ---------- Oylik to'lov narxi ----------

function sameFees(a: { monthlyFee: number; feeHistory: FeeChange[] }, b: { monthlyFee: number; feeHistory: FeeChange[] }): boolean {
  const key = (h: FeeChange[]) => [...h].sort((x, y) => x.from.localeCompare(y.from)).map((x) => `${x.from}:${x.fee}`).join("|");
  return a.monthlyFee === b.monthlyFee && key(a.feeHistory) === key(b.feeHistory);
}

/**
 * "Tanlangan oydan boshlab oylik to'lov = X". O'tgan oylar hisobi o'zgarmaydi.
 * scope = "all" — barcha o'quvchilar; "fee:300000" — faqat shu oyda 300 000 to'layotganlar (chegirmalar saqlanadi).
 */
export async function applyFeeChange(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const fee = parseAmount(str(fd, "fee"));
  const from = str(fd, "from");
  const scope = str(fd, "scope") || "all";

  const fieldErrors: Record<string, string> = {};
  if (fee === null || fee <= 0) fieldErrors.fee = "Yangi narxni kiriting";
  else if (fee > 100_000_000) fieldErrors.fee = "Narx juda katta — tekshirib ko‘ring";
  if (!isValidMonth(from)) fieldErrors.from = "Qaysi oydan boshlab — tanlang";
  const onlyFee = scope.startsWith("fee:") ? Number(scope.slice(4)) : null;
  if (onlyFee !== null && !Number.isFinite(onlyFee)) fieldErrors.scope = "Kimlarga qo‘llanishini tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  const [students, settings] = await Promise.all([
    Student.find({}, { monthlyFee: 1, feeHistory: 1, startDate: 1, active: 1 }).lean<StudentLean[]>(),
    getSettings({ fresh: true }),
  ]);
  // Narxi shu oyda allaqachon shunday bo'lsa ham, keyingi rejalashtirilgan o'zgarishlar bekor bo'lishi mumkin
  // (masalan, "yanvardan 400 000" ni "noyabrdan 300 000" bilan bekor qilish) — shuning uchun natijani solishtiramiz.
  const ops = students
    .filter((s) => onlyFee === null || studentFee(s, from) === onlyFee)
    .flatMap((s) => {
      const current = { monthlyFee: s.monthlyFee, feeHistory: feeHistoryOf(s) };
      const next = applyFeeFrom({ ...current, startMonth: monthOfDate(s.startDate) }, from, fee!);
      return sameFees(current, next) ? [] : [{ updateOne: { filter: { _id: s._id }, update: { $set: next } } }];
    });
  if (ops.length) await Student.bulkWrite(ops);

  // Markazning standart narxi (yangi o'quvchilar uchun) ham shu oydan o'zgaradi.
  // Hali belgilanmagan bo'lsa — hozir eng ko'p o'quvchi to'layotgan narxdan boshlanadi.
  const now = currentMonth();
  let base = settings.defaultFee;
  if (base === null) {
    const counts = new Map<number, number>();
    for (const s of students) if (s.active !== false) counts.set(studentFee(s, now), (counts.get(studentFee(s, now)) ?? 0) + 1);
    base = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fee!;
  }
  let schedule = settings.feeSchedule;
  const standardAtFrom = feeFor({ monthlyFee: base, feeHistory: schedule }, from);
  if (onlyFee === null || onlyFee === standardAtFrom) {
    // "0000-01" — standart narxning boshlanishi yo'q: o'zgarish doim tarixga yoziladi
    const next = applyFeeFrom({ monthlyFee: base, feeHistory: schedule, startMonth: "0000-01" }, from, fee!);
    base = next.monthlyFee;
    schedule = next.feeHistory;
  }

  await updateSettings({
    $set: { defaultFee: base, feeSchedule: schedule },
    $push: { feeChanges: { $each: [{ from, fee, count: ops.length, at: new Date() }], $slice: -30 } },
  });
  refresh();
  return {
    ok: true,
    message: ops.length
      ? `${ops.length} ta o‘quvchiga ${monthLabel(from)} oyidan boshlab ${formatMoney(fee!)} qo‘llandi`
      : `O‘quvchilarda o‘zgarish yo‘q (hammasida allaqachon shu narx). Standart narx yangilandi.`,
    nonce: Date.now(),
  };
}

// ---------- Ulush foizi ----------

export async function applyPercentChange(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const percent = Number(str(fd, "percent").replace(",", "."));
  const from = str(fd, "from");
  const fieldErrors: Record<string, string> = {};
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) fieldErrors.percent = "1 dan 100 gacha son kiriting";
  if (!isValidMonth(from)) fieldErrors.from = "Qaysi oydan boshlab — tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const settings = await getSettings({ fresh: true });
  const rounded = Math.round(percent * 100) / 100;
  await updateSettings({ $set: { shareHistory: applyPercentFrom(settings.shareHistory, from, rounded) } });
  refresh();
  return { ok: true, message: `${monthLabel(from)} oyidan boshlab ulush ${rounded}%`, nonce: Date.now() };
}

// ---------- Oylik va avanslar ----------

export async function addSalary(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const kind = str(fd, "kind") === "avans" ? "avans" : "oylik";
  const amount = parseAmount(str(fd, "amount"));
  const dateIso = str(fd, "date");
  const date = isoToDate(dateIso);
  const month = str(fd, "month");
  const note = str(fd, "note", 300);

  const fieldErrors: Record<string, string> = {};
  if (amount === null || amount <= 0) fieldErrors.amount = "Summani kiriting";
  else if (amount > 1_000_000_000) fieldErrors.amount = "Summa juda katta — tekshirib ko‘ring";
  if (!date) fieldErrors.date = "Sanani tanlang";
  else if (dateIso > todayISO()) fieldErrors.date = "Kelajakdagi sana tanlab bo‘lmaydi";
  if (!isValidMonth(month)) fieldErrors.month = "Qaysi oy uchun — tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  await Salary.create({ kind, amount: amount!, date: date!, month, note });
  refresh();
  return {
    ok: true,
    message: `${kind === "oylik" ? "Oylik" : "Avans"} ${formatMoney(amount!)} — ${monthLabel(month)} hisobidan ayirildi`,
    nonce: Date.now(),
  };
}

export async function deleteSalary(id: string): Promise<void> {
  await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  await Salary.findByIdAndDelete(id);
  refresh();
}

// ---------- Parollar ----------

function checkNewPassword(next: string, confirm: string): Record<string, string> {
  const fe: Record<string, string> = {};
  if (next.length < MIN_PASSWORD_LENGTH) fe.next = `Kamida ${MIN_PASSWORD_LENGTH} ta belgi`;
  else if (next.length > 100) fe.next = "Juda uzun";
  if (confirm !== next) fe.confirm = "Parollar bir xil emas";
  return fe;
}

export async function changeOwnerPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const settings = await getSettings({ fresh: true });
  const fieldErrors = checkNewPassword(next, confirm);
  if (!(await isOwnerPassword(current, settings))) fieldErrors.current = "Joriy parol noto‘g‘ri";
  else if (!fieldErrors.next && settings.adminPasswordHash && (await verifyPassword(next, settings.adminPasswordHash))) {
    fieldErrors.next = "Bu administrator paroli bilan bir xil — boshqa parol tanlang";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await updateSettings({ $set: { ownerPasswordHash: await hashPassword(next) } });
  // Boshqa qurilmalardagi eski sessiyalar bekor bo'ladi; shu brauzerdagi sessiya yangilanadi
  const fresh = await getSettings({ fresh: true });
  (await cookies()).set(SESSION_COOKIE, await createSessionToken("owner", passwordVersion("owner", fresh)!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  refresh();
  return { ok: true, message: "Parolingiz almashtirildi. Boshqa qurilmalarda qayta kirish kerak bo‘ladi.", nonce: Date.now() };
}

export async function setAdminPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const settings = await getSettings({ fresh: true });
  const fieldErrors = checkNewPassword(next, confirm);
  if (!fieldErrors.next && (await isOwnerPassword(next, settings))) fieldErrors.next = "Bu sizning parolingiz bilan bir xil — boshqa parol tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const had = Boolean(settings.adminPasswordHash);
  await updateSettings({ $set: { adminPasswordHash: await hashPassword(next) } });
  refresh();
  return {
    ok: true,
    message: had
      ? "Administrator paroli almashtirildi. Opa yangi parol bilan qayta kiradi."
      : "Administrator paroli o‘rnatildi. Endi opa shu parol bilan kirib, faqat to‘lovlar sahifasini ko‘radi.",
    nonce: Date.now(),
  };
}

export async function disableAdmin(): Promise<void> {
  await requireOwner({ fresh: true });
  await updateSettings({ $set: { adminPasswordHash: null } });
  refresh();
}

// ---------- SMS ----------

export async function saveSmsSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const enabled = fd.get("enabled") === "on";
  const phone = normalizeUzPhone(str(fd, "phone", 40));
  const template = str(fd, "template", 400).replace(/\s+/g, " ");
  const sender = str(fd, "sender", 20) || "4546";
  const startDay = normalizeStartDay(fd.get("startDay"));

  const fieldErrors: Record<string, string> = {};
  if (!phone) fieldErrors.phone = "Raqamni to‘liq kiriting, masalan: 33 626 30 06";
  if (!templateHasCount(template)) fieldErrors.template = "Matnda {#soni#} bo‘lishi shart (to‘lamaganlar soni)";
  if (!/^[\w.-]{2,11}$/.test(sender)) fieldErrors.sender = "Jo‘natuvchi nomi noto‘g‘ri (odatda 4546)";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await updateSettings({ $set: { "sms.enabled": enabled, "sms.phone": phone, "sms.template": template, "sms.sender": sender, "sms.startDay": startDay } });
  refresh();
  return { ok: true, message: enabled ? "Saqlandi — SMS eslatma yoqilgan" : "Saqlandi — SMS eslatma o‘chirilgan", nonce: Date.now() };
}

export async function sendTestSmsAction(): Promise<FormState> {
  await requireOwner({ fresh: true });
  const res = await sendTestSms();
  refresh();
  if (res.status === "sent") return { ok: true, message: `Sinov SMS yuborildi: «${res.text}»` };
  return { error: res.message };
}
