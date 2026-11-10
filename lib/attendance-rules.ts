// Davomat: holatlar, qachon ochilishi, guruhlash va tekshiruv (sof funksiyalar — server, brauzer va testlarda).
import { courseKey } from "./courses";
import { fromMinutes, lessonOn, toMinutes, type Clock, type Lesson } from "./schedule";

export const ATTENDANCE_STATUSES = ["present", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Keldi",
  absent: "Kelmadi",
  excused: "Sababli",
};

/** Davomat dars boshlanganidan shuncha daqiqa o'tib ochiladi (kechikib kelganlar ham yetib kelishi uchun). */
export const ATTENDANCE_OPEN_AFTER = 30;
export const ATTENDANCE_NOTE_MAX = 300;

export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(v);
}

/** «Kelmadi» va «Sababli» — izoh majburiy. */
export function needsNote(status: AttendanceStatus): boolean {
  return status !== "present";
}

/** Davomat ochiladigan vaqt: "14:00" -> "14:30". */
export function attendanceOpensAt(start: string): string {
  return fromMinutes(Math.min(toMinutes(start) + ATTENDANCE_OPEN_AFTER, 23 * 60 + 59));
}

/** Davomat qilsa bo'ladimi: o'tgan kun — ha; bugun — dars boshlanib 30 daqiqa o'tgach; kelgusi kun — yo'q. */
export function attendanceOpen(date: string, start: string, clock: Pick<Clock, "iso" | "minutes">): boolean {
  if (date < clock.iso) return true;
  if (date > clock.iso) return false;
  return clock.minutes >= toMinutes(start) + ATTENDANCE_OPEN_AFTER;
}

export type AttendanceStudent = {
  id: string;
  name: string;
  seq: number | null;
  group: string;
  teacherId: string | null;
  lessons: Lesson[];
};

export type AttendanceGroup = {
  /** "14:00-16:00|web dasturlash|<o'qituvchi>" */
  key: string;
  start: string;
  end: string;
  /** Kurs nomi (ko'rsatish uchun) */
  course: string;
  teacherId: string | null;
  students: AttendanceStudent[];
};

export function attendanceGroupKey(start: string, end: string, group: string, teacherId: string | null): string {
  return `${start}-${end}|${courseKey(group)}|${teacherId ?? ""}`;
}

/**
 * Shu hafta kuni darsi bor o'quvchilar — guruhlarga: bir xil dars vaqti, kurs va o'qituvchi. Boshlanishi bo'yicha,
 * bir vaqtdagilari kurs nomi bo'yicha; guruh ichida — ism bo'yicha.
 */
export function attendanceGroups(students: AttendanceStudent[], weekday: number): AttendanceGroup[] {
  const groups = new Map<string, AttendanceGroup>();
  for (const s of students) {
    const l = lessonOn(s.lessons, weekday);
    if (!l) continue;
    const key = attendanceGroupKey(l.start, l.end, s.group, s.teacherId);
    const g = groups.get(key);
    if (g) g.students.push(s);
    else groups.set(key, { key, start: l.start, end: l.end, course: s.group.trim(), teacherId: s.teacherId, students: [s] });
  }
  for (const g of groups.values()) g.students.sort((a, b) => a.name.localeCompare(b.name));
  return [...groups.values()].sort(
    (a, b) => toMinutes(a.start) - toMinutes(b.start) || a.course.localeCompare(b.course) || toMinutes(a.end) - toMinutes(b.end),
  );
}

export type AttendanceMark = { status: string; note: string };

/**
 * Yuborilgan davomatni tekshirish: har bir o'quvchiga holat tanlangan bo'lishi, «Kelmadi» / «Sababli» da izoh yozilgan
 * bo'lishi kerak. Xatolar: `status_<id>`, `note_<id>`.
 */
export function validateAttendance(ids: string[], marks: Record<string, AttendanceMark | undefined>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const id of ids) {
    const m = marks[id];
    if (!m || !isAttendanceStatus(m.status)) {
      errors[`status_${id}`] = "Holatini tanlang";
      continue;
    }
    if (needsNote(m.status) && !m.note.trim()) errors[`note_${id}`] = `«${ATTENDANCE_LABEL[m.status]}» uchun izoh yozing`;
  }
  return errors;
}

export type AttendanceSummary = Record<AttendanceStatus, number> & { total: number; missing: number };

/** Guruh bo'yicha: nechtasi keldi / kelmadi / sababli va nechtasi hali belgilanmagan. */
export function attendanceSummary(ids: string[], statusOf: (id: string) => AttendanceStatus | null | undefined): AttendanceSummary {
  const out: AttendanceSummary = { present: 0, absent: 0, excused: 0, total: ids.length, missing: 0 };
  for (const id of ids) {
    const s = statusOf(id);
    if (s) out[s]++;
    else out.missing++;
  }
  return out;
}
