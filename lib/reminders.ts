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

export const SMS_START_DAY = 25;

/**
 * Bugun qaysi oylar bo'yicha qarzdorlar SMS'da tekshiriladi:
 * joriy oy — 25-sanadan boshlab; oldingi `lookback` oy — qarzdorlar qolgan bo'lsa (hamma to'laguncha).
 */
export function smsCandidateMonths(todayIso: string, lookback = 2, startDay = SMS_START_DAY): string[] {
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
