import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudentForm, TeacherStudentForm } from "@/components/StudentForm";
import { Card, PageHeader, PageSkeleton } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
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
  // Rahbar — hamma maydonlar; o'qituvchi — faqat o'z o'quvchisi (getStudent boshqasini qaytarmaydi), cheklangan maydonlar
  const { role } = await roleGuard(["owner", "teacher"]);
  const { id } = await params;

  if (role === "teacher") {
    const student = await getStudent(id);
    if (!student) notFound();
    return (
      <div className="max-w-5xl">
        <PageHeader eyebrow="O‘quvchi profili" title="Tahrirlash" subtitle={student.fullName} />
        <Card>
          <TeacherStudentForm student={student} />
        </Card>
      </div>
    );
  }

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
