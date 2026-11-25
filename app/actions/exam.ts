"use server";

// Imtihon: o'quvchiga ChatGPT bilan 10 ta savol (javoblari bilan) yaratish va ball qo'yish. Rahbar — hamma o'quvchiga,
// o'qituvchi — faqat o'z o'quvchilariga. Savollar faqat o'quvchi kursi mavzularidan; bitta o'quvchiga 10 daqiqada 1 marta,
// kuniga 5 marta.
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { buildExamPrompt, cleanTopics, courseFamily, EXAM_JSON_SCHEMA, examGenAllowed, isExamLevel, isExamMark, marksScore, normalizeQuestions, parseScore, topicLabel, type ExamMark, type ExamQuestion } from "@/lib/exam-rules";
import { isId } from "@/lib/ids";
import { examDay, type ExamGroup } from "@/lib/exam";
import { Exam, Student } from "@/lib/models";
import { openaiJson, OpenAIError, openaiModel } from "@/lib/openai";
import { isoToDate, todayISO } from "@/lib/time";

type Who = Awaited<ReturnType<typeof requireRole>>;

/** Boshqa kun ro'yxati (sahifa yangilanmasdan almashadi). O'qituvchiga — faqat o'z o'quvchilari. */
export async function loadExamDay(date: string): Promise<{ ok: true; groups: ExamGroup[] } | { ok: false; error: string }> {
  const session = await requireRole(["owner", "teacher"]);
  if (!isoToDate(date)) return { ok: false, error: "Sana noto‘g‘ri" };
  return { ok: true, groups: await examDay(session.role === "teacher" ? session.staffId : null, date) };
}

/** O'quvchi (o'qituvchiga — faqat o'ziniki). */
async function studentFor(session: Who, studentId: string) {
  if (!isId(studentId)) return null;
  await connectDB();
  const s = await Student.findById(studentId, { fullName: 1, group: 1, teacher: 1 }).lean();
  if (!s) return null;
  if (session.role === "teacher" && String(s.teacher ?? "") !== session.staffId) return null;
  return s;
}

export type GenerateExamResult = { ok: true; questions: ExamQuestion[]; generatedAt: string; left: number } | { ok: false; error: string };

/**
 * 10 ta savol yaratish (yoki qayta yaratish): tanlangan mavzular va daraja bo'yicha. Shu kuni boshqa o'quvchilarga
 * berilgan savollar takrorlanmaydi. Qo'yilgan ball saqlanib qoladi.
 */
export async function generateExamQuestions(input: { date: string; studentId: string; topics: string[]; level: string }): Promise<GenerateExamResult> {
  const session = await requireRole(["owner", "teacher"], { fresh: true });
  if (!isoToDate(input.date)) return { ok: false, error: "Sana noto‘g‘ri" };
  const s = await studentFor(session, input.studentId);
  if (!s) return { ok: false, error: "O‘quvchi topilmadi" };
  // Faqat o'quvchi kursi mavzulari (masalan, kompyuter savodxonligi o'quvchisiga — HTML emas)
  const topics = cleanTopics(Array.isArray(input.topics) ? input.topics : [], courseFamily(s.group));
  if (!topics.length) return { ok: false, error: "Kamida bitta mavzuni tanlang (o‘quvchi kursi bo‘yicha)" };
  const level = isExamLevel(input.level) ? input.level : "medium";

  // Cheklov: bitta o'quvchiga 10 daqiqada 1 marta, kuniga 5 marta (Toshkent kuni)
  const now = new Date();
  const dayStart = isoToDate(todayISO())!;
  const logs = await Exam.find({ student: s._id, genLog: { $gte: dayStart } }, { genLog: 1 }).lean<{ genLog?: Date[] }[]>();
  const times = logs.flatMap((d) => (d.genLog ?? []).map((t) => new Date(t).getTime())).filter((t) => t >= dayStart.getTime());
  const allowed = examGenAllowed(times, now.getTime());
  if (!allowed.ok) return allowed;
  // Joy band qilinadi (ikki marta bosilsa ham bitta hisoblanadi); savol tuzilmasa — qaytariladi
  await Exam.updateOne(
    { date: input.date, student: s._id },
    { $push: { genLog: now }, $setOnInsert: { studentName: s.fullName, group: s.group ?? "", teacher: s.teacher ?? null, score: null, note: "" } },
    { upsert: true },
  );
  const release = () => Exam.updateOne({ date: input.date, student: s._id }, { $pull: { genLog: now } });

  const others = await Exam.find({ date: input.date, student: { $ne: s._id } }, { questions: 1 }).lean();
  const avoid = others.flatMap((d) => (d.questions ?? []).map((q) => q.question ?? "")).filter(Boolean);
  const prompt = buildExamPrompt({ topics, level, student: s.fullName, course: s.group ?? "", avoid });
  let questions: ExamQuestion[] | null = null;
  try {
    // Kamdan-kam 10 tadan kam qaytsa — bir marta qayta so'raladi
    for (let i = 0; i < 2 && !questions; i++) {
      questions = normalizeQuestions(await openaiJson({ ...prompt, schema: EXAM_JSON_SCHEMA }), topics);
    }
  } catch (err) {
    await release();
    if (err instanceof OpenAIError) return { ok: false, error: err.message };
    console.error("[exam] openai", err);
    return { ok: false, error: "Savollarni yaratib bo‘lmadi — qayta urinib ko‘ring" };
  }
  if (!questions) {
    await release();
    return { ok: false, error: "ChatGPT 10 ta savol qaytarmadi — qayta urinib ko‘ring" };
  }

  const generatedAt = new Date();
  await Exam.updateOne(
    { date: input.date, student: s._id },
    {
      // Yangi savollar — eski belgilar o'chadi (ball qo'lda qo'yilgan bo'lsa saqlanadi)
      $set: { studentName: s.fullName, group: s.group ?? "", teacher: s.teacher ?? null, topics, level, questions, marks: [], model: openaiModel(), generatedAt },
      $setOnInsert: { score: null, note: "" },
    },
    { upsert: true },
  );
  await logActivity(session, "exam.generate", `Imtihon savollari: ${s.fullName} — ${topics.map(topicLabel).join(", ")}`);
  return { ok: true, questions, generatedAt: generatedAt.toISOString(), left: allowed.left };
}

