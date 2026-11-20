import "server-only";
// Imtihon kuni: dars jadvali bo'yicha shu kuni keladigan o'quvchilar (davomat guruhlari bilan bir xil) va ularning
// AI savollari va ballari.
import { attendanceDay } from "./attendance";
import type { AttendanceStatus } from "./attendance-rules";
import { connectDB } from "./db";
import { isExamLevel, type ExamLevel, type ExamQuestion } from "./exam-rules";
import { Exam } from "./models";

export type ExamStudentRow = {
  id: string;
  name: string;
  seq: number | null;
  /** Shu kungi davomat (belgilangan bo'lsa) */
  attendance: AttendanceStatus | null;
  exam: {
    topics: string[];
    level: ExamLevel;
    questions: ExamQuestion[];
    generatedAt: string | null;
    score: number | null;
    note: string;
    scoredAt: string | null;
    scoredByName: string;
  } | null;
};

export type ExamGroup = {
  key: string;
  start: string;
  end: string;
  course: string;
  teacherName: string;
  students: ExamStudentRow[];
};

/** Shu kun imtihoni: guruhlar (dars vaqti bo'yicha) va har bir o'quvchining savollari/bali. O'qituvchiga — faqat o'ziniki. */
export async function examDay(teacherId: string | null, date: string): Promise<ExamGroup[]> {
  await connectDB();
  const groups = await attendanceDay({ teacherId }, date);
  const ids = groups.flatMap((g) => g.students.map((s) => s.id));
  const docs = ids.length ? await Exam.find({ date, student: { $in: ids } }).lean() : [];
  const by = new Map(docs.map((d) => [String(d.student), d]));
  return groups.map((g) => ({
    key: g.key,
    start: g.start,
    end: g.end,
    course: g.course,
    teacherName: g.teacherName,
    students: g.students.map((s) => {
      const d = by.get(s.id);
      return {
        id: s.id,
        name: s.name,
        seq: s.seq,
        attendance: g.marks[s.id]?.status ?? null,
        exam: d
          ? {
              topics: d.topics ?? [],
              level: isExamLevel(d.level) ? d.level : "medium",
              questions: (d.questions ?? []).map((q) => ({ topic: q.topic ?? "", question: q.question ?? "", answer: q.answer ?? "" })),
              generatedAt: d.generatedAt ? d.generatedAt.toISOString() : null,
              score: typeof d.score === "number" ? d.score : null,
              note: d.note ?? "",
              scoredAt: d.scoredAt ? d.scoredAt.toISOString() : null,
              scoredByName: d.scoredByName ?? "",
            }
          : null,
      };
    }),
  }));
}
