import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentForm } from "@/components/StudentForm";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import { listGroups } from "@/lib/data";
import { todayISO } from "@/lib/time";

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
  await pageGuard();
  const groups = await listGroups();
  return <StudentForm groups={groups} today={todayISO()} />;
}
