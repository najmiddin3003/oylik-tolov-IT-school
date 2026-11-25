// Imtihon: mavzular, savollar tekshiruvi, ball va AI uchun so'rov matni (sof funksiyalar — server, brauzer va testlarda).

/** Kurs yo'nalishlari: har bir o'quvchiga faqat o'z kursi mavzularidan savol tuziladi. */
export const EXAM_FAMILIES = [
  { key: "web", label: "Web dasturlash", role: "frontend (web) dasturlash" },
  { key: "computer", label: "Kompyuter savodxonligi", role: "kompyuter savodxonligi (Windows, MS Office, Internet)" },
  { key: "design", label: "Grafik dizayn", role: "grafik dizayn" },
  { key: "general", label: "Boshqa kurs", role: "shu kurs" },
] as const;

export type ExamFamily = (typeof EXAM_FAMILIES)[number]["key"];

export const EXAM_TOPICS = [
  { key: "html", label: "HTML", family: "web" },
  { key: "css", label: "CSS", family: "web" },
  { key: "javascript", label: "JavaScript", family: "web" },
  { key: "react", label: "React", family: "web" },
  { key: "nextjs", label: "Next.js", family: "web" },
  { key: "tailwindcss", label: "Tailwind CSS", family: "web" },
  { key: "windows", label: "Windows", family: "computer" },
  { key: "word", label: "MS Word", family: "computer" },
  { key: "excel", label: "MS Excel", family: "computer" },
  { key: "powerpoint", label: "PowerPoint", family: "computer" },
  { key: "internet", label: "Internet va xavfsizlik", family: "computer" },
  { key: "typing", label: "Klaviatura va tez yozish", family: "computer" },
  { key: "designbasics", label: "Dizayn asoslari", family: "design" },
  { key: "photoshop", label: "Photoshop", family: "design" },
  { key: "illustrator", label: "Illustrator", family: "design" },
  { key: "coreldraw", label: "CorelDRAW", family: "design" },
  { key: "figma", label: "Figma", family: "design" },
  { key: "coursebasics", label: "Kurs mavzulari", family: "general" },
] as const;

export type ExamTopic = (typeof EXAM_TOPICS)[number]["key"];

/** Kurs nomidan yo'nalish: "Web dasturlash" -> web, "Kompyuter savodxonligi" -> computer, "Grafik dizayn" -> design. */
export function courseFamily(course: string | null | undefined): ExamFamily {
  const c = String(course ?? "").toLowerCase();
  if (/web|front|dastur|program|react|javascript/.test(c)) return "web";
  if (/savod|kompyuter|komputer|computer|office/.test(c)) return "computer";
  if (/grafik|dizayn|design|photoshop|figma/.test(c)) return "design";
  return "general";
}

/** Yo'nalish mavzulari (ro'yxatdagi tartibda). */
export function familyTopics(family: ExamFamily): (typeof EXAM_TOPICS)[number][] {
  return EXAM_TOPICS.filter((t) => t.family === family);
}

/** Yo'nalish bo'yicha boshlang'ich tanlov: birinchi 3 mavzu. */
export function defaultTopics(family: ExamFamily): ExamTopic[] {
  return familyTopics(family)
    .slice(0, 3)
    .map((t) => t.key);
}

/** Bitta o'quvchiga savol tuzish cheklovi: shuncha daqiqada bir marta va kuniga shuncha marta. */
export const EXAM_GEN_INTERVAL_MIN = 10;
export const EXAM_GEN_PER_DAY = 5;

/**
 * Savol tuzish mumkinmi: `times` — shu o'quvchiga bugun (Toshkent kuni) tuzilgan vaqtlar (ms). Mumkin bo'lmasa — sababi.
 */
export function examGenAllowed(times: number[], now: number): { ok: true; left: number } | { ok: false; error: string } {
  const today = times.filter((t) => t <= now);
  if (today.length >= EXAM_GEN_PER_DAY) return { ok: false, error: `Bu o‘quvchiga bugungi limit tugadi (kuniga ${EXAM_GEN_PER_DAY} marta) — ertaga qayta tuzish mumkin` };
  const last = Math.max(0, ...today);
  const wait = last + EXAM_GEN_INTERVAL_MIN * 60_000 - now;
  if (wait > 0) {
    const min = Math.ceil(wait / 60_000);
    return { ok: false, error: `Bu o‘quvchiga ${EXAM_GEN_INTERVAL_MIN} daqiqada bir marta savol tuziladi — ${min} daqiqadan keyin qayta urinib ko‘ring` };
  }
  return { ok: true, left: EXAM_GEN_PER_DAY - today.length - 1 };
}

