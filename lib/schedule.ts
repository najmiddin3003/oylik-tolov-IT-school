// Dars jadvali: o'quvchi haftaning qaysi kunlari, soat nechidan nechigacha keladi.
// Sof funksiyalar — server va brauzerda birday ishlaydi. Vaqtlar Toshkent vaqtida ("HH:MM").
import { TZ_OFFSET_MINUTES } from "./time";

/** Bitta dars: hafta kuni (1 = dushanba … 7 = yakshanba) va vaqt oralig'i. */
export type Lesson = { day: number; start: string; end: string };

export const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] as const;
export const WEEKDAY_NAMES = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"] as const;

/** Tez tanlash: o'quv markazlaridagi odatiy jadvallar. */
export const DAY_PRESETS = [
  { key: "toq", label: "Toq kunlar", hint: "Du · Ch · Ju", days: [1, 3, 5] },
  { key: "juft", label: "Juft kunlar", hint: "Se · Pa · Sh", days: [2, 4, 6] },
  { key: "har", label: "Har kuni", hint: "Du – Sh", days: [1, 2, 3, 4, 5, 6] },
] as const;

/** Dars tugash vaqti kiritilmagan bo'lsa — boshlanishidan shuncha keyin (daqiqa). */
export const DEFAULT_LESSON_MINUTES = 120;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LAST_MINUTE = 23 * 60 + 59;

export function isTime(v: unknown): v is string {
  return typeof v === "string" && TIME_RE.test(v);
}

/** "14:30" -> 870 */
export function toMinutes(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

/** 870 -> "14:30" (kun chegarasidan chiqmaydi) */
export function fromMinutes(m: number): string {
  const v = Math.min(Math.max(0, Math.round(m)), 23 * 60 + 59);
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

/** Boshlanish vaqti o'zgarganda tugash vaqti: dars davomiyligi saqlanadi (yo'q bo'lsa — 2 soat). */
export function shiftEnd(prevStart: string, prevEnd: string, nextStart: string): string {
  const duration = isTime(prevStart) && isTime(prevEnd) && toMinutes(prevEnd) > toMinutes(prevStart)
    ? toMinutes(prevEnd) - toMinutes(prevStart)
    : DEFAULT_LESSON_MINUTES;
  return fromMinutes(Math.min(toMinutes(nextStart) + duration, LAST_MINUTE));
}

const isDay = (d: unknown): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 7;

/** Bazadan kelgan qiymatni tozalaydi (eski hujjatlarda maydon yo'q — bo'sh jadval), kun tartibida. */
export function normalizeLessons(raw: unknown): Lesson[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: Lesson[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const { day, start, end } = x as Record<string, unknown>;
    if (!isDay(day) || seen.has(day) || !isTime(start) || !isTime(end) || toMinutes(end) <= toMinutes(start)) continue;
    seen.add(day);
    out.push({ day, start, end });
  }
  return out.sort((a, b) => a.day - b.day);
}

/** Formadan kelgan jadval (JSON): xato bo'lsa — tushunarli xabar. Bo'sh — jadvalsiz. */
export function parseLessons(raw: string): { lessons: Lesson[] } | { error: string } {
  if (!raw.trim()) return { lessons: [] };
  let data: unknown;
  try {
    data = raw.length <= 2000 ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!Array.isArray(data) || data.length > 7) return { error: "Dars jadvali noto‘g‘ri" };
  const items = data.map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}));
  // Hamma kunda vaqt bir xil bo'lsa — xabarda kun nomi kerak emas
  const sameTime = new Set(items.map((x) => `${x.start}-${x.end}`)).size <= 1;
  const seen = new Set<number>();
  const lessons: Lesson[] = [];
  for (const { day, start, end } of items) {
    if (!isDay(day) || seen.has(day)) return { error: "Dars kunlari noto‘g‘ri" };
    const say = (text: string) => ({ error: sameTime ? text[0].toUpperCase() + text.slice(1) : `${WEEKDAY_NAMES[day - 1]}: ${text}` });
    if (!isTime(start)) return say("dars boshlanish vaqtini tanlang");
    if (!isTime(end)) return say("dars tugash vaqtini tanlang");
    if (toMinutes(end) <= toMinutes(start)) return say("dars tugashi boshlanishidan keyin bo‘lishi kerak");
    seen.add(day);
    lessons.push({ day, start, end });
  }
  return { lessons: lessons.sort((a, b) => a.day - b.day) };
}

/** Kunlar nomi: "Toq kunlar", "Juft kunlar", "Har kuni" yoki "Du, Pa". */
export function daysLabel(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const key = sorted.join(",");
  const preset = DAY_PRESETS.find((p) => p.days.join(",") === key);
  if (preset) return preset.label;
  if (key === "1,2,3,4,5,6,7") return "Har kuni (yakshanba ham)";
  if (key === "1,2,3,4,5") return "Du – Ju";
  return sorted.map((d) => WEEKDAY_SHORT[d - 1]).join(", ");
}

