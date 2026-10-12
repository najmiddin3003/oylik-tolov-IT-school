// Sana/oy yordamchilari. Barcha "bugun" / "joriy oy" hisoblari Toshkent vaqtida (UTC+5, yozgi vaqt yo'q).

export const TZ_OFFSET_MINUTES = 5 * 60;

export const MONTH_NAMES = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Toshkent vaqtidagi "devor soati"ni UTC maydonlarida qaytaradi (getUTC* bilan o'qiladi). */
function tashkentWall(d: Date = new Date()): Date {
  return new Date(d.getTime() + TZ_OFFSET_MINUTES * 60_000);
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

export function monthKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

export function currentMonth(): string {
  const t = tashkentWall();
  return monthKey(t.getUTCFullYear(), t.getUTCMonth() + 1);
}

export function monthOfDate(d: Date): string {
  const t = tashkentWall(d);
  return monthKey(t.getUTCFullYear(), t.getUTCMonth() + 1);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return monthKey(Math.floor(idx / 12), (idx % 12) + 1);
}

export function compareMonths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthLabel(month: string): string {
  if (!isValidMonth(month)) return month;
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Hozirgi vaqt (ms). Sahifada "hozir"ni bir marta olib, brauzerdagi soatga boshlang'ich qiymat qilib berish uchun. */
export function nowMs(): number {
  return Date.now();
}

/** "YYYY-MM-DD" (Toshkent vaqti bo'yicha bugun). */
export function todayISO(): string {
  return tashkentWall().toISOString().slice(0, 10);
}

/** Toshkent vaqti bo'yicha hozirgi soat (0-23). */
export function tashkentHour(d: Date = new Date()): number {
  return tashkentWall(d).getUTCHours();
}

export function dateToISO(d: Date): string {
  return tashkentWall(d).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" ni Toshkent yarim tunidagi Date ga aylantiradi. */
export function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(utc - TZ_OFFSET_MINUTES * 60_000);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const t = tashkentWall(date);
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${t.getUTCFullYear()}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const t = tashkentWall(date);
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mi = String(t.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(date)} ${hh}:${mi}`;
}

/** 1250000 -> "1 250 000" */
export function formatNumber(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatMoney(n: number): string {
  return `${formatNumber(n)} so‘m`;
}

/**
 * Kunlik avtomatik tekshiruvning eng so'nggi "muddat" vaqti (UTC Date).
 * Masalan soat 06:00 bo'lsa: hozir 05:00 bo'lsa — kechagi 06:00, 07:00 bo'lsa — bugungi 06:00.
 */
export function lastScheduledTime(hour: number, now: Date = new Date()): Date {
  const t = tashkentWall(now);
  const todayAtHourUtc =
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), hour) -
    TZ_OFFSET_MINUTES * 60_000;
  const scheduled =
    now.getTime() >= todayAtHourUtc ? todayAtHourUtc : todayAtHourUtc - 24 * 3600_000;
  return new Date(scheduled);
}
