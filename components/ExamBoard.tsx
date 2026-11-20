"use client";

// Imtihon: chapda — kunning barcha o'quvchilari bitta ro'yxatda (qidiruv, kurs filtri, har birida dars vaqti), o'ngda —
// tanlangan o'quvchi: ChatGPT savollari (javoblari bilan), har savolga «Topdi / Yarim / Topolmadi», avtomatik ball va izoh.
// Telefonda — ro'yxat yoki tanlangan o'quvchi («Ro'yxat» tugmasi bilan qaytiladi). Ko'zni charchatmasligi uchun
// rang faqat holatni bildiradi; asosiy amal — bitta.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Clock, Eye, EyeOff, Loader2, NotebookPen, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { generateExamQuestions, saveExamMarks, saveExamScore } from "@/app/actions/exam";
import type { ExamGroup, ExamStudentRow } from "@/lib/exam";
import {
  cleanTopics,
  EXAM_LEVELS,
  EXAM_MARKS,
  EXAM_QUESTION_COUNT,
  EXAM_TOPICS,
  isExamLevel,
  marksScore,
  marksSummary,
  topicLabel,
  type ExamLevel,
  type ExamMark,
  type ExamQuestion,
  type ExamTopic,
} from "@/lib/exam-rules";
import { courseKey } from "@/lib/courses";
import type { Role } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { studentHref } from "./FollowUps";
import { Select } from "./pickers";
import { btn, cx, inputCls, studentCode } from "./ui";

const STORE = "tt-exam-setup";
const ANSWERS_STORE = "tt-exam-answers";
const DEFAULT_TOPICS: ExamTopic[] = ["html", "css", "javascript"];

type Exam = NonNullable<ExamStudentRow["exam"]>;
type Setup = { topics: ExamTopic[]; level: ExamLevel };
/** Ro'yxat qatori: o'quvchi va uning shu kungi darsi */
type Row = ExamStudentRow & { start: string; end: string; course: string; teacherName: string };