export type SchedulePart = { days: string; dayList: number[]; start: string; end: string; time: string };

/** Bir xil vaqtdagi kunlar birlashtiriladi: [{ days: "Toq kunlar", time: "14:00–16:00" }]. */
export function scheduleParts(lessons: Lesson[]): SchedulePart[] {
  const groups: { start: string; end: string; days: number[] }[] = [];
  for (const l of [...lessons].sort((a, b) => a.day - b.day)) {
    const g = groups.find((x) => x.start === l.start && x.end === l.end);
    if (g) g.days.push(l.day);
    else groups.push({ start: l.start, end: l.end, days: [l.day] });
  }
  return groups.map((g) => ({ days: daysLabel(g.days), dayList: g.days, start: g.start, end: g.end, time: `${g.start}–${g.end}` }));
}

/** "Toq kunlar · 14:00–16:00" (har xil vaqtlar — "; " bilan). Jadval bo'lmasa — bo'sh qator. */
export function scheduleLabel(lessons: Lesson[]): string {
  return scheduleParts(lessons)
    .map((p) => `${p.days} · ${p.time}`)
    .join("; ");
}

/** Jadvalni solishtirish/guruhlash uchun kalit. */
export function lessonsKey(lessons: Lesson[]): string {
  return lessons.map((l) => `${l.day}@${l.start}-${l.end}`).join("|");
}

/** Ko'p uchraydigan jadvallar (yangi o'quvchiga bir bosishda qo'yish uchun). */
export function popularSchedules(all: Lesson[][], limit = 5): { lessons: Lesson[]; count: number }[] {
  const map = new Map<string, { lessons: Lesson[]; count: number }>();
  for (const lessons of all) {
    if (!lessons.length) continue;
    const k = lessonsKey(lessons);
    const e = map.get(k);
    if (e) e.count++;
    else map.set(k, { lessons, count: 1 });
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || toMinutes(a.lessons[0].start) - toMinutes(b.lessons[0].start))
    .slice(0, limit);
}

// ---------- Hozirgi vaqtga nisbatan ----------

export type Clock = { iso: string; weekday: number; minutes: number };

