// Ota-onalarga to'lov eslatmasi (SMS): sozlamalar, shablon, kimga va qachon (sof funksiyalar — server, brauzer va testlarda).
import { daysInMonth } from "./reminders";

// Eskiz'da tasdiqlanadigan shablon bilan harfma-harf bir xil bo'lishi kerak. Oddiy apostrof — 1 SMS 160 belgigacha.
export const DEFAULT_PARENT_SMS_TEMPLATE =
  "Hurmatli ota-ona! Farzandingiz {#ism#} {#oy#} oyi uchun {#summa#} so'm to'lov qilmagan. Iltimos, to'lovni amalga oshiring. {#markaz#}";

/** Qayta yuborish oralig'i (kun): 0 — oyiga bir marta */
export const PARENT_SMS_REPEAT_OPTIONS = [0, 3, 5, 7, 10] as const;
export const DEFAULT_PARENT_SMS_START_DAY = 10;

export type ParentSmsSettings = {
  enabled: boolean;
  /** Har oyning shu sanasidan boshlab (shu kun ham) yuboriladi */
  startDay: number;
  /** 0 — oyiga bir marta; aks holda to'laguncha har N kunda */
  repeatDays: number;
  template: string;
  /** Qisman to'laganlar ota-onasiga ham */
  includePartial: boolean;
};

export function normalizeParentSms(raw: Partial<Record<keyof ParentSmsSettings, unknown>> | null | undefined): ParentSmsSettings {
  const day = Number(raw?.startDay);
  const repeat = Number(raw?.repeatDays);
  return {
    enabled: raw?.enabled === true,
    startDay: Number.isInteger(day) && day >= 1 && day <= 28 ? day : DEFAULT_PARENT_SMS_START_DAY,
    repeatDays: (PARENT_SMS_REPEAT_OPTIONS as readonly number[]).includes(repeat) ? repeat : 0,
    template: typeof raw?.template === "string" && raw.template.trim() ? raw.template : DEFAULT_PARENT_SMS_TEMPLATE,
    includePartial: raw?.includePartial !== false,
  };
}

/** "300 000" — summa (bo'shliq bilan, «so'm» shablonda) */
export function formatSum(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Shablonga qiymatlar: {#ism#}, {#oy#}, {#summa#}, {#markaz#} (yoki {ism} ko'rinishida). */
export function renderParentSms(template: string, v: { name: string; months: string[]; debt: number; center: string }, monthName: (m: string) => string): string {
  const oy = [...v.months].sort().map(monthName).join("-");
  return template
    .replace(/\{#?ism#?\}/g, v.name)
    .replace(/\{#?oy#?\}/g, oy)
    .replace(/\{#?summa#?\}/g, formatSum(v.debt))
    .replace(/\{#?markaz#?\}/g, v.center)
    .replace(/\s+/g, " ")
    .trim();
}

/** Shablonda majburiy o'rinlar: o'quvchi ismi va summa. */
export function parentTemplateErrors(template: string): string | null {
  if (!template.trim()) return "Matnni kiriting";
  if (!/\{#?ism#?\}/.test(template)) return "Matnda {#ism#} bo‘lishi shart (o‘quvchi ismi)";
  if (!/\{#?summa#?\}/.test(template)) return "Matnda {#summa#} bo‘lishi shart (qarz summasi)";
  return null;
}

/** Bugun yuborish kuni keldimi (oyning `startDay`-sanasidan; qisqa oyda — oxirgi kundan oshmaydi). */
export function parentSmsDue(todayIso: string, startDay: number): boolean {
  const day = Number(todayIso.slice(8, 10));
  return day >= Math.min(startDay, daysInMonth(todayIso.slice(0, 7)));
}

/**
 * Shu o'quvchi ota-onasiga bugun yuborilsinmi: oyiga bir marta — shu oyda hali yuborilmagan bo'lsa;
 * har N kunda — oxirgisidan N kun o'tgan bo'lsa. `lastSent` — shu oydagi oxirgi yuborilgan kun ("YYYY-MM-DD") yoki null.
 */
export function parentSmsAgain(todayIso: string, repeatDays: number, lastSent: string | null): boolean {
  if (!lastSent) return true;
  if (repeatDays <= 0) return lastSent.slice(0, 7) !== todayIso.slice(0, 7);
  const days = (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${lastSent}T00:00:00Z`)) / 86_400_000;
  return days >= repeatDays;
}
