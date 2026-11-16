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

/** Eskiz xato qaytarsa — keyingi tekshiruvlarda yana uriniladi; bir guruhga kuniga ko'pi bilan shuncha urinish */
export const ATTENDANCE_SMS_MAX_TRIES = 3;
/** Tekshiruv shuncha daqiqadan beri ishlamagan bo'lsa — «ishlamayapti» deb ogohlantiriladi (ping har 5 daqiqada) */
export const ATTENDANCE_SMS_STALE_MINUTES = 15;

/** Guruh bo'yicha bugungi SMS yozuvlari: yuborilganmi, necha marta xato bo'lgan, yuborilmaslik sababi yozilganmi. */
export type AttendanceSmsLogs = { sent: boolean; failed: number; skipped: boolean };

/**
 * Guruhga hozir SMS yuborilsinmi: yuborilgan bo'lsa — yo'q; xato bo'lgan bo'lsa — `ATTENDANCE_SMS_MAX_TRIES` martagacha
 * qayta uriniladi. «Yuborilmadi» (o'qituvchi yo'q / ro'yxatdan o'tmagan) yozuvi to'siq emas — sabab bartaraf etilsa, yuboriladi.
 */
export function attendanceSmsShouldSend(logs: AttendanceSmsLogs | undefined): boolean {
  if (!logs) return true;
  return !logs.sent && logs.failed < ATTENDANCE_SMS_MAX_TRIES;
}

/** Nega o'qituvchiga SMS bormaydi (bormasligi kerak bo'lsa) — matn; hammasi joyida bo'lsa null. */
export function attendanceSmsBlocker(teacher: { status?: string | null; phone?: string | null } | null, hasTeacher: boolean): string | null {
  if (!hasTeacher) return "O‘qituvchi biriktirilmagan";
  if (!teacher) return "O‘qituvchi profili topilmadi";
  if (teacher.status !== "active") return teacher.status === "disabled" ? "O‘qituvchining kirishi o‘chirilgan" : "O‘qituvchi ro‘yxatdan o‘tmagan";
  if (!teacher.phone) return "Telefon raqami yo‘q";
  return null;
}

/** Sozlamalardagi «Bugungi guruhlar» jadvali uchun holat */
export type AttendanceSmsState = "done" | "waiting" | "due" | "sent" | "failed" | "blocked" | "late";

/**
 * Guruhning bugungi SMS holati: davomat qilingan; SMS yuborilgan; yuborib bo'lmaydi (sabab); vaqti hali kelmagan;
 * vaqti kelgan (keyingi tekshiruvda yuboriladi); xato (yana uriniladi yoki urinishlar tugagan); vaqti o'tib ketgan.
 */
export function attendanceSmsState(v: {
  missing: number;
  start: string;
  end: string;
  delay: number;
  minutes: number;
  logs?: AttendanceSmsLogs;
  blocker: string | null;
}): AttendanceSmsState {
  if (v.logs?.sent) return "sent";
  if (v.missing <= 0) return "done";
  if (v.blocker) return "blocked";
  const from = toMinutes(v.start) + ATTENDANCE_OPEN_AFTER + v.delay;
  if (v.minutes < from) return "waiting";
  if (v.logs && v.logs.failed >= ATTENDANCE_SMS_MAX_TRIES) return "failed";
  if (!attendanceSmsDue(v.start, v.end, v.delay, v.minutes)) return "late";
  return v.logs?.failed ? "failed" : "due";
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
