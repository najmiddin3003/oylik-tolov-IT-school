import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentForm } from "@/components/StudentForm";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { listGroups, listScheduleTemplates } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { currentMonth, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "Yangi o‘quvchi" };

export default function NewStudentPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow="O‘quvchilar bazasi" title="Yangi o‘quvchi" subtitle="O‘quvchi ma’lumotlarini kiriting. * — majburiy maydonlar." />
      <Card>
        <Suspense fallback={<Skeleton className="m-6 h-96" />}>
          <NewStudentForm />
        </Suspense>
      </Card>
    </div>
  );
}

async function NewStudentForm() {
  await ownerGuard();
  const [groups, settings, templates] = await Promise.all([listGroups(), getSettings(), listScheduleTemplates()]);
  const standard = settings.defaultFee === null ? null : { base: settings.defaultFee, schedule: settings.feeSchedule };
  return <StudentForm groups={groups} today={todayISO()} month={currentMonth()} standard={standard} templates={templates} />;
}
