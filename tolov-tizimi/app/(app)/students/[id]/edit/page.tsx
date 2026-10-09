import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudentForm } from "@/components/StudentForm";
import { Card, PageHeader, PageSkeleton } from "@/components/ui";
import { getStudent, listGroups } from "@/lib/data";
import { todayISO } from "@/lib/time";
import { pageGuard } from "@/lib/auth";

export const metadata: Metadata = { title: "Tahrirlash" };

export default function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditStudent params={params} />
    </Suspense>
  );
}

async function EditStudent({ params }: { params: PageProps<"/students/[id]/edit">["params"] }) {
  await pageGuard();
  const { id } = await params;
  const [student, groups] = await Promise.all([getStudent(id), listGroups()]);
  if (!student) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title="O'quvchini tahrirlash" subtitle={student.fullName} />
      <Card className="p-5 sm:p-6">
        <StudentForm student={student} groups={groups} today={todayISO()} />
      </Card>
    </div>
  );
}
