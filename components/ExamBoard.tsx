"use client";

// Imtihon sahifasi: mavzular (galochka) va daraja, har bir o'quvchiga ChatGPT bilan 10 ta savol (javoblari bilan)
// va ball. Mavzu/daraja tanlovi brauzerda eslab qolinadi; o'quvchiga alohida mavzu tanlash ham mumkin.
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, Clock, Eye, EyeOff, GraduationCap, Loader2, RefreshCw, Sparkles, Users } from "lucide-react";
import { generateExamQuestions, saveExamScore } from "@/app/actions/exam";
import type { ExamGroup, ExamStudentRow } from "@/lib/exam";
import { cleanTopics, EXAM_LEVELS, EXAM_QUESTION_COUNT, EXAM_TOPICS, isExamLevel, topicLabel, type ExamLevel, type ExamQuestion, type ExamTopic } from "@/lib/exam-rules";
import type { Role } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { studentHref } from "./FollowUps";
import { Avatar, btn, cx, inputCls, studentCode, Tag } from "./ui";

const STORE = "tt-exam-setup";
const DEFAULT_TOPICS: ExamTopic[] = ["html", "css", "javascript"];

type Exam = NonNullable<ExamStudentRow["exam"]>;
type Setup = { topics: ExamTopic[]; level: ExamLevel };

const ATT = { present: { label: "Keldi", tone: "emerald" }, absent: { label: "Kelmadi", tone: "rose" }, excused: { label: "Sababli", tone: "amber" } } as const;

