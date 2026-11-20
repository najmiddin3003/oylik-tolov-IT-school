// Imtihon: mavzular, savollar tekshiruvi, ball va AI uchun so'rov matni (sof funksiyalar — server, brauzer va testlarda).

export const EXAM_TOPICS = [
  { key: "html", label: "HTML" },
  { key: "css", label: "CSS" },
  { key: "javascript", label: "JavaScript" },
  { key: "react", label: "React" },
  { key: "nextjs", label: "Next.js" },
  { key: "tailwindcss", label: "Tailwind CSS" },
] as const;

export type ExamTopic = (typeof EXAM_TOPICS)[number]["key"];

export const EXAM_LEVELS = [
  { key: "easy", label: "Oson", hint: "boshlang‘ich: asosiy tushunchalar va sintaksis" },
  { key: "medium", label: "O‘rta", hint: "amaliy: kod o‘qish, farqlar, odatiy vazifalar" },
  { key: "hard", label: "Qiyin", hint: "chuqur: ichki ishlash, nozik holatlar, eng yaxshi amaliyot" },
] as const;

export type ExamLevel = (typeof EXAM_LEVELS)[number]["key"];

/** Har bir o'quvchiga savollar soni */
export const EXAM_QUESTION_COUNT = 10;
/** Ball: 0 dan shu qiymatgacha (odatda 10 savol × 1 ball; 100 ballik tizim ham sig'adi) */
export const EXAM_SCORE_MAX = 100;

export type ExamQuestion = { topic: string; question: string; answer: string };

export function isExamTopic(v: unknown): v is ExamTopic {
  return typeof v === "string" && EXAM_TOPICS.some((t) => t.key === v);
}

export function isExamLevel(v: unknown): v is ExamLevel {
  return typeof v === "string" && EXAM_LEVELS.some((l) => l.key === v);
}

export const topicLabel = (k: string) => EXAM_TOPICS.find((t) => t.key === k)?.label ?? k;

/** Tanlangan mavzular: faqat ma'lumlari, takrorsiz, ro'yxatdagi tartibda. */
export function cleanTopics(raw: unknown[]): ExamTopic[] {
  const set = new Set(raw.filter(isExamTopic));
  return EXAM_TOPICS.map((t) => t.key).filter((k) => set.has(k));
}

/** 10 savol mavzular bo'yicha teng taqsimlanadi: 3 mavzu -> 4, 3, 3. */
export function topicPlan(topics: ExamTopic[], total = EXAM_QUESTION_COUNT): { topic: ExamTopic; count: number }[] {
  if (!topics.length) return [];
  const base = Math.floor(total / topics.length);
  const extra = total % topics.length;
  return topics.map((topic, i) => ({ topic, count: base + (i < extra ? 1 : 0) })).filter((p) => p.count > 0);
}

/** Ball: bo'sh — hali qo'yilmagan (null); 0..100, yarim ballgacha. Noto'g'ri bo'lsa — xato matni. */
export function parseScore(raw: string): { score: number | null } | { error: string } {
  const s = raw.trim().replace(",", ".");
  if (!s) return { score: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > EXAM_SCORE_MAX) return { error: `Ball 0 dan ${EXAM_SCORE_MAX} gacha bo‘lishi kerak` };
  if (Math.round(n * 2) !== n * 2) return { error: "Ball butun yoki yarim (masalan, 7.5) bo‘lishi kerak" };
  return { score: n };
}

/** AI javobini tekshirish: aynan 10 ta to'liq savol-javob; matnlar kesiladi. */
export function normalizeQuestions(raw: unknown, topics: ExamTopic[]): ExamQuestion[] | null {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return null;
  const out: ExamQuestion[] = [];
  for (const q of list) {
    const r = q as Partial<Record<keyof ExamQuestion, unknown>>;
    const question = typeof r.question === "string" ? r.question.trim() : "";
    const answer = typeof r.answer === "string" ? r.answer.trim() : "";
    if (!question || !answer) continue;
    const t = typeof r.topic === "string" ? r.topic.toLowerCase().replace(/[^a-z]/g, "") : "";
    const topic = topics.find((k) => k === t) ?? topics.find((k) => t.includes(k)) ?? topics[0];
    out.push({ topic, question: question.slice(0, 1200), answer: answer.slice(0, 2000) });
  }
  return out.length >= EXAM_QUESTION_COUNT ? out.slice(0, EXAM_QUESTION_COUNT) : null;
}

/**
 * ChatGPT uchun so'rov: o'zbek tilida (lotin), mavzular bo'yicha taqsimot, daraja. Shu kuni boshqa o'quvchilarga
 * berilgan savollar (`avoid`) takrorlanmasligi so'raladi — har kimga alohida savollar (ko'chirib bo'lmaydi).
 */
export function buildExamPrompt(v: { topics: ExamTopic[]; level: ExamLevel; student: string; course: string; avoid: string[] }): { system: string; user: string } {
  const level = EXAM_LEVELS.find((l) => l.key === v.level)!;
  const plan = topicPlan(v.topics)
    .map((p) => `- ${topicLabel(p.topic)}: ${p.count} ta savol (topic: "${p.topic}")`)
    .join("\n");
  const avoid = v.avoid.slice(0, 60).map((q) => `- ${q.replace(/\s+/g, " ").slice(0, 160)}`);
  const system =
    "Sen IT o‘quv markazida frontend dasturlash bo‘yicha og‘zaki imtihon savollarini tuzadigan tajribali o‘qituvchisan. " +
    "Barcha savol va javoblarni o‘zbek tilida (lotin yozuvida) yoz; texnik atamalar va kod inglizcha qolsin. " +
    "Savollar aniq, bir ma’noli, o‘qituvchi o‘quvchiga og‘zaki bera oladigan bo‘lsin. Javob — qisqa va to‘g‘ri (1–3 gap, kerak bo‘lsa qisqa kod), " +
    "o‘qituvchi o‘quvchi javobini tez solishtira olishi uchun.";
  const user = [
    `O‘quvchi: ${v.student}${v.course ? ` (kurs: ${v.course})` : ""}.`,
    `Daraja: ${level.label} — ${level.hint}.`,
    `Jami aynan ${EXAM_QUESTION_COUNT} ta savol, mavzular bo‘yicha:`,
    plan,
    "Savollar turli-tuman bo‘lsin: nazariya, kod natijasini topish, xatoni topish, amaliy vazifa. Bir xil narsani ikki marta so‘rama.",
    avoid.length ? `Bu savollar boshqa o‘quvchilarga berilgan — ularni va ularga juda o‘xshashlarini TAKRORLAMA:\n${avoid.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}

/** OpenAI «structured output» sxemasi: { questions: [{ topic, question, answer }] } */
export const EXAM_JSON_SCHEMA = {
  name: "exam_questions",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["topic", "question", "answer"],
          properties: {
            topic: { type: "string", enum: EXAM_TOPICS.map((t) => t.key) },
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
      },
    },
  },
} as const;
