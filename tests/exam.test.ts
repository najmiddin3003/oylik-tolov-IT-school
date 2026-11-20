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