export const EXAM_LEVELS = [
  { key: "easy", label: "Oson", hint: "boshlang‘ich: asosiy tushunchalar" },
  { key: "medium", label: "O‘rta", hint: "amaliy: farqlar, odatiy vazifalar" },
  { key: "hard", label: "Qiyin", hint: "chuqur: nozik holatlar, eng yaxshi amaliyot" },
] as const;

export type ExamLevel = (typeof EXAM_LEVELS)[number]["key"];

/** Har bir o'quvchiga savollar soni */
export const EXAM_QUESTION_COUNT = 10;
/** Ball: 0 dan shu qiymatgacha (odatda 10 savol × 1 ball; 100 ballik tizim ham sig'adi) */
export const EXAM_SCORE_MAX = 100;

export type ExamQuestion = { topic: string; question: string; answer: string };

/** Savol bahosi: topdi — 1, yarim — 0.5, topolmadi — 0; belgilanmagan — null */
export type ExamMark = 1 | 0.5 | 0 | null;
export const EXAM_MARKS = [
  { value: 1, label: "Topdi", tone: "emerald" },
  { value: 0.5, label: "Yarim", tone: "amber" },
  { value: 0, label: "Topolmadi", tone: "rose" },
] as const;

export function isExamMark(v: unknown): v is ExamMark {
  return v === null || v === 1 || v === 0.5 || v === 0;
}

/** Belgilar savollar soniga moslanadi (yetmasa — null, ortig'i tashlanadi; noto'g'ri qiymat — null). */
export function normalizeMarks(raw: unknown, count: number): ExamMark[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: count }, (_, i) => (isExamMark(list[i]) ? (list[i] as ExamMark) : null));
}

/** Avtomatik ball: belgilangan savollar yig'indisi; hech biri belgilanmagan bo'lsa — null. */
export function marksScore(marks: ExamMark[]): number | null {
  const set = marks.filter((m): m is 1 | 0.5 | 0 => m !== null);
  return set.length ? set.reduce<number>((s, m) => s + m, 0) : null;
}

/** "topdi 7 · yarim 1 · topolmadi 1 · belgilanmagan 1" uchun sonlar */
export function marksSummary(marks: ExamMark[]): { right: number; half: number; wrong: number; left: number } {
  return {
    right: marks.filter((m) => m === 1).length,
    half: marks.filter((m) => m === 0.5).length,
    wrong: marks.filter((m) => m === 0).length,
    left: marks.filter((m) => m === null).length,
  };
}

export function isExamTopic(v: unknown): v is ExamTopic {
  return typeof v === "string" && EXAM_TOPICS.some((t) => t.key === v);
}

export function isExamLevel(v: unknown): v is ExamLevel {
  return typeof v === "string" && EXAM_LEVELS.some((l) => l.key === v);
}

export const topicLabel = (k: string) => EXAM_TOPICS.find((t) => t.key === k)?.label ?? k;

/** Tanlangan mavzular: faqat ma'lumlari (yo'nalish berilsa — faqat o'shaniki), takrorsiz, ro'yxatdagi tartibda. */
export function cleanTopics(raw: unknown[], family?: ExamFamily): ExamTopic[] {
  const set = new Set(raw.filter(isExamTopic));
  return EXAM_TOPICS.filter((t) => !family || t.family === family)
    .map((t) => t.key)
    .filter((k) => set.has(k));
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
  const family = EXAM_FAMILIES.find((f) => f.key === courseFamily(v.course))!;
  const subject = family.key === "general" && v.course ? `«${v.course}» kursi` : family.role;
  const system =
    `Sen IT o‘quv markazida ${subject} bo‘yicha og‘zaki imtihon savollarini tuzadigan tajribali o‘qituvchisan. ` +
    "Barcha savol va javoblarni o‘zbek tilida (lotin yozuvida) yoz; texnik atamalar va kod inglizcha qolsin. " +
    "Savollar aniq, bir ma’noli, o‘qituvchi o‘quvchiga og‘zaki bera oladigan bo‘lsin. Javob — qisqa va to‘g‘ri (1–3 gap, kerak bo‘lsa qisqa kod), " +
    "o‘qituvchi o‘quvchi javobini tez solishtira olishi uchun.";
  const user = [
    `O‘quvchi: ${v.student}${v.course ? ` (kurs: ${v.course})` : ""}.`,
    `Daraja: ${level.label} — ${level.hint}.`,
    `Jami aynan ${EXAM_QUESTION_COUNT} ta savol, mavzular bo‘yicha:`,
    plan,
    family.key === "web"
      ? "Savollar turli-tuman bo‘lsin: nazariya, kod natijasini topish, xatoni topish, amaliy vazifa. Bir xil narsani ikki marta so‘rama."
      : "Savollar turli-tuman bo‘lsin: nazariya, amaliy vazifa (dasturda qanday bajariladi), qisqa tugmalar va menyular, odatiy xatolar. Bir xil narsani ikki marta so‘rama.",
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