export function ExamBoard({ date, groups, aiReady, role }: { date: string; groups: ExamGroup[]; aiReady: boolean; role: Role }) {
  const [setup, setSetup] = useState<Setup>({ topics: DEFAULT_TOPICS, level: "medium" });
  const [showAnswers, setShowAnswers] = useState(true);
  // Har bir o'quvchi imtihoni (yaratilgan savollar va ball) — server ma'lumotidan, keyin shu yerda yangilanadi
  const [exams, setExams] = useState<Record<string, Exam | null>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.students.map((s) => [s.id, s.exam]))),
  );
  // Guruhga ketma-ket yaratish: navbatdagi o'quvchi
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulk, setBulk] = useState<{ group: string; left: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<Setup> | null;
      if (!raw) return;
      const topics = cleanTopics(Array.isArray(raw.topics) ? raw.topics : []);
      const t = window.setTimeout(() => setSetup({ topics: topics.length ? topics : DEFAULT_TOPICS, level: isExamLevel(raw.level) ? raw.level : "medium" }), 0);
      return () => window.clearTimeout(t);
    } catch {
      // eslab qolinmagan — standart
    }
  }, []);
  const update = (next: Setup) => {
    setSetup(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // saqlab bo'lmasa — faqat shu sahifada
    }
  };

  const generate = async (studentId: string, topics: ExamTopic[], level: ExamLevel) => {
    setBusy((b) => ({ ...b, [studentId]: true }));
    setErrors((e) => ({ ...e, [studentId]: "" }));
    const res = await generateExamQuestions({ date, studentId, topics, level }).catch(() => ({ ok: false as const, error: "Tarmoq xatosi — qayta urinib ko‘ring" }));
    if (res.ok) {
      setExams((x) => {
        const prev = x[studentId];
        return {
          ...x,
          [studentId]: {
            topics,
            level,
            questions: res.questions,
            generatedAt: res.generatedAt,
            score: prev?.score ?? null,
            note: prev?.note ?? "",
            scoredAt: prev?.scoredAt ?? null,
            scoredByName: prev?.scoredByName ?? "",
          },
        };
      });
    } else setErrors((e) => ({ ...e, [studentId]: res.error }));
    setBusy((b) => ({ ...b, [studentId]: false }));
    return res.ok;
  };

  const generateGroup = async (g: ExamGroup) => {
    const todo = g.students.filter((s) => !exams[s.id]?.questions.length && s.attendance !== "absent" && s.attendance !== "excused");
    for (let i = 0; i < todo.length; i++) {
      setBulk({ group: g.key, left: todo.length - i });
      const ok = await generate(todo[i].id, setup.topics, setup.level);
      if (!ok) break;
    }
    setBulk(null);
  };

  const all = groups.flatMap((g) => g.students);
  const generated = all.filter((s) => exams[s.id]?.questions.length).length;
  const scored = all.map((s) => exams[s.id]?.score).filter((x): x is number => typeof x === "number");
  const avg = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;

  return (
    <div className="grid gap-5">
      {!aiReady ? (
        <p className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          ChatGPT kaliti hali kiritilmagan — savol yaratish ishlamaydi (ballni qo‘yish mumkin). Vercel → Settings → Environment Variables:{" "}
          <code className="rounded bg-white px-1">OPENAI_API_KEY</code>, keyin Redeploy.
        </p>
      ) : null}

      {/* Sozlama: mavzular va daraja — barcha o'quvchilar uchun standart */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
              <Sparkles className="size-5 text-violet-600" aria-hidden />
              Savollar qaysi mavzulardan
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Har bir o‘quvchiga {EXAM_QUESTION_COUNT} ta savol — tanlangan mavzulardan teng taqsimlanadi. O‘quvchilarga savollar har xil chiqadi.
            </p>
          </div>
          <button type="button" onClick={() => setShowAnswers((v) => !v)} className={cx(btn.outline, "h-10")}>
            {showAnswers ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {showAnswers ? "Javoblarni yashirish" : "Javoblarni ko‘rsatish"}
          </button>
        </div>
        <TopicPicker value={setup.topics} onChange={(topics) => update({ ...setup, topics })} className="mt-4" />
        <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Daraja">
          <span className="mr-1 text-sm font-medium text-ink-600">Daraja:</span>
          {EXAM_LEVELS.map((l) => (
            <button
              key={l.key}
              type="button"
              role="radio"
              aria-checked={setup.level === l.key}
              onClick={() => update({ ...setup, level: l.key })}
              title={l.hint}
              className={cx(
                "h-9 rounded-xl px-3.5 text-sm font-semibold ring-1 ring-inset transition",
                setup.level === l.key ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-600 ring-line hover:bg-slate-50",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="num mt-4 flex flex-wrap gap-2 text-sm">
          <Tag tone="slate">{all.length} ta o‘quvchi</Tag>
          <Tag tone="brand">Savol tuzilgan: {generated}</Tag>
          <Tag tone="emerald">Baholangan: {scored.length}</Tag>
          {avg !== null ? <Tag tone="amber">O‘rtacha ball: {avg}</Tag> : null}
        </p>
      </section>

      {groups.map((g) => {
        const done = g.students.filter((s) => typeof exams[s.id]?.score === "number").length;
        const running = bulk?.group === g.key;
        const missing = g.students.filter((s) => !exams[s.id]?.questions.length && s.attendance !== "absent" && s.attendance !== "excused").length;
        return (
          <section key={g.key} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line-soft px-5 py-4 sm:px-6">
              <span className="num inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-[15px] font-semibold text-ink-800">
                <Clock className="size-4 text-ink-500" aria-hidden />
                {g.start}–{g.end}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink-900">{g.course || "Kursi yo‘q"}</p>
                <p className="num flex flex-wrap items-center gap-x-2 text-[13px] text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" aria-hidden />
                    {g.students.length} ta o‘quvchi
                  </span>
                  {g.teacherName && role !== "teacher" ? (
                    <span className="inline-flex items-center gap-1">
                      · <GraduationCap className="size-3.5" aria-hidden />
                      {g.teacherName}
                    </span>
                  ) : null}
                  <span>· baholandi {done}/{g.students.length}</span>
                </p>
              </div>
              {missing ? (
                <button type="button" disabled={!aiReady || Boolean(bulk) || !setup.topics.length} onClick={() => generateGroup(g)} className={cx(btn.primary, "h-10")}>
                  {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                  {running ? `Tuzilmoqda… (qoldi ${bulk!.left})` : `Hammaga savol tuzish (${missing})`}
                </button>
              ) : null}
            </div>
            <ul className="divide-y divide-line-soft">
              {g.students.map((s) => (
                <StudentExam
                  key={s.id}
                  s={s}
                  exam={exams[s.id] ?? null}
                  setup={setup}
                  date={date}
                  role={role}
                  aiReady={aiReady}
                  busy={Boolean(busy[s.id])}
                  error={errors[s.id] ?? ""}
                  showAnswers={showAnswers}
                  onGenerate={(topics, level) => generate(s.id, topics, level)}
                  onScored={(score, note, scoredAt) =>
                    setExams((x) => ({
                      ...x,
                      [s.id]: { ...(x[s.id] ?? { topics: [], level: setup.level, questions: [], generatedAt: null, scoredByName: "" }), score, note, scoredAt },
                    }))
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TopicPicker({ value, onChange, className, compact }: { value: ExamTopic[]; onChange: (v: ExamTopic[]) => void; className?: string; compact?: boolean }) {
  const toggle = (k: ExamTopic) => onChange(cleanTopics(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]));
  return (
    <div className={cx("flex flex-wrap gap-2", className)} role="group" aria-label="Mavzular">
      {EXAM_TOPICS.map((t) => {
        const on = value.includes(t.key);
        return (
          <label
            key={t.key}
            className={cx(
              "inline-flex cursor-pointer select-none items-center gap-2 rounded-xl font-medium ring-1 ring-inset transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500",
              compact ? "h-8 px-2.5 text-[13px]" : "h-10 px-3.5 text-sm",
              on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-surface text-ink-600 ring-line hover:bg-slate-50",
            )}
          >
            <input type="checkbox" checked={on} onChange={() => toggle(t.key)} className="size-4 rounded accent-brand-600" />
            {t.label}
          </label>
        );
      })}
    </div>
  );
}

function StudentExam({
  s,
  exam,
  setup,
  date,
  role,
  aiReady,
  busy,
  error,
  showAnswers,
  onGenerate,
  onScored,
}: {
  s: ExamStudentRow;
  exam: Exam | null;
  setup: Setup;
  date: string;
  role: Role;
  aiReady: boolean;
  busy: boolean;
  error: string;
  showAnswers: boolean;
  onGenerate: (topics: ExamTopic[], level: ExamLevel) => Promise<boolean>;
  onScored: (score: number | null, note: string, scoredAt: string | null) => void;
}) {
  // O'quvchiga alohida mavzular (null — umumiy sozlama)
  // Savol tuzilgan bo'lsa — o'sha mavzular (qayta tuzishda shular ishlatiladi)
  const [own, setOwn] = useState<ExamTopic[] | null>(() => (exam?.questions.length ? cleanTopics(exam.topics) : null));
  const [open, setOpen] = useState(false);
  const topics = own ?? setup.topics;
  const questions = exam?.questions ?? [];
  const href = studentHref(role, s.id);
  const away = s.attendance === "absent" || s.attendance === "excused";

  return (
    <li className={cx(away && "bg-slate-50/50")}>
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="accordion">
        <summary className="flex cursor-pointer select-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-slate-50/60 sm:px-6">
          <span className="flex min-w-[200px] flex-1 items-center gap-3">
            <Avatar name={s.name} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-ink-900">{s.name}</span>
              <span className="num block text-xs text-ink-400">
                {s.seq ? studentCode(s.seq) : ""}
                {questions.length ? ` · ${exam!.topics.map(topicLabel).join(", ")}` : ""}
              </span>
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {s.attendance ? <Tag tone={ATT[s.attendance].tone}>{ATT[s.attendance].label}</Tag> : null}
            {busy ? (
              <Tag tone="brand">
                <Loader2 className="size-3 animate-spin" aria-hidden /> savol tuzilmoqda…
              </Tag>
            ) : questions.length ? (
              <Tag tone="brand">{questions.length} ta savol</Tag>
            ) : (
              <Tag>savol yo‘q</Tag>
            )}
            {typeof exam?.score === "number" ? (
              <span className="num inline-flex h-7 items-center rounded-lg bg-emerald-600 px-2.5 text-sm font-bold text-white">{exam.score} ball</span>
            ) : (
              <Tag tone="amber">ball qo‘yilmagan</Tag>
            )}
          </span>
          <ChevronDown className="accordion-chevron size-[18px] shrink-0 text-ink-400" aria-hidden />
        </summary>

        <div className="grid gap-4 border-t border-line-soft bg-slate-50/40 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
                {own ? "Shu o‘quvchiga mavzular" : "Mavzular (umumiy)"}
                {own ? (
                  <button type="button" onClick={() => setOwn(null)} className="ml-2 normal-case tracking-normal text-brand-700 hover:underline">
                    umumiyga qaytarish
                  </button>
                ) : null}
              </p>
              <TopicPicker value={topics} onChange={setOwn} compact />
            </div>
            <button
              type="button"
              disabled={!aiReady || busy || !topics.length}
              onClick={() => {
                if (questions.length && !window.confirm(`${s.name}: savollar qayta tuzilsinmi? Eski savollar o‘rniga yangilari chiqadi (ball saqlanadi).`)) return;
                void onGenerate(topics, setup.level);
              }}
              className={cx(questions.length ? btn.outline : btn.primary, "h-10")}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : questions.length ? <RefreshCw className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              {busy ? "ChatGPT tuzmoqda… (10–30 soniya)" : questions.length ? "Qayta tuzish" : `${EXAM_QUESTION_COUNT} ta savol tuzish`}
            </button>
          </div>
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}

          {questions.length ? <QuestionList questions={questions} showAnswers={showAnswers} /> : null}
          {exam?.generatedAt && questions.length ? (
            <p className="num text-xs text-ink-400">
              Tuzilgan: {formatDateTime(exam.generatedAt)} · {EXAM_LEVELS.find((l) => l.key === exam.level)?.label} daraja
            </p>
          ) : null}

          <ScoreForm date={date} studentId={s.id} exam={exam} onSaved={onScored} />
          {href ? (
            <Link href={href} className="text-xs font-medium text-brand-700 hover:underline">
              O‘quvchi profili →
            </Link>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function QuestionList({ questions, showAnswers }: { questions: ExamQuestion[]; showAnswers: boolean }) {
  return (
    <ol className="grid gap-2.5">
      {questions.map((q, i) => (
        <li key={i} className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="num inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="mb-1">
                <Tag tone="slate">{topicLabel(q.topic)}</Tag>
              </p>
              <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed text-ink-900">{q.question}</p>
              {showAnswers ? (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-emerald-50/80 px-3 py-2 text-sm leading-relaxed text-emerald-900 ring-1 ring-inset ring-emerald-100">
                  <b className="font-semibold">Javob: </b>
                  {q.answer}
                </p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ScoreForm({
  date,
  studentId,
  exam,
  onSaved,
}: {
  date: string;
  studentId: string;
  exam: Exam | null;
  onSaved: (score: number | null, note: string, scoredAt: string | null) => void;
}) {
  const [score, setScore] = useState(typeof exam?.score === "number" ? String(exam.score) : "");
  const [note, setNote] = useState(exam?.note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await saveExamScore({ date, studentId, score, note }).catch(() => ({ ok: false as const, error: "Tarmoq xatosi — qayta urinib ko‘ring" }));
          if (res.ok) {
            onSaved(res.score, note.trim(), res.scoredAt);
            setMsg({ ok: true, text: res.score === null ? "Ball o‘chirildi" : `Saqlandi: ${res.score} ball` });
          } else setMsg({ ok: false, text: res.error });
        });
      }}
      className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-36">
          <span className="mb-1.5 block text-sm font-semibold text-ink-800">Ball</span>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
            inputMode="decimal"
            placeholder={`0–${EXAM_QUESTION_COUNT}`}
            aria-label="Ball"
            className={cx(inputCls, "num h-11 text-lg font-bold")}
          />
        </label>
        <label className="min-w-[200px] flex-1">
          <span className="mb-1.5 block text-sm font-medium text-ink-600">Izoh (ixtiyoriy)</span>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="Masalan: JavaScript’da kuchli, CSS’ni takrorlasin" className={cx(inputCls, "h-11")} />
        </label>
        <button type="submit" disabled={pending} className={cx(btn.primary, "h-11 bg-emerald-600 hover:bg-emerald-700")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Ballni saqlash
        </button>
      </div>
      {msg ? (
        <p className={cx("mt-2 text-sm", msg.ok ? "text-emerald-700" : "text-rose-700")} role={msg.ok ? "status" : "alert"}>
          {msg.ok ? "✓ " : ""}
          {msg.text}
        </p>
      ) : exam?.scoredAt ? (
        <p className="num mt-2 text-xs text-ink-500">
          Qo‘yilgan: {formatDateTime(exam.scoredAt)}
          {exam.scoredByName ? ` · ${exam.scoredByName}` : ""}
        </p>
      ) : null}
    </form>
  );
}
