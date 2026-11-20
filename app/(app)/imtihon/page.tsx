import type { Metadata } from "next";
import { Suspense } from "react";
import { ExamScreen } from "@/components/ExamScreen";
import { PageSkeleton } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { examDay } from "@/lib/exam";
import { openaiConfigured } from "@/lib/openai";
import { tashkentClock } from "@/lib/schedule";
import { isoToDate, nowMs } from "@/lib/time";

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

async function ExamView({ searchParams }: { searchParams: PageProps<"/imtihon">["searchParams"] }) {
  const { role, staffId } = await roleGuard(["owner", "teacher"]);
  const sp = await searchParams;
  const today = tashkentClock(nowMs()).iso;
  const raw = typeof sp.sana === "string" ? sp.sana : "";
  const date = isoToDate(raw) ? raw : today;
  const groups = await examDay(role === "teacher" ? staffId : null, date);
  // Kun almashtirish va kurs filtri — client tomonda (sahifa qayta yuklanmaydi)
  return (
    <ExamScreen
      initialDate={date}
      today={today}
      initialGroups={groups}
      aiReady={openaiConfigured()}
      role={role}
      storageKey={`tt-imtihon-kurs:${staffId ?? role}`}
    />
  );
}
