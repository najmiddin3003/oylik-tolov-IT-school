"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { logActivity } from "@/lib/activity";
import { isOwnerPassword, passwordVersion, requireOwner } from "@/lib/auth";
import { assignCourseStudents } from "@/lib/course-teacher";
import { cleanCourseName, courseKey, coursesForStorage, courseTeacher, sameCourse, type Course } from "@/lib/courses";
import { connectDB } from "@/lib/db";
import { normalizeUzPhone } from "@/lib/eskiz";
import { applyFeeFrom, feeFor, type FeeChange } from "@/lib/fees";
import { isId } from "@/lib/ids";
import { feeHistoryOf, studentFee, type StudentLean } from "@/lib/ledger";
import { Staff, Student } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { DEFAULT_OTP_TEMPLATE, templateHasCode } from "@/lib/otp-text";
import { normalizeStartDay, templateHasCount } from "@/lib/reminders";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/passwords";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import { getSettings, updateSettings } from "@/lib/settings";
import { sendTestSms } from "@/lib/sms";
import { currentMonth, formatMoney, isValidMonth, monthLabel, monthOfDate } from "@/lib/time";
import type { FormState } from "./types";

function str(fd: FormData, key: string, max = 200): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

// ---------- Umumiy ----------

export async function saveCenterName(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const centerName = str(fd, "centerName", 60).replace(/\s+/g, " ");
  if (centerName.length < 2) return { fieldErrors: { centerName: "Nomni kiriting" } };
  await updateSettings({ $set: { centerName } });
  await logActivity(session, "settings.center", `Markaz nomi: «${centerName}»`);
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
 * scope = "all" — barcha o'quvchilar; "fee:300000" — faqat shu oyda 300 000 to'layotganlar (chegirmalar saqlanadi);
 * "course:Web dasturlash" — faqat shu kursdagilar.
 */
export async function applyFeeChange(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const fee = parseAmount(str(fd, "fee"));
  const from = str(fd, "from");
  const scope = str(fd, "scope") || "all";

  const fieldErrors: Record<string, string> = {};
  if (fee === null || fee <= 0) fieldErrors.fee = "Yangi narxni kiriting";
  else if (fee > 100_000_000) fieldErrors.fee = "Narx juda katta — tekshirib ko‘ring";
  if (!isValidMonth(from)) fieldErrors.from = "Qaysi oydan boshlab — tanlang";
  const onlyFee = scope.startsWith("fee:") ? Number(scope.slice(4)) : null;
  if (onlyFee !== null && !Number.isFinite(onlyFee)) fieldErrors.scope = "Kimlarga qo‘llanishini tanlang";
  const onlyCourse = scope.startsWith("course:") ? cleanCourseName(scope.slice(7)) : null;
  if (onlyCourse !== null && !courseKey(onlyCourse)) fieldErrors.scope = "Kursni tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  const [students, settings] = await Promise.all([
    Student.find({}, { monthlyFee: 1, feeHistory: 1, startDate: 1, active: 1, group: 1 }).lean<StudentLean[]>(),
    getSettings({ fresh: true }),
  ]);
  // Narxi shu oyda allaqachon shunday bo'lsa ham, keyingi rejalashtirilgan o'zgarishlar bekor bo'lishi mumkin
  // (masalan, "yanvardan 400 000" ni "noyabrdan 300 000" bilan bekor qilish) — shuning uchun natijani solishtiramiz.
  const ops = students
    .filter((s) => (onlyFee === null || studentFee(s, from) === onlyFee) && (onlyCourse === null || sameCourse(s.group, onlyCourse)))
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
  // Kurs bo'yicha o'zgarsa — markaz standarti emas, shu kursning narxi yangilanadi
  if (onlyCourse === null && (onlyFee === null || onlyFee === standardAtFrom)) {
    // "0000-01" — standart narxning boshlanishi yo'q: o'zgarish doim tarixga yoziladi
    const next = applyFeeFrom({ monthlyFee: base, feeHistory: schedule, startMonth: "0000-01" }, from, fee!);
    base = next.monthlyFee;
    schedule = next.feeHistory;
  }

  const courses: Course[] = onlyCourse
    ? settings.courses.some((c) => sameCourse(c.name, onlyCourse))
      ? settings.courses.map((c) => (sameCourse(c.name, onlyCourse) ? { ...c, fee: fee! } : c))
      : [...settings.courses, { name: onlyCourse, fee: fee!, teachers: [] }]
    : settings.courses;
  await updateSettings({
    $set: { defaultFee: base, feeSchedule: schedule, ...(onlyCourse ? { courses: coursesForStorage(courses) } : {}) },
    $push: { feeChanges: { $each: [{ from, fee, count: ops.length, at: new Date() }], $slice: -30 } },
  });
  const target = onlyCourse ? `«${onlyCourse}» kursiga` : onlyFee !== null ? `hozir ${formatMoney(onlyFee)} to‘layotganlarga` : "barcha o‘quvchilarga";
  await logActivity(session, "settings.fee", `Oylik narx ${monthLabel(from)} dan ${formatMoney(fee!)} — ${target} (${ops.length} ta o‘quvchi)`);
  refresh();
  return {
    ok: true,
    message: ops.length
      ? `${ops.length} ta o‘quvchiga ${monthLabel(from)} oyidan boshlab ${formatMoney(fee!)} qo‘llandi`
      : `O‘quvchilarda o‘zgarish yo‘q (hammasida allaqachon shu narx). Standart narx yangilandi.`,
    nonce: Date.now(),
  };
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
  const session = await requireOwner({ fresh: true });
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
  await logActivity(session, "auth.password", "Rahbarning umumiy paroli almashtirildi");
  refresh();
  return { ok: true, message: "Parolingiz almashtirildi. Boshqa qurilmalarda qayta kirish kerak bo‘ladi.", nonce: Date.now() };
}

