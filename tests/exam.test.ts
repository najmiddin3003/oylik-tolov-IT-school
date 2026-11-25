import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExamPrompt, cleanTopics, normalizeQuestions, parseScore, topicPlan } from "../lib/exam-rules";

test("imtihon: mavzular va taqsimot", () => {
  assert.deepEqual(cleanTopics(["react", "x", "html", "react"]), ["html", "react"], "faqat ma'lumlari, tartibda, takrorsiz");
  assert.deepEqual(topicPlan(["html", "css", "javascript"]), [
    { topic: "html", count: 4 },
    { topic: "css", count: 3 },
    { topic: "javascript", count: 3 },
  ]);
  assert.equal(topicPlan(["html", "css", "javascript", "react", "nextjs", "tailwindcss"]).reduce((s, p) => s + p.count, 0), 10);
  assert.deepEqual(topicPlan([]), []);
});

test("imtihon: ball", () => {
  assert.deepEqual(parseScore(""), { score: null });
  assert.deepEqual(parseScore("8"), { score: 8 });
  assert.deepEqual(parseScore("7,5"), { score: 7.5 });
  assert.ok("error" in parseScore("-1"));
  assert.ok("error" in parseScore("101"));
  assert.ok("error" in parseScore("7.3"));
  assert.ok("error" in parseScore("abc"));
});

test("imtihon: AI javobini tekshirish va so'rov", () => {
  const q = (i: number, topic = "css") => ({ topic, question: ` Savol ${i} `, answer: `Javob ${i}` });
  const ten = { questions: Array.from({ length: 12 }, (_, i) => q(i)) };
  const out = normalizeQuestions(ten, ["html", "css"])!;
  assert.equal(out.length, 10, "ortig'i tashlanadi");
  assert.equal(out[0].question, "Savol 0");
  assert.equal(normalizeQuestions({ questions: [q(1), { topic: "css", question: "", answer: "x" }] }, ["css"]), null, "10 tadan kam — yaroqsiz");
  assert.equal(normalizeQuestions({ questions: Array.from({ length: 10 }, (_, i) => q(i, "Next.js")) }, ["nextjs"])![0].topic, "nextjs");
  assert.equal(normalizeQuestions(null, ["css"]), null);
  const p = buildExamPrompt({ topics: ["html", "react"], level: "hard", student: "Ali Valiyev", course: "Web", avoid: ["Eski savol?"] });
  assert.match(p.user, /HTML: 5 ta savol/);
  assert.match(p.user, /React: 5 ta savol/);
  assert.match(p.user, /Qiyin/);
  assert.match(p.user, /Eski savol\?/);
});

test("imtihon: savol belgilari va avtomatik ball", async () => {
  const { marksScore, marksSummary, normalizeMarks } = await import("../lib/exam-rules");
  assert.deepEqual(normalizeMarks([1, 0.5, "x", 0], 5), [1, 0.5, null, 0, null]);
  assert.deepEqual(normalizeMarks(null, 2), [null, null]);
  assert.equal(marksScore([1, 1, 0.5, 0, null]), 2.5);
  assert.equal(marksScore([null, null]), null, "hech biri belgilanmagan — ball yo'q");
  assert.equal(marksScore([0, 0]), 0);
  assert.deepEqual(marksSummary([1, 0.5, 0, null, 1]), { right: 2, half: 1, wrong: 1, left: 1 });
});

test("imtihon: kurs bo'yicha mavzular va savol tuzish cheklovi", async () => {
  const { courseFamily, cleanTopics, defaultTopics, examGenAllowed, buildExamPrompt } = await import("../lib/exam-rules");
  assert.equal(courseFamily("Web dasturlash"), "web");
  assert.equal(courseFamily("Kompyuter savodxonligi"), "computer");
  assert.equal(courseFamily("Grafik dizayn"), "design");
  assert.equal(courseFamily("Ingliz tili"), "general");
  assert.deepEqual(cleanTopics(["html", "excel", "word"], "computer"), ["word", "excel"], "boshqa kurs mavzusi tashlanadi");
  assert.deepEqual(defaultTopics("design"), ["designbasics", "photoshop", "illustrator"]);
  const p = buildExamPrompt({ topics: ["word"], level: "easy", student: "Ali", course: "Kompyuter savodxonligi", avoid: [] });
  assert.match(p.system, /kompyuter savodxonligi/);
  assert.doesNotMatch(p.system, /frontend/);

  const min = 60_000;
  const now = 100 * min;
  assert.deepEqual(examGenAllowed([], now), { ok: true, left: 4 });
  const r1 = examGenAllowed([now - 3 * min], now);
  assert.ok(!r1.ok && /7 daqiqadan/.test(r1.error), "10 daqiqada 1 marta");
  assert.deepEqual(examGenAllowed([now - 10 * min], now), { ok: true, left: 3 });
  const r2 = examGenAllowed([1, 2, 3, 4, 5].map((i) => now - i * 20 * min), now);
  assert.ok(!r2.ok && /bugungi limit/.test(r2.error), "kuniga 5 marta");
});
