"use client";

// Dars jadvali bo'yicha jonli ko'rinishlar: keyingi dars (ro'yxatlarda) va
// «Bugun darsga keladi» (to'lovlar sahifasi) — to'lovni o'quvchi kelgan vaqtda yig'ish uchun.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CalendarClock, CalendarDays, Phone, Plus, Sunrise, UserX, UsersRound } from "lucide-react";
import type { PayStatus } from "@/lib/data";
import { dayLabel } from "@/lib/reminders";
import {
  daysLabel,
  lessonOn,
  lessonState,
  nextLesson,
  nextLessonLabel,
  scheduleLabel,
  tashkentClock,
  toMinutes,
  untilLabel,
  WEEKDAY_NAMES,
  type Lesson,
  type LessonState,
} from "@/lib/schedule";
import { courseKey } from "@/lib/courses";
import type { Role } from "@/lib/session";
import { formatMoney, formatNumber, monthLabel } from "@/lib/time";
import { Select } from "./pickers";
import { Avatar, btn, Card, cx, IconTile } from "./ui";
import { useNow } from "./useNow";

/** Bugun darsga kelmagan o'quvchi (davomatdan): «Hozir darsda» o'rniga ko'rsatiladi. */
export type Away = "absent" | "excused";

export function AwayBadge({ away, className = "" }: { away: Away; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap font-medium",
        away === "absent" ? "text-rose-600" : "text-amber-700",
        className,
      )}
      title={away === "absent" ? "Bugun davomatda «Kelmadi» belgilangan" : "Bugun davomatda «Sababli» belgilangan"}
    >
      <UserX className="size-3.5 shrink-0" aria-hidden />
      {away === "absent" ? "Kelmadi" : "Sababli"}
    </span>
  );
}

/** Yashil "jonli" nuqta — hozir darsda. */
export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={cx("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      <span className="ping-soft absolute inset-0 rounded-full bg-emerald-400" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  );
}

/**
 * Jadval ustuni: yuqorida — keyingi dars (jonli), pastda — kunlar ("Toq kunlar").
 * To'liq jadval (vaqtlari bilan) — sichqoncha ustiga borganda. Nofaol o'quvchida — faqat jadval.
 */
export function NextLessonCell({
  lessons,
  serverNow,
  muted = false,
  fluid = false,
  away = null,
}: {
  lessons: Lesson[];
  serverNow: number;
  muted?: boolean;
  /** Bugun davomatda «Kelmadi» / «Sababli» — bugungi dars o'rniga shu */
  away?: Away | null;
  /** Ustun kengligiga moslashadi (o'zgaruvchan kenglikdagi jadvalda); aks holda 180px gacha */
  fluid?: boolean;
}) {
  const now = useNow(serverNow);
  if (!lessons.length) return <span className="text-[13px] text-ink-300">Kiritilmagan</span>;
  const next = muted ? null : nextLesson(lessons, tashkentClock(now));
  const full = scheduleLabel(lessons);
  return (
    <div className={cx("min-w-0", !fluid && "max-w-[180px]", muted && "opacity-60")} title={full}>
      {next && away && next.inDays === 0 ? (
        <p className="num flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm">
          <AwayBadge away={away} />
          <span className="truncate text-[13px] text-ink-400">bugun, {next.lesson.start}</span>
        </p>
      ) : next ? (
        <p
          className={cx(
            "num flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium",
            next.now ? "text-emerald-700" : next.inDays === 0 ? "text-brand-700" : "text-ink-800",
          )}
        >
          {next.now ? <LiveDot /> : <CalendarClock className="size-3.5 shrink-0 opacity-70" aria-hidden />}
          <span className="truncate">{nextLessonLabel(next, true)}</span>
        </p>
      ) : null}
      <p className={cx("num truncate text-[13px] text-ink-400", next && "mt-0.5")}>{next ? daysLabel(lessons.map((l) => l.day)) : full}</p>
    </div>
  );
}

// ---------- Bugun darsga keladi ----------

export type TodayStudent = {
  id: string;
  name: string;
  phone: string;
  fee: number;
  paid: number;
  debt: number;
  status: PayStatus;
  lessons: Lesson[];
  /** Kursi (guruh nomi) va o'qituvchisi — blokdagi filtr uchun */
  group: string;
  teacherId: string | null;
  /** Bugun davomatda «Kelmadi» / «Sababli» */
  away?: Away | null;
};

/** Filtrdagi «kursi yo'q» va «o'qituvchi biriktirilmagan» qiymatlari */
const NO_COURSE = "__none__";
const NO_TEACHER = "none";

const STATE_ORDER: Record<LessonState, number> = { now: 0, soon: 1, later: 1, done: 2 };

function StatePill({ state, start, end, minutes }: { state: LessonState; start: string; end: string; minutes: number }) {
  if (state === "now") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-50 px-2.5 text-[13px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
        <LiveDot />
        Hozir darsda
      </span>
    );
  }
  if (state === "done") {
    return <span className="inline-flex h-7 items-center whitespace-nowrap rounded-lg bg-slate-100 px-2.5 text-[13px] font-medium text-ink-500">Dars tugadi · {end}</span>;
  }
  return (
    <span
      className={cx(
        "num inline-flex h-7 items-center whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium ring-1 ring-inset",
        state === "soon" ? "bg-amber-50 text-amber-800 ring-amber-100" : "bg-slate-50 text-ink-600 ring-line",
      )}
    >
      {untilLabel(toMinutes(start) - minutes)}
    </span>
  );
}

