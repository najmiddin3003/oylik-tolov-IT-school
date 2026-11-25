// Oy oxiri eslatmalari va SMS oynasi (sof funksiyalar). Sanalar "YYYY-MM-DD" (Toshkent).
import { compareMonths, monthLabel, shiftMonth } from "./time";

/** Eslatma sarlavhasi: "Oy tugashiga 7 kun qoldi" / "Bugun oyning oxirgi kuni" / "Sentabr 2026 hali yopilmagan". */
export function reminderTitle(r: { month: string; daysLeft: number | null }): string {
  if (r.daysLeft === null) return `${monthLabel(r.month)} hali yopilmagan`;
  if (r.daysLeft === 0) return "Bugun oyning oxirgi kuni";
  return `Oy tugashiga ${r.daysLeft} kun qoldi`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Bugundan keyin oyning nechta kuni qolgan (oxirgi kunda — 0). */
export function daysLeftInMonth(todayIso: string): number {
  return daysInMonth(todayIso.slice(0, 7)) - Number(todayIso.slice(8, 10));
}

/** Oy oxiriga `threshold` kun yoki kamroq qolganmi (shu oy uchun eslatma ko'rsatiladi). */
export function monthEndReminderActive(todayIso: string, threshold = 10): boolean {
  return daysLeftInMonth(todayIso) <= threshold;
}

/** Joriy oy qarzdorlari SMS'da shu sanadan boshlab sanaladi. Standart — 1: oy boshidan, har kuni. */
export const DEFAULT_SMS_START_DAY = 1;
/** Sozlamalarda tanlanadigan sanalar */
export const SMS_START_DAY_OPTIONS = [1, 5, 10, 15, 20, 25] as const;

/** Saqlangan qiymat: 1–28 butun son, aks holda standart. */
export function normalizeStartDay(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 28 ? n : DEFAULT_SMS_START_DAY;
}

/**
 * Bugun qaysi oylar bo'yicha qarzdorlar SMS'da sanaladi:
 * joriy oy — `startDay`-sanadan boshlab; oldingi `lookback` oy — qarzdorlar qolgan bo'lsa (hamma to'laguncha).
 */
export function smsCandidateMonths(todayIso: string, lookback = 2, startDay = DEFAULT_SMS_START_DAY): string[] {
  const current = todayIso.slice(0, 7);
  const months: string[] = [];
  for (let i = lookback; i >= 1; i--) months.push(shiftMonth(current, -i));
  if (Number(todayIso.slice(8, 10)) >= startDay) months.push(current);
  return months;
}

/**
 * SMS matni: {oy} va {soni} (yoki Eskiz ko'rinishidagi {#oy#}, {#soni#}) o'rniga qiymatlar qo'yiladi.
 * Bir nechta oy — bitta so'z qilib, chiziqcha bilan ("Sentabr-Oktabr"): Eskiz shablonidagi o'zgaruvchiga mos tushishi uchun.
 */
export function renderSmsText(template: string, months: string[], count: number, monthName: (m: string) => string): string {
  const oy = [...months].sort(compareMonths).map(monthName).join("-");
  return template
    .replace(/\{#?oy#?\}/g, oy)
    .replace(/\{#?soni#?\}/g, String(count))
    .trim();
}

/** Shablonda to'lamaganlar soni uchun joy bormi ({soni} yoki {#soni#}). */
export function templateHasCount(template: string): boolean {
  return /\{#?soni#?\}/.test(template);
}

const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const MONTHS_LOWER = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** "2026-10-10" -> "10-oktabr, juma" */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${d}-${MONTHS_LOWER[m - 1]}, ${WEEKDAYS[wd]}`;
}

// ---------- Xodimlarga qarzdorlar SMS'i ----------

/** Rahbarga qarzdorlar SMS'i necha kunda bir marta (0 — yuborilmaydi). Standart — 3 kunda 1. */
export const DEFAULT_OWNER_EVERY_DAYS = 3;
export const OWNER_EVERY_DAYS_OPTIONS = [0, 1, 2, 3, 5, 7] as const;

export function normalizeOwnerEveryDays(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 30 ? n : DEFAULT_OWNER_EVERY_DAYS;
}

/**
 * Kim qaysi sonni oladi: o'qituvchi va dars ham beradigan rahbar — faqat o'z o'quvchilari (har kuni);
 * administrator va dars bermaydigan rahbar — markaz bo'yicha jami.
 */
export function debtSmsScope(role: string, teaches = false): "own" | "all" {
  return role === "teacher" || (role === "owner" && teaches) ? "own" : "all";
}

/** Rahbarlarga belgilangan oraliq (N kunda bir marta) — faqat jami oladigan (dars bermaydigan) rahbarga. */
export function debtSmsEveryDays(role: string, teaches = false): boolean {
  return role === "owner" && !teaches;
}

/** Ikki sana orasidagi kunlar ("YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  const t = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Rahbarga bugun yuborish navbatimi: oxirgi yuborilgan kundan beri `everyDays` kun o'tgan bo'lsa (0 — hech qachon). */
export function ownerSmsDue(lastSentDay: string | null, today: string, everyDays: number): boolean {
  if (everyDays <= 0) return false;
  return !lastSentDay || daysBetween(lastSentDay, today) >= everyDays;
}
