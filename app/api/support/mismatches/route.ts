import { connection } from "next/server";
import { sameCourse, teacherCourses } from "@/lib/courses";
import { connectDB } from "@/lib/db";
import { Student, SyncRun } from "@/lib/models";
import { searchScore } from "@/lib/normalize";
import { getSettings } from "@/lib/settings";
import { listTeachers } from "@/lib/staff";
import { supportAuthorized, supportEnabled } from "@/lib/support";

// Texnik yordam: oxirgi Google Sheets tekshiruvidagi mos kelmagan to'lovlar (faqat o'qiydi).
//   /api/support/mismatches?teacher=Ism  — o'qituvchi sahifada ko'radigan farqlar (o'z o'quvchilari va kurslari)
//   &all=1 — hal qilingan / e'tiborsiz qoldirilganlari ham
const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  await connection();
  if (!supportEnabled()) return new Response("Not found", { status: 404 });
  if (!supportAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const params = new URL(request.url).searchParams;
  const teacherQ = (params.get("teacher") ?? "").trim().slice(0, 100);
  const all = params.get("all") === "1";

  await connectDB();
  const [teachers, settings, run] = await Promise.all([
    listTeachers(),
    getSettings({ fresh: true }),
    SyncRun.findOne({ ok: true }).sort({ startedAt: -1 }).lean(),
  ]);
  if (!run) return Response.json({ error: "tekshiruv yo'q" }, { status: 404, headers: NO_STORE });

  // O'qituvchi tanlansa — Google Sheets sahifasidagi bilan bir xil doira: o'z o'quvchilari va o'z kurslari
  let teacher: { id: string; name: string } | null = null;
  let inScope: ((m: { studentId?: unknown; group?: string | null }) => boolean) | null = null;
  let courses: string[] = [];
  if (teacherQ) {
    const best = teachers.map((t) => ({ t, score: searchScore(teacherQ, t.name) })).sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < 0.6) return Response.json({ error: "o'qituvchi topilmadi", teachers: teachers.map((t) => t.name) }, { status: 404, headers: NO_STORE });
    teacher = { id: best.t.id, name: best.t.name };
    const mine = await Student.find({ teacher: best.t.id }, { group: 1 }).lean();
    const ids = new Set(mine.map((s) => String(s._id)));
    courses = [...new Set([...teacherCourses(settings.courses, best.t.id).map((c) => c.name), ...mine.map((s) => s.group ?? "").filter(Boolean)])];
    inScope = (m) => (m.studentId != null && ids.has(String(m.studentId))) || courses.some((c) => sameCourse(m.group ?? "", c));
  }

  const mismatches = (run.mismatches ?? [])
    .filter((m) => (!inScope || inScope(m)) && (all || (!m.resolved && !m.ignored)))
    .map((m) => ({
      kind: m.kind,
      studentName: m.studentName,
      studentId: m.studentId ? String(m.studentId) : null,
      group: m.group,
      month: m.month,
      siteAmount: m.siteAmount,
      sheetAmount: m.sheetAmount,
      sheetDate: m.sheetDate,
      sheetRows: m.sheetRows,
      resolved: m.resolved,
      ignored: m.ignored,
    }));

  return Response.json(
    {
      teacher,
      courses,
      run: { startedAt: run.startedAt.toISOString(), basis: run.basis, monthFrom: run.monthFrom, monthTo: run.monthTo, dateFrom: run.dateFrom, dateTo: run.dateTo },
      count: mismatches.length,
      mismatches,
    },
    { headers: NO_STORE },
  );
}