/** Toshkent vaqti: sana, hafta kuni (1–7) va kun boshidan o'tgan daqiqalar. */
export function tashkentClock(ms: number): Clock {
  const t = new Date(ms + TZ_OFFSET_MINUTES * 60_000);
  return {
    iso: t.toISOString().slice(0, 10),
    weekday: ((t.getUTCDay() + 6) % 7) + 1,
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
}

/** "2026-10-12" -> 1 (dushanba) */
export function weekdayOfIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export function lessonOn(lessons: Lesson[], weekday: number): Lesson | undefined {
  return lessons.find((l) => l.day === weekday);
}

export type LessonState = "now" | "soon" | "later" | "done";

/** Bugungi dars holati: hozir darsda / bir soat ichida boshlanadi / keyinroq / tugagan. */
export function lessonState(l: Pick<Lesson, "start" | "end">, minutes: number): LessonState {
  if (minutes >= toMinutes(l.end)) return "done";
  if (minutes >= toMinutes(l.start)) return "now";
  return toMinutes(l.start) - minutes <= 60 ? "soon" : "later";
}

export type NextLesson = { lesson: Lesson; inDays: number; now: boolean };

/** Keyingi dars (hozir davom etayotgan bo'lsa — o'sha). Bugungisi tugagan bo'lsa — keyingi kunlardan. */
export function nextLesson(lessons: Lesson[], clock: Pick<Clock, "weekday" | "minutes">): NextLesson | null {
  for (let i = 0; i <= 7; i++) {
    const l = lessonOn(lessons, ((clock.weekday - 1 + i) % 7) + 1);
    if (!l) continue;
    if (i === 0) {
      if (clock.minutes >= toMinutes(l.end)) continue;
      return { lesson: l, inDays: 0, now: clock.minutes >= toMinutes(l.start) };
    }
    return { lesson: l, inDays: i, now: false };
  }
  return null;
}

/**
 * "Hozir darsda (16:00 gacha)", "Bugun, 14:00", "Ertaga, 10:00", "Chorshanba, 14:00".
 * `short` — jadval kataklari uchun: "Hozir darsda", keyingi haftadagisi — shunchaki kun nomi.
 */
export function nextLessonLabel(n: NextLesson, short = false): string {
  if (n.now) return short ? "Hozir darsda" : `Hozir darsda (${n.lesson.end} gacha)`;
  if (n.inDays === 0) return `Bugun, ${n.lesson.start}`;
  if (n.inDays === 1) return `Ertaga, ${n.lesson.start}`;
  if (n.inDays === 7 && !short) return `Keyingi ${WEEKDAY_NAMES[n.lesson.day - 1].toLowerCase()}, ${n.lesson.start}`;
  return `${WEEKDAY_NAMES[n.lesson.day - 1]}, ${n.lesson.start}`;
}

/** Saralash uchun: keyingi darsgacha qolgan daqiqalar (hozir darsda — manfiy emas, 0). Jadval yo'q — Infinity. */
export function minutesUntil(n: NextLesson | null, clock: Pick<Clock, "minutes">): number {
  if (!n) return Number.POSITIVE_INFINITY;
  if (n.now) return 0;
  return n.inDays * 24 * 60 + toMinutes(n.lesson.start) - clock.minutes;
}

/** "40 daqiqadan keyin", "1 soat 20 daqiqadan keyin", "2 soatdan keyin". */
export function untilLabel(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} daqiqadan keyin`;
  if (!r) return `${h} soatdan keyin`;
  return `${h} soat ${r} daqiqadan keyin`;
}

// ---------- O'quvchilar ro'yxatidagi "Dars kuni" filtri ----------

/** Jadval turi: toq kunlar (Du · Ch · Ju), juft kunlar (Se · Pa · Sh), har kuni (Du – Sh). */
export type ScheduleKind = (typeof DAY_PRESETS)[number]["key"];

export type DayFilter = "" | "today" | "none" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | ScheduleKind;

export function parseDayFilter(v: unknown): DayFilter {
  return typeof v === "string" && /^(today|none|[1-7]|toq|juft|har)$/.test(v) ? (v as DayFilter) : "";
}

/**
 * Jadval qaysi turga kiradi: faqat toq kunlarda (Du, Ch, Ju) — "toq", faqat juft kunlarda (Se, Pa, Sh) — "juft",
 * dushanbadan shanbagacha har kuni — "har"; aralash yoki jadvalsiz — null.
 */
export function scheduleKind(lessons: Lesson[]): ScheduleKind | null {
  const days = new Set(lessons.map((l) => l.day));
  if (!days.size) return null;
  if ([1, 2, 3, 4, 5, 6].every((d) => days.has(d))) return "har";
  if ([...days].every((d) => d === 1 || d === 3 || d === 5)) return "toq";
  if ([...days].every((d) => d === 2 || d === 4 || d === 6)) return "juft";
  return null;
}

/** Filtrdagi hafta kuni (bugun — joriy kun); "none", jadval turi va bo'sh filtrda — null. */
export function filterWeekday(f: DayFilter, todayWeekday: number): number | null {
  if (f === "today") return todayWeekday;
  return /^[1-7]$/.test(f) ? Number(f) : null;
}

export function matchesDayFilter(lessons: Lesson[], f: DayFilter, todayWeekday: number): boolean {
  if (!f) return true;
  if (f === "none") return lessons.length === 0;
  if (f === "toq" || f === "juft" || f === "har") return scheduleKind(lessons) === f;
  const wd = filterWeekday(f, todayWeekday);
  return wd !== null && lessons.some((l) => l.day === wd);
}

// ---------- Qarzdorlar: bugungi dars holati bo'yicha filtr ----------

/**
 * "" — hammasi; now — hozir darsda; today — bugun keladi; done — bugungi darsi tugagan; none — dars vaqti kiritilmagan;
 * "16:00-18:00" — bugun shu vaqtda keladi.
 */
export type LessonFilter = "" | "now" | "today" | "done" | "none" | `${string}-${string}`;

const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

export function parseLessonFilter(v: unknown): LessonFilter {
  if (v === "now" || v === "today" || v === "done" || v === "none") return v;
  return typeof v === "string" && SLOT_RE.test(v) ? (v as LessonFilter) : "";
}

/** Dars vaqti kaliti: "16:00-18:00" */
export function slotKey(l: Pick<Lesson, "start" | "end">): string {
  return `${l.start}-${l.end}`;
}

export function matchesLessonFilter(lessons: Lesson[], f: LessonFilter, clock: Pick<Clock, "weekday" | "minutes">): boolean {
  if (!f) return true;
  if (f === "none") return lessons.length === 0;
  const l = lessonOn(lessons, clock.weekday);
  if (!l) return false;
  if (f === "today") return true;
  if (f === "now" || f === "done") return lessonState(l, clock.minutes) === f;
  return slotKey(l) === f;
}

export type TodaySlot = { key: string; start: string; end: string; state: LessonState };

/** Bugungi dars vaqtlari (takrorlanmasdan, boshlanishi bo'yicha) va har birining hozirgi holati. */
export function todaySlots(all: Lesson[][], clock: Pick<Clock, "weekday" | "minutes">): TodaySlot[] {
  const slots = new Map<string, TodaySlot>();
  for (const lessons of all) {
    const l = lessonOn(lessons, clock.weekday);
    if (l && !slots.has(slotKey(l))) slots.set(slotKey(l), { key: slotKey(l), start: l.start, end: l.end, state: lessonState(l, clock.minutes) });
  }
  return [...slots.values()].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end));
}