/**
 * Bugun darsga keladigan o'quvchilar — dars vaqti bo'yicha guruhlab: kim hozir darsda, kim qachon keladi.
 * Odatda faqat to'lamaganlar; «Hammasi» bosilsa — to'laganlari ham.
 */
export function TodayLessons({
  students,
  teachers = [],
  month,
  serverNow,
  role,
  unscheduled,
  defaultAll = false,
}: {
  /** Jadvali bor (faol) o'quvchilar va tanlangan oy bo'yicha to'lov holati */
  students: TodayStudent[];
  /** O'qituvchi filtri uchun (rahbar va administratorga; o'qituvchiga — bo'sh) */
  teachers?: { id: string; name: string }[];
  month: string;
  serverNow: number;
  role: Role;
  /** Jadvali kiritilmagan qarzdorlar soni */
  unscheduled: number;
  /** Boshida hamma keladiganlar ko'rinsin (administrator uchun) */
  defaultAll?: boolean;
}) {
  const now = useNow(serverNow);
  const [showAll, setShowAll] = useState(defaultAll);
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const clock = tashkentClock(now);
  const tomorrow = (clock.weekday % 7) + 1;

  // Filtr: kurs (yozilishi farqli bir xil kurslar — bitta) va o'qituvchi; ro'yxatda faqat jadvali bor o'quvchilardagilari
  const courseOf = (s: TodayStudent) => courseKey(s.group) || NO_COURSE;
  const courseNames = new Map<string, string>();
  for (const s of students) if (!courseNames.has(courseOf(s))) courseNames.set(courseOf(s), s.group.trim() || "Kursi yo‘q");
  const courseOptions = [...courseNames].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  const teacherIds = new Set(students.map((s) => s.teacherId ?? NO_TEACHER));
  const teacherOptions = [
    ...teachers.filter((t) => teacherIds.has(t.id)).map((t) => ({ value: t.id, label: t.name })),
    ...(teacherIds.has(NO_TEACHER) ? [{ value: NO_TEACHER, label: "O‘qituvchi biriktirilmagan" }] : []),
  ];
  const showCourseFilter = courseOptions.length > 1;
  const showTeacherFilter = teachers.length > 0 && teacherOptions.length > 1;
  const filtered = Boolean((showCourseFilter && course) || (showTeacherFilter && teacher));
  const pool = filtered
    ? students.filter(
        (s) =>
          (!showCourseFilter || !course || courseOf(s) === course) &&
          (!showTeacherFilter || !teacher || (s.teacherId ?? NO_TEACHER) === teacher),
      )
    : students;
  const clearFilters = () => {
    setCourse("");
    setTeacher("");
  };

  const today = pool.flatMap((s) => {
    const l = lessonOn(s.lessons, clock.weekday);
    return l ? [{ s, l }] : [];
  });
  const debtorsToday = today.filter((x) => x.s.status !== "paid");
  // «Hammasi» to'laganlar bo'lsa ma'noli (hamma to'lagan bo'lsa ham — kim kelishini ko'rish uchun)
  const canToggle = today.length > debtorsToday.length;
  const all = showAll && canToggle;
  const visible = all ? today : debtorsToday;
  const debtorsTomorrow = pool.filter((s) => s.status !== "paid" && lessonOn(s.lessons, tomorrow)).length;

  // Bir xil vaqtdagi darslar — bitta blok; hozirgisi birinchi, tugaganlari oxirida
  const slots: { start: string; end: string; state: LessonState; items: TodayStudent[] }[] = [];
  for (const { s, l } of visible) {
    const slot = slots.find((x) => x.start === l.start && x.end === l.end);
    if (slot) slot.items.push(s);
    else slots.push({ start: l.start, end: l.end, state: lessonState(l, clock.minutes), items: [s] });
  }
  slots.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || toMinutes(a.start) - toMinutes(b.start));
  for (const slot of slots) slot.items.sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid") || a.name.localeCompare(b.name));

  const isOwner = role === "owner";
  // O'qituvchi faqat ko'radi: to'lov kiritish tugmasi yo'q, lekin o'quvchi profiliga kira oladi
  const canPay = role !== "teacher";
  const canOpenProfile = role !== "admin";
  const weekdayName = WEEKDAY_NAMES[clock.weekday - 1];
  const totalDebt = debtorsToday.reduce((sum, x) => sum + x.s.debt, 0);

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
        <div className="group flex min-w-0 items-center gap-3.5">
          <IconTile icon={CalendarClock} tone="sky" variant="solid" />
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Bugun darsga keladi</h2>
            <p className="num mt-0.5 text-sm text-ink-500">
              {dayLabel(clock.iso)} · {all ? `${today.length} ta o‘quvchi, ${debtorsToday.length} tasi to‘lamagan` : `${monthLabel(month)} uchun to‘lamaganlar`}
              {!all && debtorsToday.length ? ` · ${debtorsToday.length} ta, jami ${formatMoney(totalDebt)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
        {showCourseFilter ? (
          <Select
            value={course}
            onChange={setCourse}
            options={[{ value: "", label: "Barcha kurslar" }, ...courseOptions]}
            searchable={false}
            aria-label="Kurs bo‘yicha"
            wrapperClassName="w-full sm:w-44"
          />
        ) : null}
        {showTeacherFilter ? (
          <Select
            value={teacher}
            onChange={setTeacher}
            options={[{ value: "", label: "Barcha o‘qituvchilar" }, ...teacherOptions]}
            searchable={false}
            aria-label="O‘qituvchi bo‘yicha"
            wrapperClassName="w-full sm:w-52"
          />
        ) : null}
        {canToggle ? (
          <div className="flex rounded-xl bg-slate-100 p-1 text-[13px] font-semibold" role="group" aria-label="Ko‘rinish">
            {[
              { v: false, label: "Qarzdorlar", n: debtorsToday.length },
              { v: true, label: "Hammasi", n: today.length },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={all === o.v}
                onClick={() => setShowAll(o.v)}
                className={cx("num rounded-lg px-3 py-1.5 transition", all === o.v ? "bg-surface text-ink-900 shadow-card" : "text-ink-500 hover:text-ink-800")}
              >
                {o.label} {o.n}
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>

      {!students.length ? (
        <Notice icon={CalendarDays}>
          {isOwner ? (
            <>
              O‘quvchilarning dars kunlari va vaqti hali kiritilmagan.{" "}
              <Link href="/students?day=none" className="font-semibold text-brand-600 hover:underline">
                O‘quvchilar
              </Link>{" "}
              sahifasida ularni belgilab, «Dars vaqti» tugmasi bilan jadval qo‘ying — shunda bu yerda bugun kim soat nechida kelishi ko‘rinadi.
            </>
          ) : (
            "Rahbar o‘quvchilarning dars vaqtini kiritgach, bu yerda bugun kim soat nechida kelishi ko‘rinadi."
          )}
        </Notice>
      ) : !today.length ? (
        <Notice icon={Sunrise}>
          {filtered ? "Tanlangan filtr bo‘yicha bugun" : "Bugun"} ({weekdayName.toLowerCase()}) dars yo‘q.
          {debtorsTomorrow ? ` Ertaga ${debtorsTomorrow} ta to‘lamagan o‘quvchi darsga keladi.` : ""}
          {filtered ? (
            <>
              {" "}
              <button type="button" onClick={clearFilters} className="font-semibold text-brand-600 hover:underline">
                Filtrni tozalash
              </button>
            </>
          ) : null}
        </Notice>
      ) : !visible.length ? (
        <Notice icon={UsersRound} tone="emerald">
          Bugun keladigan {today.length} ta o‘quvchining hammasi {monthLabel(month)} uchun to‘lagan 🎉
        </Notice>
      ) : (
        <div className="grid items-start gap-3 border-t border-line-soft bg-slate-50/50 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
          {slots.map((slot) => (
            <section
              key={`${slot.start}-${slot.end}`}
              aria-label={`${slot.start}–${slot.end}`}
              className={cx(
                "min-w-0 rounded-xl border bg-surface shadow-card",
                slot.state === "now" ? "border-emerald-200 ring-2 ring-emerald-500/10" : "border-line",
                slot.state === "done" && "opacity-70",
              )}
            >
              <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line-soft px-4 py-3">
                <p className="num whitespace-nowrap text-[17px] font-bold tracking-[-0.01em] text-ink-900">
                  {slot.start}
                  <span className="ml-1 text-sm font-medium text-ink-400">– {slot.end}</span>
                </p>
                <StatePill state={slot.state} start={slot.start} end={slot.end} minutes={clock.minutes} />
              </header>
              <ul className="divide-y divide-line-soft">
                {slot.items.map((s) => (
                  <li key={s.id} className={cx("flex items-center gap-3 px-4 py-2.5", s.away && "bg-rose-50/40")}>
                    <Avatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      {canOpenProfile ? (
                        <Link href={`/students/${s.id}?month=${month}`} className="block truncate text-[15px] font-medium text-ink-900 hover:text-brand-600">
                          {s.name}
                        </Link>
                      ) : (
                        <span className="block truncate text-[15px] font-medium text-ink-900">{s.name}</span>
                      )}
                      <p className="num mt-0.5 truncate text-[13px]">
                        {s.away ? <AwayBadge away={s.away} className="mr-2" /> : null}
                        {s.status === "paid" ? (
                          <span className="font-medium text-emerald-600">to‘lagan ✓</span>
                        ) : (
                          <>
                            <span className="font-semibold text-amber-700">{formatNumber(s.debt)} so‘m</span>
                            {s.status === "partial" ? <span className="text-ink-400"> · to‘ladi {formatNumber(s.paid)}</span> : null}
                          </>
                        )}
                      </p>
                    </div>
                    {s.phone ? (
                      <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className={cx(btn.icon, "shrink-0")} aria-label={`${s.name}: qo‘ng‘iroq qilish`} title={s.phone}>
                        <Phone className="size-4" aria-hidden />
                      </a>
                    ) : null}
                    {s.status !== "paid" && canPay ? (
                      <Link
                        href={`/payments?${new URLSearchParams({ month, student: s.id })}#yangi-tolov`}
                        className={cx(btn.sm, "shrink-0 px-2.5")}
                        aria-label={`${s.name}: to‘lov kiritish`}
                        title="To‘lov kiritish"
                      >
                        <Plus className="size-4" aria-hidden />
                        <span className="hidden sm:inline">To‘lov</span>
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {unscheduled > 0 && students.length ? (
        <p className="num flex flex-wrap items-center gap-x-2 border-t border-line-soft px-5 py-2.5 text-[13px] text-ink-500 sm:px-6">
          {unscheduled} ta to‘lamagan o‘quvchining dars vaqti kiritilmagan
          {isOwner ? (
            <Link href={`/students?${new URLSearchParams({ day: "none", tab: "debt", month })}`} className="font-semibold text-brand-600 hover:underline">
              Kiritish →
            </Link>
          ) : null}
        </p>
      ) : null}
    </Card>
  );
}

function Notice({ icon: Icon, tone = "slate", children }: { icon: typeof CalendarDays; tone?: "slate" | "emerald"; children: ReactNode }) {
  return (
    <div className={cx("flex items-start gap-3 border-t border-line-soft px-5 py-4 text-sm leading-relaxed sm:px-6", tone === "emerald" ? "text-emerald-800" : "text-ink-600")}>
      <Icon className={cx("mt-0.5 size-[18px] shrink-0", tone === "emerald" ? "text-emerald-500" : "text-ink-400")} strokeWidth={1.8} aria-hidden />
      <p>{children}</p>
    </div>
  );
}
