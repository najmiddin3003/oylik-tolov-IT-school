"use server";

// Davomat: guruhdagi har bir o'quvchi — keldi / kelmadi / sababli. «Kelmadi» va «Sababli» uchun izoh majburiy.
import mongoose from "mongoose";
import { logActivity } from "@/lib/activity";
import { dataChanged } from "@/lib/after-change";
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_NOTE_MAX,
  attendanceOpen,
  attendanceOpensAt,
  attendanceSummary,
  isAttendanceStatus,
  needsNote,
  validateAttendance,
  type AttendanceMark,
} from "@/lib/attendance-rules";
import { requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isId } from "@/lib/ids";
import { Attendance, Student } from "@/lib/models";
import { isTime, tashkentClock } from "@/lib/schedule";
import { formatDate, isoToDate, nowMs } from "@/lib/time";
import type { FormState } from "./types";

const MAX_STUDENTS = 300;

export async function saveAttendance(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireRole(["owner", "admin", "teacher"], { fresh: true });
  const date = String(fd.get("date") ?? "");
  const start = String(fd.get("start") ?? "");
  const end = String(fd.get("end") ?? "");
  const ids = [...new Set(fd.getAll("id").map(String))].filter(isId).slice(0, MAX_STUDENTS);
  if (!isoToDate(date) || !isTime(start) || (end && !isTime(end)) || !ids.length) return { error: "Davomat ma’lumoti noto‘g‘ri — sahifani yangilang" };

  const clock = tashkentClock(nowMs());
  if (date > clock.iso) return { error: "Kelgusi kun uchun davomat qilib bo‘lmaydi" };
  if (!attendanceOpen(date, start, clock)) {
    return { error: `Davomat dars boshlanganidan 30 daqiqa o‘tib ochiladi — bugun ${attendanceOpensAt(start)} dan` };
  }

  const marks: Record<string, AttendanceMark> = {};
  for (const id of ids) {
    marks[id] = { status: String(fd.get(`status_${id}`) ?? ""), note: String(fd.get(`note_${id}`) ?? "").trim().slice(0, ATTENDANCE_NOTE_MAX) };
  }
  const fieldErrors = validateAttendance(ids, marks);
  if (Object.keys(fieldErrors).length) {
    const noStatus = Object.keys(fieldErrors).filter((k) => k.startsWith("status_")).length;
    const noNote = Object.keys(fieldErrors).length - noStatus;
    return {
      fieldErrors,
      error: [noStatus ? `${noStatus} ta o‘quvchiga holat tanlanmagan` : "", noNote ? `${noNote} ta o‘quvchiga izoh yozilmagan («Kelmadi» va «Sababli» uchun majburiy)` : ""]
        .filter(Boolean)
        .join("; "),
    };
  }

  await connectDB();
  const students = await Student.find({ _id: { $in: ids } }, { fullName: 1, group: 1, teacher: 1 }).lean();
  if (students.length !== ids.length) return { error: "Ba’zi o‘quvchilar topilmadi — sahifani yangilang" };
  // O'qituvchi — faqat o'z o'quvchilari davomatini qiladi
  if (session.role === "teacher" && students.some((s) => String(s.teacher ?? "") !== session.staffId)) {
    return { error: "Faqat o‘z o‘quvchilaringiz davomatini qila olasiz" };
  }

  const by = { markedByRole: session.role, markedByStaff: session.staffId, markedByName: session.name ?? "" };
  await Attendance.bulkWrite(
    students.map((s) => {
      const m = marks[String(s._id)];
      const status = isAttendanceStatus(m.status) ? m.status : "present";
      return {
        updateOne: {
          filter: { student: s._id, date },
          update: {
            $set: {
              status,
              note: needsNote(status) ? m.note : "",
              start,
              end,
              group: s.group ?? "",
              teacher: s.teacher ? new mongoose.Types.ObjectId(String(s.teacher)) : null,
              ...by,
            },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );

  const sum = attendanceSummary(ids, (id) => (isAttendanceStatus(marks[id]?.status) ? (marks[id].status as "present" | "absent" | "excused") : null));
  const course = students[0]?.group?.trim() || "guruh";
  const counts = (["present", "absent", "excused"] as const)
    .filter((k) => sum[k])
    .map((k) => `${ATTENDANCE_LABEL[k].toLowerCase()} ${sum[k]}`)
    .join(", ");
  await logActivity(session, "attendance.save", `Davomat: ${course}, ${formatDate(date)} ${start} — ${counts}`);
  await dataChanged();
  return { ok: true, message: `Davomat saqlandi: ${counts}`, nonce: Date.now() };
}

/** «Kelmadi» belgilangan o'quvchi bilan gaplashildi: sababi (izoh majburiy) yoziladi, eslatma yopiladi. */
export async function resolveFollowUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireRole(["owner", "admin", "teacher"], { fresh: true });
  const id = String(fd.get("id") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  if (!isId(id)) return { error: "Yozuv topilmadi — sahifani yangilang" };
  if (!note) return { fieldErrors: { note: "Nima gaplashildi — izoh yozing" } };
  await connectDB();
  const a = await Attendance.findOne({ _id: id, status: "absent" }, { student: 1, date: 1, followUpAt: 1 })
    .populate<{ student: { _id: mongoose.Types.ObjectId; fullName: string; teacher?: mongoose.Types.ObjectId | null } | null }>("student", "fullName teacher")
    .lean();
  if (!a?.student) return { error: "Yozuv topilmadi — sahifani yangilang" };
  if (session.role === "teacher" && String(a.student.teacher ?? "") !== session.staffId) return { error: "Faqat o‘z o‘quvchilaringiz uchun" };
  await Attendance.updateOne(
    { _id: id },
    { $set: { followUpAt: new Date(), followUpNote: note, followUpByName: session.name ?? "", followUpByStaff: session.staffId } },
  );
  await logActivity(session, "attendance.followup", `Gaplashildi: ${a.student.fullName} (${formatDate(a.date)} kelmagan) — ${note}`);
  await dataChanged();
  return { ok: true, message: "Saqlandi", nonce: Date.now() };
}