export type SaveMarksResult = { ok: true; score: number | null; scoredAt: string | null } | { ok: false; error: string };

/** Savollar bahosi (topdi / yarim / topolmadi): ball avtomatik — yig'indisi. */
export async function saveExamMarks(input: { date: string; studentId: string; marks: unknown[] }): Promise<SaveMarksResult> {
  const session = await requireRole(["owner", "teacher"], { fresh: true });
  if (!isoToDate(input.date)) return { ok: false, error: "Sana noto‘g‘ri" };
  const s = await studentFor(session, input.studentId);
  if (!s) return { ok: false, error: "O‘quvchi topilmadi" };
  const doc = await Exam.findOne({ date: input.date, student: s._id }, { questions: 1 }).lean();
  const count = doc?.questions?.length ?? 0;
  if (!count) return { ok: false, error: "Avval savollarni tuzing" };
  const raw = Array.isArray(input.marks) ? input.marks : [];
  if (raw.length !== count || !raw.every(isExamMark)) return { ok: false, error: "Belgilar noto‘g‘ri — sahifani yangilang" };
  const marks = raw as ExamMark[];
  const score = marksScore(marks);
  const scoredAt = score === null ? null : new Date();
  await Exam.updateOne({ _id: doc!._id }, { $set: { marks, score, scoredAt, scoredByName: session.name ?? "" } });
  return { ok: true, score, scoredAt: scoredAt?.toISOString() ?? null };
}

export type SaveScoreResult = { ok: true; score: number | null; scoredAt: string | null } | { ok: false; error: string };

/** Ball (va izoh) qo'yish. Bo'sh ball — o'chiriladi. Savollar yaratilmagan bo'lsa ham qo'yish mumkin. */
export async function saveExamScore(input: { date: string; studentId: string; score: string; note: string }): Promise<SaveScoreResult> {
  const session = await requireRole(["owner", "teacher"], { fresh: true });
  if (!isoToDate(input.date)) return { ok: false, error: "Sana noto‘g‘ri" };
  const parsed = parseScore(String(input.score ?? ""));
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const note = String(input.note ?? "").trim().slice(0, 500);
  const s = await studentFor(session, input.studentId);
  if (!s) return { ok: false, error: "O‘quvchi topilmadi" };
  const scoredAt = parsed.score === null ? null : new Date();
  await Exam.updateOne(
    { date: input.date, student: s._id },
    {
      $set: { studentName: s.fullName, group: s.group ?? "", teacher: s.teacher ?? null, score: parsed.score, note, scoredAt, scoredByName: session.name ?? "" },
    },
    { upsert: true },
  );
  await logActivity(session, "exam.score", `Imtihon bali: ${s.fullName} — ${parsed.score === null ? "o‘chirildi" : parsed.score}`);
  return { ok: true, score: parsed.score, scoredAt: scoredAt?.toISOString() ?? null };
}
