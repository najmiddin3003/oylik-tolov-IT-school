import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarX2, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock, GraduationCap, Info, MessageCircleQuestion, Users } from "lucide-react";
import { AttendanceForm, GroupDetails } from "@/components/AttendanceForm";
import { FilterForm } from "@/components/FilterForm";
import { FollowUpList } from "@/components/FollowUps";
import { PersistFilter } from "@/components/PersistFilter";
import { DatePicker, Select } from "@/components/pickers";
import { btn, Card, CardHeader, cx, EmptyState, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { courseKey } from "@/lib/courses";
import type { Role } from "@/lib/session";
import { attendanceOpen, ATTENDANCE_LABEL } from "@/lib/attendance-rules";
import { roleGuard } from "@/lib/auth";
import { getAttendancePage } from "@/lib/data";
import type { AttendanceDayGroup } from "@/lib/attendance";
import { tashkentClock, weekdayOfIso, WEEKDAY_NAMES } from "@/lib/schedule";
import { formatDate, formatDateTime, isoToDate, nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Davomat" };

/** Kurs filtri: «Barcha kurslar» qiymati */
const ALL = "hammasi";

export default function AttendancePage({ searchParams }: PageProps<"/davomat">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AttendanceView searchParams={searchParams} />
    </Suspense>
  );
}

/** "2026-11-10" ± kun */
function shiftDay(iso: string, delta: number): string {
  const d = isoToDate(iso)!;
  return new Date(d.getTime() + delta * 86_400_000 + 12 * 3_600_000).toISOString().slice(0, 10);
}

async function AttendanceView({ searchParams }: { searchParams: PageProps<"/davomat">["searchParams"] }) {
  const { role, staffId } = await roleGuard(["owner", "admin", "teacher"]);
  const sp = await searchParams;
  const kurs = typeof sp.kurs === "string" ? sp.kurs.slice(0, 80) : "";
  const serverNow = nowMs();
  const clock = tashkentClock(serverNow);
  const today = clock.iso;
  const raw = typeof sp.sana === "string" ? sp.sana : "";
  // Kelgusi kun davomati yo'q — bugungacha
  const date = isoToDate(raw) && raw <= today ? raw : today;
  const isToday = date === today;
  const { groups: allGroups, unscheduled, followUps } = await getAttendancePage(date);
  // Kurs filtri: ro'yxatda faqat ko'rinadigan guruhlar kurslari (o'qituvchiga — faqat o'ziniki)
  const courseOptions = [...new Map(allGroups.map((g) => [courseKey(g.course), g.course || "Kursi yo‘q"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  // «hammasi» — barcha kurslar (brauzerda eslab qolinadi, yangi ochilishdan farqlash uchun)
  const selected = courseOptions.some(([k]) => k === kurs) ? kurs : "";
  const groups = selected ? allGroups.filter((g) => courseKey(g.course) === selected) : allGroups;
  const showTeacher = role !== "teacher";

  const totals = groups.reduce(
    (t, g) => ({
      students: t.students + g.summary.total,
      present: t.present + g.summary.present,
      absent: t.absent + g.summary.absent,
      excused: t.excused + g.summary.excused,
      pending: t.pending + (attendanceOpen(date, g.start, clock) && g.summary.missing ? 1 : 0),
    }),
    { students: 0, present: 0, absent: 0, excused: 0, pending: 0 },
  );
  const href = (d: string) => {
    const q = new URLSearchParams({ ...(d === today ? {} : { sana: d }), ...(courseOptions.length > 1 ? { kurs: selected || ALL } : {}) }).toString();
    return q ? `/davomat?${q}` : "/davomat";
  };

  return (
    <>
      <PageHeader
        eyebrow="Davomat"
        title={isToday ? "Bugungi davomat" : `${WEEKDAY_NAMES[weekdayOfIso(date) - 1]}, ${formatDate(date)}`}
        subtitle={`${isToday ? `${WEEKDAY_NAMES[clock.weekday - 1]}, ${formatDate(date)}. ` : ""}Har bir guruh davomati dars boshlanganidan 30 daqiqa o‘tib ochiladi. «Kelmadi» va «Sababli» uchun izoh majburiy.`}
        actions={
          <FilterForm action="/davomat" className="flex flex-wrap items-center gap-2">
            <Link href={href(shiftDay(date, -1))} className={cx(btn.outline, "px-3")} aria-label="Oldingi kun" scroll={false}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            {courseOptions.length > 1 ? (
              <Select
                name="kurs"
                defaultValue={selected || ALL}
                autoSubmit
                searchable={false}
                aria-label="Kurs"
                wrapperClassName="w-full sm:w-56"
                options={[{ value: ALL, label: "Barcha kurslar" }, ...courseOptions.map(([value, label]) => ({ value, label }))]}
              />
            ) : null}
            <DatePicker name="sana" defaultValue={date} autoSubmit max={today} aria-label="Sana" wrapperClassName="w-60" />
            {isToday ? (
              <span className={cx(btn.outline, "pointer-events-none px-3 opacity-40")} aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            ) : (
              <Link href={href(shiftDay(date, 1))} className={cx(btn.outline, "px-3")} aria-label="Keyingi kun" scroll={false}>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
            {!isToday ? (
              <Link href={href(today)} className={btn.outline} scroll={false}>
                Bugun
              </Link>
            ) : null}
          </FilterForm>
        }
      />

      {groups.length ? (
        <div className="num mb-5 flex flex-wrap items-center gap-2 text-sm">
          <Tag>
            <Users className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {groups.length} ta guruh · {totals.students} ta o‘quvchi
          </Tag>
          <Tag tone="emerald">Keldi: {totals.present}</Tag>
          <Tag tone="rose">Kelmadi: {totals.absent}</Tag>
          <Tag tone="amber">Sababli: {totals.excused}</Tag>
          {totals.pending ? <Tag tone="rose">Davomat qilinmagan guruhlar: {totals.pending}</Tag> : null}
        </div>
      ) : null}

      {unscheduled ? (
        <p className="mb-5 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            {unscheduled} ta faol o‘quvchining dars vaqti kiritilmagan — ular davomatda ko‘rinmaydi.{" "}
            {role !== "admin" ? (
              <Link href="/students?day=none" className="font-medium text-brand-700 hover:underline">
                Ro‘yxatni ko‘rish
              </Link>
            ) : null}
          </span>
        </p>
      ) : null}

      {/* Tanlangan kurs brauzerda eslab qolinadi (sahifa yangilansa ham) */}
      {courseOptions.length > 1 ? <PersistFilter param="kurs" storageKey={`tt-davomat-kurs:${staffId ?? role}`} /> : null}

      {followUps.length ? (
        <Card id="sabab" className="mb-5 scroll-mt-24 border-rose-200/80">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <MessageCircleQuestion className="size-5 text-rose-600" aria-hidden />
                Sababini o‘rganing
              </span>
            }
            count={followUps.length}
            subtitle="O‘tgan darsga kelmagan o‘quvchilar — keyingi darsi boshlandi. Gaplashib, izoh yozing."
          />
          <div className="border-t border-line-soft">
            <FollowUpList items={followUps} role={role} />
          </div>
        </Card>
      ) : null}

      {groups.length === 0 ? (
        <Card>
          <EmptyState title={isToday ? "Bugun dars yo‘q" : "Bu kuni dars bo‘lmagan"} icon={CalendarX2}>
            Davomat o‘quvchilarning dars jadvali bo‘yicha tuziladi (o‘quvchi profilida «Dars vaqti»).
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <GroupCard key={g.key} g={g} date={date} open={attendanceOpen(date, g.start, clock)} showTeacher={showTeacher} serverNow={serverNow} role={role} />
          ))}
        </div>
      )}
    </>
  );
}

function GroupCard({
  g,
  date,
  open,
  showTeacher,
  serverNow,
  role,
}: {
  g: AttendanceDayGroup;
  date: string;
  open: boolean;
  showTeacher: boolean;
  serverNow: number;
  role: Role;
}) {
  const s = g.summary;
  const done = s.missing === 0;
  const last = Object.values(g.marks).sort((a, b) => b.at.localeCompare(a.at))[0];
  return (
    <Card className="overflow-hidden">
      {/* Qilingan guruhlar yig'iq — bosilsa ochiladi (tahrirlash mumkin) */}
      <GroupDetails defaultOpen={!done && open} summary={<GroupSummary g={g} open={open} done={done} last={last} showTeacher={showTeacher} />}>
        <AttendanceForm
          date={date}
          start={g.start}
          end={g.end}
          opensAt={g.opensAt}
          students={g.students.map((x) => ({ id: x.id, name: x.name, seq: x.seq }))}
          initial={Object.fromEntries(Object.entries(g.marks).map(([id, m]) => [id, { status: m.status, note: m.note }]))}
          serverNow={serverNow}
          role={role}
        />
      </GroupDetails>
      {done ? <AbsentNotes g={g} /> : null}
    </Card>
  );
}

/** Guruh sarlavhasi: vaqti, kursi, o'qituvchisi va davomat holati. */
function GroupSummary({
  g,
  open,
  done,
  last,
  showTeacher,
}: {
  g: AttendanceDayGroup;
  open: boolean;
  done: boolean;
  last: AttendanceDayGroup["marks"][string] | undefined;
  showTeacher: boolean;
}) {
  const s = g.summary;
  return (
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
      <span className="num inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-ink-800">
        <Clock className="size-4 text-ink-400" aria-hidden />
        {g.start}–{g.end}
      </span>
      <span className="min-w-[11rem] flex-1">
        <span className="block truncate text-[16px] font-semibold text-ink-900">{g.course || "Kursi yo‘q"}</span>
        <span className="num block text-[13px] text-ink-500">
          {s.total} ta o‘quvchi
          {showTeacher ? (
            <>
              {" · "}
              <GraduationCap className="inline size-3.5 align-[-2px]" aria-hidden /> {g.teacherName || "o‘qituvchi biriktirilmagan"}
            </>
          ) : null}
          {last ? ` · oxirgi: ${last.by || "—"}, ${formatDateTime(last.at)}` : ""}
        </span>
      </span>
      <span className="num flex flex-wrap items-center gap-1.5">
        {!open ? (
          <Tag>{g.opensAt} da ochiladi</Tag>
        ) : done ? (
          <Tag tone="emerald">
            <CircleCheck className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            Qilindi
          </Tag>
        ) : s.missing === s.total ? (
          <Tag tone="rose">Davomat qilinmagan</Tag>
        ) : (
          <Tag tone="amber">{s.missing} ta belgilanmagan</Tag>
        )}
        {s.present ? <Tag tone="emerald">{ATTENDANCE_LABEL.present}: {s.present}</Tag> : null}
        {s.absent ? <Tag tone="rose">{ATTENDANCE_LABEL.absent}: {s.absent}</Tag> : null}
        {s.excused ? <Tag tone="amber">{ATTENDANCE_LABEL.excused}: {s.excused}</Tag> : null}
        <span className="ml-1 inline-flex size-9 items-center justify-center rounded-full bg-slate-100 text-ink-600 transition group-open/d:rotate-180" aria-hidden>
          <ChevronDown className="size-5" strokeWidth={2.2} />
        </span>
      </span>
    </summary>
  );
}

/** Qilingan guruhda: kelmagan va sababli o'quvchilar izohi (yig'iq holatda ham ko'rinadi). */
function AbsentNotes({ g }: { g: AttendanceDayGroup }) {
  const rows = g.students.flatMap((s) => {
    const m = g.marks[s.id];
    return m && m.status !== "present" ? [{ s, m }] : [];
  });
  if (!rows.length) return null;
  return (
    // Guruh ochilganda (formada izohlar bor) — yashiriladi
    <ul className="grid gap-1 border-t border-line-soft bg-slate-50/60 px-5 py-3 text-[13px] sm:px-6 [details[open]~&]:hidden">
      {rows.map(({ s, m }) => (
        <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-ink-800">{s.name}</span>
          <Tag tone={m.status === "absent" ? "rose" : "amber"}>{ATTENDANCE_LABEL[m.status]}</Tag>
          <span className="text-ink-600">{m.note}</span>
        </li>
      ))}
    </ul>
  );
}
