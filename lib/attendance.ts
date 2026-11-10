import "server-only";
import { cache } from "react";
// Davomat: kun bo'yicha guruhlar (dars jadvalidan) va belgilangan holatlar; qaysi guruhlarda davomat qilinmagan.
import { connectDB } from "./db";
import {
  attendanceGroupKey,
  attendanceGroups,
  attendanceOpen,
  attendanceOpensAt,
  attendanceSummary,
  isAttendanceStatus,
  type AttendanceGroup,
  type AttendanceStatus,
  type AttendanceStudent,
  type AttendanceSummary,
} from "./attendance-rules";
import { loadStudents, type StudentLean } from "./ledger";
import { Attendance } from "./models";
import { normalizeLessons, toMinutes, weekdayOfIso, type Clock } from "./schedule";
import { teacherNames } from "./staff";
import { dateToISO } from "./time";

export type AttendanceMarkView = { status: AttendanceStatus; note: string; by: string; at: string };

export type AttendanceDayGroup = AttendanceGroup & {
  teacherName: string;
  /** Davomat ochiladigan vaqt ("14:30") */
  opensAt: string;
  marks: Record<string, AttendanceMarkView>;
  summary: AttendanceSummary;
};

/** Kim ko'ryapti: o'qituvchi — faqat o'z o'quvchilari (teacherId), rahbar va administrator — hammasi. */
export type AttendanceViewer = { teacherId: string | null };

function toAttendanceStudent(s: StudentLean): AttendanceStudent {
  return {
    id: String(s._id),
    name: s.fullName,
    seq: s.seq ?? null,
    group: s.group ?? "",
    teacherId: s.teacher ? String(s.teacher) : null,
    lessons: normalizeLessons(s.lessons ?? []),
  };
}

/**
 * Shu kun davomati: dars jadvali bo'yicha guruhlar (faol, o'qishni boshlagan o'quvchilar) va belgilangan holatlar.
 * Jadvali keyin o'zgargan, lekin shu kuni belgilangan o'quvchilar — belgilangan paytdagi guruhida ko'rinadi.
 */
export async function attendanceDay(who: AttendanceViewer, date: string): Promise<AttendanceDayGroup[]> {
  return dayCached(who.teacherId, date);
}

// Bitta so'rov ichida (menyu hisoblagichi, qo'ng'iroqcha, sahifa) bir marta hisoblanadi
const dayCached = cache(async (teacherId: string | null, date: string): Promise<AttendanceDayGroup[]> => {
  const who = { teacherId };
  await connectDB();
  const all = await loadStudents();
  const visible = who.teacherId ? all.filter((s) => String(s.teacher ?? "") === who.teacherId) : all;
  const byId = new Map(visible.map((s) => [String(s._id), s]));
  const scheduled = visible.filter((s) => s.active !== false && dateToISO(s.startDate) <= date).map(toAttendanceStudent);
  const groups = attendanceGroups(scheduled, weekdayOfIso(date));

  const records = await Attendance.find({ date, student: { $in: visible.map((s) => s._id) } }).lean();
  const marks = new Map<string, AttendanceMarkView>();
  for (const r of records) {
    if (!isAttendanceStatus(r.status)) continue;
    marks.set(String(r.student), {
      status: r.status,
      note: r.note ?? "",
      by: r.markedByName ?? "",
      at: (r.updatedAt ?? r.createdAt ?? new Date()).toISOString(),
    });
  }
  const inGroup = new Set(groups.flatMap((g) => g.students.map((s) => s.id)));
  for (const r of records) {
    const id = String(r.student);
    const s = byId.get(id);
    if (!s || inGroup.has(id) || !r.start) continue;
    const teacherId = r.teacher ? String(r.teacher) : null;
    const key = attendanceGroupKey(r.start, r.end ?? "", r.group ?? "", teacherId);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, start: r.start, end: r.end ?? "", course: (r.group ?? "").trim(), teacherId, students: [] };
      groups.push(g);
    }
    g.students.push(toAttendanceStudent(s));
    inGroup.add(id);
  }
  groups.sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || a.course.localeCompare(b.course));

  const names = await teacherNames();
  return groups.map((g) => {
    const ids = g.students.map((s) => s.id);
    return {
      ...g,
      teacherName: g.teacherId ? (names.get(g.teacherId) ?? "") : "",
      opensAt: attendanceOpensAt(g.start),
      marks: Object.fromEntries(ids.flatMap((id) => (marks.has(id) ? [[id, marks.get(id)!]] : []))),
      summary: attendanceSummary(ids, (id) => marks.get(id)?.status),
    };
  });
});

export type PendingAttendance = {
  key: string;
  start: string;
  end: string;
  course: string;
  teacherName: string;
  /** Belgilanmagan o'quvchilar soni va guruhdagi jami */
  missing: number;
  total: number;
};

/** Bugun davomati ochilgan (dars boshlanib 30 daqiqa o'tgan), lekin to'liq qilinmagan guruhlar. */
export async function pendingAttendance(who: AttendanceViewer, clock: Pick<Clock, "iso" | "minutes">): Promise<PendingAttendance[]> {
  const groups = await attendanceDay(who, clock.iso);
  return groups
    .filter((g) => attendanceOpen(clock.iso, g.start, clock) && g.summary.missing > 0)
    .map((g) => ({ key: g.key, start: g.start, end: g.end, course: g.course, teacherName: g.teacherName, missing: g.summary.missing, total: g.summary.total }));
}

