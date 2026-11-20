"use client";

// Imtihon sahifasi qobig'i: sarlavha, kun almashtirish va kurs filtri. Kun almashganda sahifa qayta yuklanmaydi —
// ro'yxat joyida almashadi (manzil ham yangilanadi, yangilansa o'sha kun ochiladi). Kurs filtri brauzerda eslab qolinadi.
import { useEffect, useState, useTransition } from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { loadExamDay } from "@/app/actions/exam";
import { courseKey } from "@/lib/courses";
import type { ExamGroup } from "@/lib/exam";
import { weekdayOfIso, WEEKDAY_NAMES } from "@/lib/schedule";
import type { Role } from "@/lib/session";
import { formatDate } from "@/lib/time";
import { ExamBoard } from "./ExamBoard";
import { DatePicker, Select } from "./pickers";
import { btn, Card, cx, EmptyState, PageHeader } from "./ui";

const ALL = "hammasi";

/** "2026-11-20" ± kun */
function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function ExamScreen({
  initialDate,
  today,
  initialGroups,
  aiReady,
  role,
  storageKey,
}: {
  initialDate: string;
  today: string;
  initialGroups: ExamGroup[];
  aiReady: boolean;
  role: Role;
  storageKey: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [groups, setGroups] = useState(initialGroups);
  const [course, setCourse] = useState(ALL);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // Kurs: manzildan yoki brauzerda saqlangani
  useEffect(() => {
    let v = new URLSearchParams(window.location.search).get("kurs");
    try {
      v ??= localStorage.getItem(storageKey);
    } catch {
      // eslab qolinmagan
    }
    if (v && v !== ALL) {
      const t = window.setTimeout(() => setCourse(v!), 0);
      return () => window.clearTimeout(t);
    }
  }, [storageKey]);

  const syncUrl = (d: string, k: string) => {
    const sp = new URLSearchParams({ ...(d === today ? {} : { sana: d }), ...(k !== ALL ? { kurs: k } : {}) }).toString();
    window.history.replaceState(window.history.state, "", sp ? `/imtihon?${sp}` : "/imtihon");
  };

  const pickCourse = (k: string) => {
    setCourse(k);
    syncUrl(date, k);
    try {
      localStorage.setItem(storageKey, k);
    } catch {
      // saqlab bo'lmasa — faqat shu sahifada
    }
  };

  const go = (d: string) => {
    if (!d || d === date) return;
    setError("");
    start(async () => {
      const res = await loadExamDay(d).catch(() => ({ ok: false as const, error: "Tarmoq xatosi — qayta urinib ko‘ring" }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDate(d);
      setGroups(res.groups);
      syncUrl(d, course);
    });
  };

  const courses = [...new Map(groups.map((g) => [courseKey(g.course), g.course || "Kursi yo‘q"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  // Tanlangan kurs bu kunda bo'lmasa — hammasi ko'rinadi (tanlov saqlanib qoladi)
  const active = courses.some(([k]) => k === course) ? course : ALL;
  const day = WEEKDAY_NAMES[weekdayOfIso(date) - 1];

  return (
    <>
      <PageHeader
        eyebrow="Imtihon"
        title={`${date === today ? "Bugungi imtihon" : "Imtihon"} — ${day}, ${formatDate(date)}`}
        subtitle={`${day} kuni darsga keladigan o‘quvchilar (dars jadvali bo‘yicha). Mavzularni tanlang — ChatGPT har biriga 10 ta savolni javoblari bilan tuzadi, oxirida ball qo‘ying.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => go(shiftDay(date, -1))} disabled={pending} className={cx(btn.outline, "px-3")} aria-label="Oldingi kun">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            {courses.length > 1 ? (
              <Select
                value={active}
                onChange={pickCourse}
                searchable={false}
                aria-label="Kurs"
                wrapperClassName="w-full sm:w-56"
                options={[{ value: ALL, label: "Barcha kurslar" }, ...courses.map(([value, label]) => ({ value, label }))]}
              />
            ) : null}
            <DatePicker value={date} onChange={go} aria-label="Sana" wrapperClassName="w-60" />
            <button type="button" onClick={() => go(shiftDay(date, 1))} disabled={pending} className={cx(btn.outline, "px-3")} aria-label="Keyingi kun">
              <ChevronRight className="size-4" aria-hidden />
            </button>
            {date !== today ? (
              <button type="button" onClick={() => go(today)} disabled={pending} className={btn.outline}>
                Bugun
              </button>
            ) : null}
            {pending ? <Loader2 className="size-5 animate-spin text-brand-600" aria-label="Yuklanmoqda" /> : null}
          </div>
        }
      />
      {error ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className={cx("transition-opacity", pending && "pointer-events-none opacity-50")}>
        {groups.length ? (
          <ExamBoard key={date} date={date} groups={groups} course={active === ALL ? null : active} aiReady={aiReady} role={role} />
        ) : (
          <Card>
            <EmptyState title={`${day} kuni dars yo‘q`} icon={CalendarX2}>
              Ro‘yxat o‘quvchilarning dars jadvali bo‘yicha tuziladi (o‘quvchi profilida «Dars vaqti»).
            </EmptyState>
          </Card>
        )}
      </div>
    </>
  );
}