export async function setAdminPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const settings = await getSettings({ fresh: true });
  const fieldErrors = checkNewPassword(next, confirm);
  if (!fieldErrors.next && (await isOwnerPassword(next, settings))) fieldErrors.next = "Bu sizning parolingiz bilan bir xil — boshqa parol tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const had = Boolean(settings.adminPasswordHash);
  await updateSettings({ $set: { adminPasswordHash: await hashPassword(next) } });
  await logActivity(session, "settings.admin_password", had ? "Administratorning umumiy paroli almashtirildi" : "Administrator uchun umumiy parol o‘rnatildi");
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
  const session = await requireOwner({ fresh: true });
  await updateSettings({ $set: { adminPasswordHash: null } });
  await logActivity(session, "settings.admin_password", "Administratorning umumiy paroli o‘chirildi");
  refresh();
}

// ---------- SMS ----------

export async function saveSmsSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  // Yoqish/o'chirish — alohida katakcha (Funksiyalar); forma maydoni bo'lsa — o'qiladi
  const enabled = fd.has("enabled") ? fd.get("enabled") === "on" : null;
  const phone = normalizeUzPhone(str(fd, "phone", 40));
  const template = str(fd, "template", 400).replace(/\s+/g, " ");
  const sender = str(fd, "sender", 20) || "4546";
  const startDay = normalizeStartDay(fd.get("startDay"));
  const otpTemplate = str(fd, "otpTemplate", 300).replace(/\s+/g, " ") || DEFAULT_OTP_TEMPLATE;

  const fieldErrors: Record<string, string> = {};
  if (!phone) fieldErrors.phone = "Raqamni to‘liq kiriting, masalan: 33 626 30 06";
  if (!templateHasCount(template)) fieldErrors.template = "Matnda {#soni#} bo‘lishi shart (to‘lamaganlar soni)";
  if (!/^[\w.-]{2,11}$/.test(sender)) fieldErrors.sender = "Jo‘natuvchi nomi noto‘g‘ri (odatda 4546)";
  if (!templateHasCode(otpTemplate)) fieldErrors.otpTemplate = "Matnda {#kod#} bo‘lishi shart (tasdiqlash kodi)";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await updateSettings({
    $set: {
      ...(enabled !== null ? { "sms.enabled": enabled } : {}),
      "sms.phone": phone,
      "sms.template": template,
      "sms.sender": sender,
      "sms.startDay": startDay,
      "sms.otpTemplate": otpTemplate,
    },
  });
  await logActivity(session, "settings.sms", "SMS sozlamalari saqlandi (raqam, matnlar, boshlanish sanasi)");
  refresh();
  return { ok: true, message: "SMS sozlamalari saqlandi", nonce: Date.now() };
}

