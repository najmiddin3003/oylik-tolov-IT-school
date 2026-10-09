import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentForm } from "@/components/StudentForm";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { listGroups } from "@/lib/data";
import { todayISO } from "@/lib/time";
import { pageGuard } from "@/lib/auth";

export const metadata: Metadata = { title: "Yangi o'quvchi" };

export default function NewStudentPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Yangi o'quvchi" subtitle="O'quvchi ma'lumotlarini kiriting. * — majburiy maydonlar." />
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
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
