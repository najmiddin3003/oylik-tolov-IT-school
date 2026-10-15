import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudentForm } from "@/components/StudentForm";
import { Card, PageHeader, PageSkeleton } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { getStudent, listCourses, listScheduleTemplates, listTeacherOptions } from "@/lib/data";
import { currentMonth, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "Tahrirlash" };

export default function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditStudent params={params} />
    </Suspense>
  );
}

async function EditStudent({ params }: { params: PageProps<"/students/[id]/edit">["params"] }) {
  await ownerGuard();
  const { id } = await params;
  const [student, courses, templates, teachers] = await Promise.all([getStudent(id), listCourses(), listScheduleTemplates(), listTeacherOptions()]);
  if (!student) notFound();
  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow="O‘quvchi profili" title="Tahrirlash" subtitle={student.fullName} />
      <Card>
        <StudentForm student={student} courses={courses} today={todayISO()} month={currentMonth()} templates={templates} teachers={teachers} />
      </Card>
    </div>
  );
}