export async function sendTestSmsAction(): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const res = await sendTestSms();
  await logActivity(session, "settings.sms_test", res.status === "sent" ? `Sinov SMS yuborildi: «${res.text}»` : `Sinov SMS yuborilmadi: ${res.message}`);
  refresh();
  if (res.status === "sent") return { ok: true, message: `Sinov SMS yuborildi: «${res.text}»` };
  return { error: res.message };
}

// ---------- Funksiyalar (yoqib-o'chiriladi) ----------

const FEATURES = {
  paymentDateOwner: { field: "features.paymentDateOwner", label: "«To‘langan sana» maydoni (rahbar)" },
  paymentDateAdmin: { field: "features.paymentDateAdmin", label: "«To‘langan sana» maydoni (administrator)" },
  autoImport: { field: "autoImport", label: "Sheets’dagi yangi to‘lovlarni avtomatik qo‘shish" },
  smsEnabled: { field: "sms.enabled", label: "Kunlik SMS eslatma" },
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** Bitta imkoniyatni yoqish/o'chirish (Sozlamalar → Funksiyalar, katakcha bosilishi bilan saqlanadi). */
export async function setFeature(key: FeatureKey, on: boolean): Promise<{ ok: boolean }> {
  const session = await requireOwner({ fresh: true });
  const f = Object.hasOwn(FEATURES, key) ? FEATURES[key] : null;
  if (!f) return { ok: false };
  await updateSettings({ $set: { [f.field]: Boolean(on) } });
  await logActivity(session, "settings.feature", `${f.label}: ${on ? "yoqildi" : "o‘chirildi"}`);
  refresh();
  return { ok: true };
}

// ---------- Kurslar ----------

/**
 * Kurslar ro'yxatini saqlash (JSON: [{ name, fee, prev }]). Nomi o'zgargan kursdagi o'quvchilarning
 * kursi ham yangi nomga o'tkaziladi.
 */
export async function saveCourses(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("courses") ?? "[]"));
  } catch {
    return { error: "Ma’lumot noto‘g‘ri — sahifani yangilab, qayta urinib ko‘ring" };
  }
  if (!Array.isArray(raw) || raw.length > 30) return { error: "Kurslar ro‘yxati noto‘g‘ri" };

  const fieldErrors: Record<string, string> = {};
  const courses: Course[] = [];
  const renames: { from: string; to: string }[] = [];
  /** Har bir kursning avvalgi nomi (o'qituvchisi almashganini bilish uchun) */
  const prevNames: string[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const r = (item ?? {}) as { name?: unknown; fee?: unknown; prev?: unknown; teachers?: unknown };
    const name = cleanCourseName(String(r.name ?? ""));
    const feeText = String(r.fee ?? "").trim();
    const fee = feeText ? parseAmount(feeText) : null;
    const teachers = Array.isArray(r.teachers) ? [...new Set(r.teachers.map((t) => String(t ?? "").trim()).filter(Boolean))].slice(0, 20) : [];
    if (name.length < 2) fieldErrors[`name-${i}`] = "Kurs nomini kiriting";
    else if (seen.has(courseKey(name))) fieldErrors[`name-${i}`] = "Bu nom takrorlangan";
    if (feeText && (fee === null || fee <= 0 || fee > 100_000_000)) fieldErrors[`fee-${i}`] = "Narx noto‘g‘ri";
    if (teachers.some((t) => !isId(t))) fieldErrors[`teacher-${i}`] = "O‘qituvchi topilmadi";
    seen.add(courseKey(name));
    courses.push({ name, fee: fee && fee > 0 ? fee : null, teachers });
    const prev = cleanCourseName(String(r.prev ?? ""));
    prevNames.push(prev || name);
    if (prev && name.length >= 2 && !sameCourse(prev, name)) renames.push({ from: prev, to: name });
  });
  if (!courses.length) return { error: "Kamida bitta kurs bo‘lishi kerak" };
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  // Kurs o'qituvchisi faqat o'qituvchi lavozimidagi xodim bo'la oladi
  const teacherIds = [...new Set(courses.flatMap((c) => c.teachers))];
  const teacherDocs = teacherIds.length
    ? await Staff.find({ _id: { $in: teacherIds }, role: "teacher" }, { name: 1 }).lean<{ _id: unknown; name: string }[]>()
    : [];
  const teacherName = new Map(teacherDocs.map((t) => [String(t._id), t.name]));
  courses.forEach((c, i) => {
    if (c.teachers.some((t) => !teacherName.has(t))) fieldErrors[`teacher-${i}`] = "O‘qituvchi topilmadi — sahifani yangilang";
  });
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const before = await getSettings({ fresh: true });
  let moved = 0;
  if (renames.length) {
    const students = await Student.find({}, { group: 1 }).lean<{ _id: unknown; group?: string | null }[]>();
    const ops = students.flatMap((st) => {
      const r = renames.find((x) => sameCourse(st.group, x.from));
      return r ? [{ updateOne: { filter: { _id: st._id }, update: { $set: { group: r.to } } } }] : [];
    });
    if (ops.length) {
      await Student.bulkWrite(ops as Parameters<typeof Student.bulkWrite>[0]);
      moved = ops.length;
    }
  }
  await updateSettings({ $set: { courses: coursesForStorage(courses) } });

  // Kursda yagona o'qituvchi bo'lsa: kursdagi o'qituvchisiz o'quvchilar (va yagona o'qituvchi almashgan bo'lsa — avvalgisining
  // o'quvchilari) unga o'tadi. Bir nechta o'qituvchi bo'lsa — o'quvchilar o'zgarmaydi (ustoz qo'lda tanlanadi).
  let assigned = 0;
  for (const [i, c] of courses.entries()) {
    const sole = courseTeacher(courses, c.name);
    if (!sole) continue;
    const previous = courseTeacher(before.courses, prevNames[i]);
    assigned += await assignCourseStudents(c.name, sole, previous !== sole ? previous : null);
  }

  const notes = [
    moved ? `${moved} ta o‘quvchining kursi yangi nomga o‘tkazildi` : "",
    assigned ? `${assigned} ta o‘quvchi kurs o‘qituvchisiga biriktirildi` : "",
  ].filter(Boolean);
  const describe = (c: Course) => {
    const extra = [c.fee ? formatMoney(c.fee) : "", c.teachers.map((t) => teacherName.get(t) ?? "").filter(Boolean).join(" va ")].filter(Boolean);
    return extra.length ? `${c.name} (${extra.join(", ")})` : c.name;
  };
  await logActivity(session, "settings.courses", `Kurslar: ${courses.map(describe).join(", ")}${notes.length ? ` · ${notes.join(" · ")}` : ""}`);
  refresh();
  return { ok: true, message: notes.length ? `Saqlandi. ${notes.join(". ")}.` : "Saqlandi", nonce: Date.now() };
}
