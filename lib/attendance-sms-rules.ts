// Davomat qilinmagan guruh o'qituvchisiga SMS: sozlamalar, shablon va qachon yuborilishi (sof funksiyalar).
import { ATTENDANCE_OPEN_AFTER } from "./attendance-rules";
import { toMinutes } from "./schedule";

// Eskiz'da tasdiqlanadigan shablon bilan harfma-harf bir xil bo'lishi kerak (oddiy apostrof)
export const DEFAULT_ATTENDANCE_SMS_TEMPLATE = "To'lov nazorati: {#vaqt#} dagi {#guruh#} guruhi davomati qilinmagan. Iltimos, davomatni belgilang";
export const DEFAULT_ATTENDANCE_SMS_DELAY = 10;
/** Dars tugaganidan keyin shuncha daqiqagacha eslatiladi (keyin — kech, yuborilmaydi) */
export const ATTENDANCE_SMS_LATE_LIMIT = 120;

export type AttendanceSmsSettings = { enabled: boolean; delayMinutes: number; template: string };

export function normalizeAttendanceSms(raw: Partial<Record<keyof AttendanceSmsSettings, unknown>> | null | undefined): AttendanceSmsSettings {
  const d = Number(raw?.delayMinutes);
  return {
    enabled: raw?.enabled === true,
    delayMinutes: Number.isInteger(d) && d >= 0 && d <= 180 ? d : DEFAULT_ATTENDANCE_SMS_DELAY,
    template: typeof raw?.template === "string" && raw.template.trim() ? raw.template : DEFAULT_ATTENDANCE_SMS_TEMPLATE,
  };
}

/** Guruh davomati ochilib (dars boshlanib 30 daqiqa), yana `delay` daqiqa o'tdimi; dars tugab 2 soat o'tgan bo'lsa — kech. */
export function attendanceSmsDue(start: string, end: string, delay: number, minutes: number): boolean {
  const from = toMinutes(start) + ATTENDANCE_OPEN_AFTER + delay;
  const until = Math.max(toMinutes(end || start), from) + ATTENDANCE_SMS_LATE_LIMIT;
  return minutes >= from && minutes <= until;
}

/** "14:00" + 30 + 10 -> "14:40" — SMS ketadigan vaqt */
export function attendanceSmsAt(start: string, delay: number): string {
  const m = Math.min(toMinutes(start) + ATTENDANCE_OPEN_AFTER + delay, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** {#guruh#} — kurs, {#vaqt#} — dars boshlanishi, {#soni#} — belgilanmagan o'quvchilar, {#ism#} — o'qituvchi. */
export function renderAttendanceSms(template: string, v: { group: string; start: string; missing: number; teacher: string }): string {
  return template
    .replace(/\{#?guruh#?\}/g, v.group || "guruh")
    .replace(/\{#?vaqt#?\}/g, v.start)
    .replace(/\{#?soni#?\}/g, String(v.missing))
    .replace(/\{#?ism#?\}/g, v.teacher)
    .replace(/\s+/g, " ")
    .trim();
}

export function attendanceTemplateError(template: string): string | null {
  if (!template.trim()) return "Matnni kiriting";
  if (!/\{#?guruh#?\}/.test(template)) return "Matnda {#guruh#} bo‘lishi shart (qaysi guruh)";
  return null;
}