const ATT_TEXT = { present: "Keldi", absent: "Kelmadi", excused: "Sababli" } as const;
const isAway = (r: Row) => r.attendance === "absent" || r.attendance === "excused";
/** 7.5 -> "7,5" */
const fmt = (n: number) => String(n).replace(".", ",");
/** Qidiruv: katta-kichik harf va tutuq belgilarisiz */
const norm = (s: string) => s.toLowerCase().replace(/[ʻʼ'`‘’]/g, "");

export function ExamBoard({
  date,
  groups,
  course,
  courses,
  onCourse,
  aiReady,
  role,
}: {
  date: string;
  groups: ExamGroup[];
  /** Kurs filtri (null — hammasi) */
  course: string | null;
  courses: [string, string][];
  onCourse: (key: string | null) => void;
  aiReady: boolean;
  role: Role;
}) {
  // Barcha o'quvchilar bitta ro'yxatda: dars boshlanishi, keyin ism bo'yicha (takrorlar bir marta)
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const g of groups) {
      for (const s of g.students) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        out.push({ ...s, start: g.start, end: g.end, course: g.course, teacherName: g.teacherName });
      }
    }
    return out.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  }, [groups]);

  const [exams, setExams] = useState<Record<string, Exam | null>>(() => Object.fromEntries(rows.map((r) => [r.id, r.exam])));
  const [setup, setSetup] = useState<Setup>({ topics: DEFAULT_TOPICS, level: "medium" });
  const [showAnswers, setShowAnswers] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState<{ left: number } | null>(null);
  const stopBulk = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Eslab qolingan mavzular, daraja va «javoblar ko'rinsinmi»
  useEffect(() => {
    let next: Setup | null = null;
    let answers: boolean | null = null;
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<Setup> | null;
      if (raw) {
        const topics = cleanTopics(Array.isArray(raw.topics) ? raw.topics : []);
        next = { topics: topics.length ? topics : DEFAULT_TOPICS, level: isExamLevel(raw.level) ? raw.level : "medium" };
      }
      const a = localStorage.getItem(ANSWERS_STORE);
      if (a !== null) answers = a === "1";
    } catch {
      // eslab qolinmagan — standart
    }
    if (!next && answers === null) return;
    const t = window.setTimeout(() => {
      if (next) setSetup(next);
      if (answers !== null) setShowAnswers(answers);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const remember = (next: Setup) => {
    setSetup(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // saqlab bo'lmasa — faqat shu sahifada
    }
  };
  const toggleAnswers = () => {
    setShowAnswers((v) => {
      try {
        localStorage.setItem(ANSWERS_STORE, v ? "0" : "1");
      } catch {
        // saqlab bo'lmasa — faqat shu sahifada
      }
      return !v;
    });
  };

  const inCourse = course ? rows.filter((r) => courseKey(r.course) === course) : rows;
  const nq = norm(q.trim());
  const visible = nq
    ? inCourse.filter((r) => norm(`${r.name} ${r.seq ? studentCode(r.seq) : ""} ${r.course} ${r.teacherName} ${r.start}`).includes(nq))
    : inCourse;
  const current = rows.find((r) => r.id === selected) ?? null;

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
            marks: res.questions.map(() => null),
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

  // Savoli yo'q (va kelmagan/sababli bo'lmagan) o'quvchilarga ketma-ket
  const todo = inCourse.filter((r) => !exams[r.id]?.questions.length && !isAway(r));
  const generateAll = async () => {
    const list = todo;
    const what = `${setup.topics.map(topicLabel).join(", ")} · ${EXAM_LEVELS.find((l) => l.key === setup.level)?.label}`;
    if (!window.confirm(`${list.length} ta o‘quvchiga savol tuziladi (${what}). Davom etilsinmi?`)) return;
    stopBulk.current = false;
    for (let i = 0; i < list.length && !stopBulk.current; i++) {
      setBulk({ left: list.length - i });
      const ok = await generate(list[i].id, setup.topics, setup.level);
      if (!ok) break;
    }
    setBulk(null);
  };

  const select = (id: string | null) => {
    setSelected(id);
    if (!id) return;
    // Panel ko'rinmay qolgan bo'lsa (telefonda yoki pastga tushib ketilgan) — tepasiga
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (el && (el.getBoundingClientRect().top < 72 || window.innerWidth < 1024)) el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  const back = () => {
    const id = selected;
    setSelected(null);
    requestAnimationFrame(() => document.getElementById(`exam-row-${id}`)?.scrollIntoView({ block: "center" }));
  };
  const idx = current ? visible.findIndex((r) => r.id === current.id) : -1;
  const next = idx >= 0 ? (visible[idx + 1] ?? null) : null;

  const scored = inCourse.map((r) => exams[r.id]?.score).filter((x): x is number => typeof x === "number");
  const avg = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(270px,320px)_minmax(0,1fr)] lg:gap-6">
      {/* ---------- Ro'yxat ---------- */}
      <aside
        className={cx(
          "flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7.5rem)]",
          current ? "hidden" : "flex",
        )}
        aria-label="O‘quvchilar"
      >
        <div className="grid shrink-0 gap-2.5 border-b border-line-soft p-3.5">
          <label className="relative block">
            <span className="sr-only">O‘quvchini qidirish</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && visible[0]) select(visible[0].id);
              }}
              placeholder="O‘quvchini qidirish…"
              autoComplete="off"
              className={cx(inputCls, "h-10 pl-9 pr-9 text-sm shadow-none")}
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 hover:bg-slate-100 hover:text-ink-700" aria-label="Tozalash">
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </label>
          {courses.length > 1 ? (
            <Select
              value={course ?? ""}
              onChange={(v) => onCourse(v || null)}
              searchable={false}
              aria-label="Kurs"
              wrapperClassName="w-full"
              options={[{ value: "", label: "Barcha kurslar" }, ...courses.map(([value, label]) => ({ value, label }))]}
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0.5 text-xs text-ink-500">
            <span className="num">
              {inCourse.length} o‘quvchi · baholandi {scored.length}
              {avg !== null ? ` · o‘rtacha ${fmt(avg)}` : ""}
            </span>
            {bulk ? (
              <span className="inline-flex items-center gap-1.5 text-brand-700">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                qoldi {bulk.left}
                <button type="button" onClick={() => (stopBulk.current = true)} className="font-medium text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline">
                  to‘xtatish
                </button>
              </span>
            ) : todo.length && aiReady ? (
              <button
                type="button"
                onClick={generateAll}
                disabled={!setup.topics.length}
                className="inline-flex items-center gap-1 font-medium text-brand-700 underline-offset-2 hover:underline disabled:opacity-50"
                title="Savoli yo‘q o‘quvchilarga (kelmaganlardan tashqari) — oxirgi tanlangan mavzular va daraja bo‘yicha"
              >
                <Sparkles className="size-3.5" aria-hidden />
                Hammaga tuzish ({todo.length})
              </button>
            ) : null}
          </div>
        </div>
        {visible.length ? (
          <ul className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto overscroll-contain">
            {visible.map((r) => (
              <StudentRow key={r.id} r={r} exam={exams[r.id] ?? null} busy={Boolean(busy[r.id])} active={r.id === selected} showTeacher={role !== "teacher"} onSelect={() => select(r.id)} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-ink-500">{q ? `«${q}» topilmadi` : "Bu kursda o‘quvchi yo‘q"}</p>
        )}
      </aside>

      {/* ---------- Tanlangan o'quvchi ---------- */}
      <div ref={panelRef} className={cx("min-w-0 scroll-mt-24", current ? "" : "hidden lg:block")}>
        {current ? (
          <StudentPanel
            key={current.id}
            r={current}
            exam={exams[current.id] ?? null}
            setup={setup}
            date={date}
            role={role}
            aiReady={aiReady}
            busy={Boolean(busy[current.id])}
            error={errors[current.id] ?? ""}
            showAnswers={showAnswers}
            onToggleAnswers={toggleAnswers}
            onSetup={remember}
            onGenerate={(topics, level) => {
              remember({ topics, level });
              return generate(current.id, topics, level);
            }}
            onMarked={(marks, score, scoredAt) => setExams((x) => (x[current.id] ? { ...x, [current.id]: { ...x[current.id]!, marks, score, scoredAt } } : x))}
            onScored={(score, note, scoredAt) =>
              setExams((x) => ({
                ...x,
                [current.id]: { ...(x[current.id] ?? { topics: [], level: setup.level, questions: [], marks: [], generatedAt: null, scoredByName: "" }), score, note, scoredAt },
              }))
            }
            onBack={back}
            next={next ? { name: next.name, go: () => select(next.id) } : null}
          />
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <NotebookPen className="size-8 text-ink-300" aria-hidden />
            <p className="mt-3 text-[15px] font-medium text-ink-700">O‘quvchini tanlang</p>
            <p className="mt-1 max-w-sm text-sm text-ink-500">Savollar, baholash va ball shu yerda ko‘rinadi.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentRow({ r, exam, busy, active, showTeacher, onSelect }: { r: Row; exam: Exam | null; busy: boolean; active: boolean; showTeacher: boolean; onSelect: () => void }) {
  const away = isAway(r);
  const ready = Boolean(exam?.questions.length);
  return (
    <li id={`exam-row-${r.id}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cx(
          "relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500",
          active ? "bg-brand-50/70" : "hover:bg-slate-50",
        )}
      >
        {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-600" aria-hidden /> : null}
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate text-[15px] font-medium", away ? "text-ink-400" : "text-ink-900")}>{r.name}</span>
          <span className="num mt-0.5 flex items-center gap-1 truncate text-xs text-ink-500">
            <Clock className="size-3 shrink-0 text-ink-400" aria-hidden />
            <span className="truncate">
              {r.start}–{r.end}
              {r.course ? ` · ${r.course}` : ""}
              {showTeacher && r.teacherName ? ` · ${r.teacherName}` : ""}
            </span>
          </span>
          {away ? <span className="mt-0.5 block text-xs text-rose-600">{ATT_TEXT[r.attendance!]}</span> : null}
        </span>
        <span className="shrink-0 text-right">
          {busy ? (
            <Loader2 className="size-4 animate-spin text-brand-600" aria-label="Savol tuzilmoqda" />
          ) : typeof exam?.score === "number" ? (
            <span className="num text-[15px] font-semibold text-ink-900">{fmt(exam.score)}</span>
          ) : (
            <span
              className={cx("inline-block size-2 rounded-full", ready ? "bg-brand-500" : "bg-slate-200")}
              title={ready ? "Savollar tayyor" : "Savol tuzilmagan"}
              aria-label={ready ? "Savollar tayyor" : "Savol tuzilmagan"}
            />
          )}
        </span>
      </button>
    </li>
  );
}

function StudentPanel({
  r,
  exam,
  setup,
  date,
  role,
  aiReady,
  busy,
  error,
  showAnswers,
  onToggleAnswers,
  onSetup,
  onGenerate,
  onMarked,
  onScored,
  onBack,
  next,
}: {
  r: Row;
  exam: Exam | null;
  setup: Setup;
  date: string;
  role: Role;
  aiReady: boolean;
  busy: boolean;
  error: string;
  showAnswers: boolean;
  onToggleAnswers: () => void;
  onSetup: (s: Setup) => void;
  onGenerate: (topics: ExamTopic[], level: ExamLevel) => Promise<boolean>;
  onMarked: (marks: ExamMark[], score: number | null, scoredAt: string | null) => void;
  onScored: (score: number | null, note: string, scoredAt: string | null) => void;
  onBack: () => void;
  next: { name: string; go: () => void } | null;
}) {
  const questions = exam?.questions ?? [];
  const marks = exam?.marks?.length === questions.length ? exam.marks : questions.map(() => null);
  // «Qayta tuzish»: shu o'quvchi mavzulari bilan sozlama ochiladi
  const [regen, setRegen] = useState<Setup | null>(null);
  const [markError, setMarkError] = useState("");
  const [saving, setSaving] = useState(0);
  // Belgilar ketma-ket saqlanadi (tez bosilsa ham oxirgi holat yoziladi)
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const href = studentHref(role, r.id);

  const mark = (i: number, v: ExamMark) => {
    const nextMarks = marks.map((m, j) => (j === i ? (m === v ? null : v) : m));
    const score = marksScore(nextMarks);
    onMarked(nextMarks, score, score === null ? null : new Date().toISOString());
    setMarkError("");
    setSaving((n) => n + 1);
    queue.current = queue.current.then(async () => {
      const res = await saveExamMarks({ date, studentId: r.id, marks: nextMarks }).catch(() => ({ ok: false as const, error: "Tarmoq xatosi — qayta bosing" }));
      if (!res.ok) setMarkError(res.error);
      setSaving((n) => n - 1);
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card" aria-label={r.name}>
      {/* Sarlavha: ism, dars vaqti, kurs */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line-soft px-5 py-4 sm:px-6">
        <button type="button" onClick={onBack} className="-ml-1.5 inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-sm text-ink-500 hover:bg-slate-100 hover:text-ink-800 lg:hidden">
          <ArrowLeft className="size-4" aria-hidden />
          Ro‘yxat
        </button>
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <h2 className="truncate text-xl font-semibold tracking-[-0.01em] text-ink-900">{r.name}</h2>
          <p className="num mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-500">
            <Clock className="size-3.5 text-ink-400" aria-hidden />
            <span>
              {r.start}–{r.end}
              {r.course ? ` · ${r.course}` : ""}
              {role !== "teacher" && r.teacherName ? ` · ${r.teacherName}` : ""}
              {r.seq ? ` · ${studentCode(r.seq)}` : ""}
            </span>
            {isAway(r) ? <span className="text-rose-600">· {ATT_TEXT[r.attendance!]}</span> : null}
          </p>
        </div>
        {questions.length ? (
          <button
            type="button"
            onClick={onToggleAnswers}
            aria-pressed={showAnswers}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-500 transition hover:bg-slate-100 hover:text-ink-800"
            title="O‘quvchiga ekranni ko‘rsatganda javoblarni yashiring"
          >
            {showAnswers ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            <span className="sm:hidden">Javoblar</span>
            <span className="hidden sm:inline">{showAnswers ? "Javoblarni yashirish" : "Javoblarni ko‘rsatish"}</span>
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 px-5 py-5 sm:px-6">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        {busy ? (
          <div className="grid gap-3" aria-live="polite">
            <p className="flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="size-4 animate-spin text-brand-600" aria-hidden />
              ChatGPT savollarni tuzmoqda — odatda 10–30 soniya
            </p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-14" />
            ))}
          </div>
        ) : !questions.length ? (
          <SetupForm value={setup} onChange={onSetup} aiReady={aiReady} onSubmit={() => void onGenerate(setup.topics, setup.level)} />
        ) : regen ? (
          <SetupForm
            value={regen}
            onChange={setRegen}
            aiReady={aiReady}
            submitLabel="Qayta tuzish"
            note="Yangi savollar eskilarining o‘rniga chiqadi, belgilar tozalanadi."
            onCancel={() => setRegen(null)}
            onSubmit={() => {
              const s = regen;
              setRegen(null);
              void onGenerate(s.topics, s.level);
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
              <span>
                {questions.length} ta savol · {cleanTopics(exam!.topics).map(topicLabel).join(", ")} · {EXAM_LEVELS.find((l) => l.key === exam!.level)?.label}
                {exam?.generatedAt ? <span className="num text-ink-400"> · {formatDateTime(exam.generatedAt).slice(-5)}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => setRegen({ topics: cleanTopics(exam!.topics).length ? cleanTopics(exam!.topics) : setup.topics, level: exam!.level })}
                disabled={!aiReady}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-500 transition hover:bg-slate-100 hover:text-ink-800 disabled:opacity-50"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Qayta tuzish
              </button>
            </div>
            <QuestionList questions={questions} showAnswers={showAnswers} marks={marks} onMark={mark} />
            <MarksTotal marks={marks} saving={saving > 0} error={markError} />
          </>
        )}

        <ScoreForm date={date} studentId={r.id} exam={exam} onSaved={onScored} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
          {href ? (
            <Link href={href} className="text-sm text-ink-500 underline-offset-4 hover:text-brand-700 hover:underline">
              O‘quvchi profili
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <button type="button" onClick={next.go} className={cx(btn.soft, "h-10 px-4 text-sm")}>
              <span className="max-w-56 truncate">Keyingi: {next.name}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Mavzular (galochka) va daraja — savol tuzishdan oldin. */
function SetupForm({
  value,
  onChange,
  aiReady,
  onSubmit,
  onCancel,
  submitLabel = `${EXAM_QUESTION_COUNT} ta savol tuzish`,
  note = "Savollar mavzular bo‘yicha teng taqsimlanadi va boshqa o‘quvchilarnikidan farq qiladi.",
}: {
  value: Setup;
  onChange: (s: Setup) => void;
  aiReady: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  note?: string;
}) {
  const toggle = (k: ExamTopic) => onChange({ ...value, topics: cleanTopics(value.topics.includes(k) ? value.topics.filter((x) => x !== k) : [...value.topics, k]) });
  return (
    <div className="grid gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-700">Mavzular</legend>
        <div className="flex flex-wrap gap-2">
          {EXAM_TOPICS.map((t) => {
            const on = value.topics.includes(t.key);
            return (
              <label
                key={t.key}
                className={cx(
                  "inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-lg border px-3 text-sm transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500",
                  on ? "border-brand-300 bg-brand-50 font-medium text-brand-700" : "border-line text-ink-600 hover:bg-slate-50",
                )}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(t.key)} className="sr-only" />
                {on ? <Check className="size-3.5" aria-hidden /> : null}
                {t.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-700">Daraja</legend>
        <Segmented
          label="Daraja"
          value={value.level}
          onChange={(level) => onChange({ ...value, level })}
          options={EXAM_LEVELS.map((l) => ({ value: l.key, label: l.label, title: l.hint }))}
        />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onSubmit} disabled={!aiReady || !value.topics.length} className={cx(btn.primary, "h-10 px-4 text-sm")}>
          <Sparkles className="size-4" aria-hidden />
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-10 rounded-lg px-3 text-sm text-ink-500 hover:bg-slate-100 hover:text-ink-800">
            Bekor qilish
          </button>
        ) : null}
        <span className="text-xs text-ink-400">{!value.topics.length ? "Kamida bitta mavzuni tanlang" : note}</span>
      </div>
      {!aiReady ? (
        <p className="text-sm text-amber-700">
          ChatGPT kaliti kiritilmagan (Vercel: <code className="text-xs">OPENAI_API_KEY</code>) — savol tuzilmaydi, ballni qo‘lda qo‘yish mumkin.
        </p>
      ) : null}
    </div>
  );
}

/** Kichik tanlagich (bir nechta variantdan bittasi). */
function Segmented<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string; on?: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-slate-50 p-0.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-9 rounded-[10px] px-3.5 text-[13px] font-semibold transition sm:h-8",
              on ? cx("bg-surface shadow-sm ring-1", o.on ?? "text-ink-900 ring-line") : "text-ink-500 hover:text-ink-800",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const MARK_ON = {
  emerald: "text-emerald-700 ring-emerald-200",
  amber: "text-amber-800 ring-amber-200",
  rose: "text-rose-700 ring-rose-200",
} as const;
const MARK_NUM = { 1: "bg-emerald-100 text-emerald-700", 0.5: "bg-amber-100 text-amber-800", 0: "bg-rose-100 text-rose-700" } as const;

function QuestionList({
  questions,
  showAnswers,
  marks,
  onMark,
}: {
  questions: ExamQuestion[];
  showAnswers: boolean;
  marks: ExamMark[];
  onMark: (i: number, v: ExamMark) => void;
}) {
  return (
    <ol className="-my-1 divide-y divide-line-soft">
      {questions.map((q, i) => {
        const m = marks[i] ?? null;
        return (
          <li key={i} className="flex gap-3.5 py-4">
            <span
              className={cx("num mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors", m === null ? "bg-slate-100 text-ink-500" : MARK_NUM[m])}
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-900">{q.question}</p>
              <p className="mt-0.5 text-xs text-ink-400">{topicLabel(q.topic)}</p>
              {showAnswers ? (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-ink-600">
                  <span className="font-medium text-ink-500">Javob: </span>
                  {q.answer}
                </p>
              ) : null}
              <div className="mt-3">
                <Segmented<number>
                  label={`${i + 1}-savol bahosi`}
                  value={m}
                  onChange={(v) => onMark(i, v as ExamMark)}
                  options={EXAM_MARKS.map((mk) => ({ value: mk.value, label: mk.label, on: MARK_ON[mk.tone], title: m === mk.value ? "Qayta bosilsa — belgi olib tashlanadi" : undefined }))}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Avtomatik natija: belgilar yig'indisi (topdi — 1, yarim — 0,5). */
function MarksTotal({ marks, saving, error }: { marks: ExamMark[]; saving: boolean; error: string }) {
  const sum = marksSummary(marks);
  const score = marksScore(marks);
  const pct = marks.length && score !== null ? Math.round((score / marks.length) * 100) : 0;
  return (
    <div className="rounded-xl border border-line bg-slate-50/60 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">Natija</p>
        <p className="num text-2xl font-bold tracking-[-0.02em] text-ink-900">
          {score === null ? "—" : fmt(score)}
          <span className="ml-1 text-sm font-medium text-ink-400">/ {marks.length}</span>
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="num mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-ink-500">
        <span>
          topdi {sum.right} · yarim {sum.half} · topolmadi {sum.wrong}
          {sum.left ? ` · belgilanmagan ${sum.left}` : ""}
        </span>
        <span role="status">{error ? <span className="text-rose-600">{error}</span> : saving ? "Saqlanmoqda…" : score !== null ? "Saqlandi ✓" : ""}</span>
      </p>
    </div>
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
  const [score, setScore] = useState(typeof exam?.score === "number" ? fmt(exam.score) : "");
  // Ball belgilardan avtomatik o'zgarsa — maydon ham yangilanadi
  const [seen, setSeen] = useState(exam?.score ?? null);
  if (seen !== (exam?.score ?? null)) {
    setSeen(exam?.score ?? null);
    setScore(typeof exam?.score === "number" ? fmt(exam.score) : "");
  }
  const [note, setNote] = useState(exam?.note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const auto = Boolean(exam?.questions.length);
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
            setMsg({ ok: true, text: res.score === null ? "Ball o‘chirildi" : `Saqlandi: ${fmt(res.score)} ball` });
          } else setMsg({ ok: false, text: res.error });
        });
      }}
      className="grid gap-2"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-28">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Ball</span>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
            inputMode="decimal"
            placeholder={`0–${EXAM_QUESTION_COUNT}`}
            aria-label="Ball"
            className={cx(inputCls, "num h-10 text-base font-semibold shadow-none")}
          />
        </label>
        <label className="min-w-[200px] flex-1">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Izoh</span>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="Ixtiyoriy: kuchli tomonlari, nimani takrorlasin" className={cx(inputCls, "h-10 text-sm shadow-none")} />
        </label>
        <button type="submit" disabled={pending} className={cx(btn.outline, "h-10 px-4 text-sm shadow-none")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Saqlash
        </button>
      </div>
      {msg ? (
        <p className={cx("text-xs", msg.ok ? "text-emerald-700" : "text-rose-700")} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      ) : (
        <p className="num text-xs text-ink-400">
          {auto ? "Ball belgilardan avtomatik hisoblanadi — kerak bo‘lsa o‘zgartiring." : "Savolsiz ham ball qo‘yish mumkin."}
          {exam?.scoredAt ? ` Oxirgi: ${formatDateTime(exam.scoredAt)}${exam.scoredByName ? `, ${exam.scoredByName}` : ""}.` : ""}
        </p>
      )}
    </form>
  );
}
