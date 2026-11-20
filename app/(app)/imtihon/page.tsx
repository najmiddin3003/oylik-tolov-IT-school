import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { ExamBoard } from "@/components/ExamBoard";
import { FilterForm } from "@/components/FilterForm";
import { DatePicker } from "@/components/pickers";
import { btn, Card, cx, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { examDay } from "@/lib/exam";
import { openaiConfigured } from "@/lib/openai";
import { tashkentClock, weekdayOfIso, WEEKDAY_NAMES } from "@/lib/schedule";
import { formatDate, isoToDate, nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Imtihon" };
// ChatGPT savol tuzishi 10–30 soniya olishi mumkin
export const maxDuration = 60;

export default function ExamPage({ searchParams }: PageProps<"/imtihon">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExamView searchParams={searchParams} />
    </Suspense>
  );
}

/** "2026-11-20" ± kun */
function shiftDay(iso: string, delta: number): string {
  const d = isoToDate(iso)!;
  return new Date(d.getTime() + delta * 86_400_000 + 12 * 3_600_000).toISOString().slice(0, 10);
}

async function ExamView({ searchParams }: { searchParams: PageProps<"/imtihon">["searchParams"] }) {
  const { role, staffId } = await roleGuard(["owner", "teacher"]);
  const sp = await searchParams;
  const today = tashkentClock(nowMs()).iso;
  const raw = typeof sp.sana === "string" ? sp.sana : "";
  const date = isoToDate(raw) ? raw : today;
  const groups = await examDay(role === "teacher" ? staffId : null, date);
  const day = WEEKDAY_NAMES[weekdayOfIso(date) - 1];
  const href = (d: string) => (d === today ? "/imtihon" : `/imtihon?sana=${d}`);

  return (
    <>
      <PageHeader
        eyebrow="Imtihon"
        title={`${date === today ? "Bugungi imtihon" : "Imtihon"} — ${day}, ${formatDate(date)}`}
        subtitle={`${day} kuni darsga keladigan o‘quvchilar (dars jadvali bo‘yicha). Mavzularni tanlang — ChatGPT har biriga 10 ta savolni javoblari bilan tuzadi, oxirida ball qo‘ying.`}
        actions={
          <FilterForm action="/imtihon" className="flex flex-wrap items-center gap-2">
            <Link href={href(shiftDay(date, -1))} className={cx(btn.outline, "px-3")} aria-label="Oldingi kun" scroll={false}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <DatePicker name="sana" defaultValue={date} autoSubmit aria-label="Sana" wrapperClassName="w-60" />
            <Link href={href(shiftDay(date, 1))} className={cx(btn.outline, "px-3")} aria-label="Keyingi kun" scroll={false}>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
            {date !== today ? (
              <Link href="/imtihon" className={btn.outline} scroll={false}>
                Bugun
              </Link>
            ) : null}
          </FilterForm>
        }
      />
      {groups.length ? (
        <ExamBoard key={date} date={date} groups={groups} aiReady={openaiConfigured()} role={role} />
      ) : (
        <Card>
          <EmptyState title={`${day} kuni dars yo‘q`} icon={CalendarX2}>
            Ro‘yxat o‘quvchilarning dars jadvali bo‘yicha tuziladi (o‘quvchi profilida «Dars vaqti»).
          </EmptyState>
        </Card>
      )}
    </>
  );
}
