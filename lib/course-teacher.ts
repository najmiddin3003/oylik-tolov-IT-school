// Kurs o'qituvchisi: Sozlamalar → Kurslar bo'limida kursga biriktirilgan o'qituvchi shu kurs o'quvchilariga avtomatik
// biriktiriladi — oyligi shu o'quvchilar to'lovlaridan hisoblanadi. Ruxsat tekshiruvi chaqiruvchida.
// "server-only" qo'yilmagan: Sheets importi orqali ichki rejalashtiruvchi (instrumentation) ham ishlatadi.
import { connectDB } from "./db";
import { courseStudentsToAssign, coursesForStorage, courseTeacher, sameCourse, type Course } from "./courses";
import { Staff, Student } from "./models";
import { getSettings, updateSettings } from "./settings";
import { TEACHING_FILTER } from "./staff-rules";

/**
 * Kurs nomi -> kurs o'qituvchisi (yangi o'quvchi, import, kurs almashtirish uchun). Kirishi o'chirilgan yoki dars bermay
 * qolgan xodim biriktirilmaydi. Sozlamalar bir marta o'qiladi — ko'p o'quvchi uchun qayta-qayta chaqirsa bo'ladi.
 */
export async function courseTeacherResolver(): Promise<(group: string | null | undefined) => string | null> {
  await connectDB();
  const [settings, teachers] = await Promise.all([
    getSettings({ fresh: true }),
    Staff.find({ ...TEACHING_FILTER, status: { $ne: "disabled" } }, { _id: 1 }).lean<{ _id: unknown }[]>(),
  ]);
  const usable = new Set(teachers.map((t) => String(t._id)));
  return (group) => {
    const id = courseTeacher(settings.courses, group);
    return id && usable.has(id) ? id : null;
  };
}

/**
 * Kursga o'qituvchi biriktirilganda: shu kursdagi o'qituvchisiz o'quvchilar (faol va nofaol — o'tgan oylar oyligi ham
 * to'g'ri hisoblansin) va avvalgi kurs o'qituvchisining o'quvchilari unga o'tadi. Nechta o'quvchi o'tganini qaytaradi.
 */
export async function assignCourseStudents(course: string, teacher: string, previous: string | null): Promise<number> {
  await connectDB();
  const students = await Student.find({}, { group: 1, teacher: 1 }).lean<{ _id: unknown; group?: string | null; teacher?: unknown }[]>();
  const ids = courseStudentsToAssign(
    students.map((s) => ({ id: String(s._id), group: s.group, teacher: s.teacher ? String(s.teacher) : null })),
    course,
    teacher,
    previous,
  );
  if (!ids.length) return 0;
  const res = await Student.updateMany({ _id: { $in: ids } }, { $set: { teacher } });
  return res.modifiedCount;
}

/** Xodim o'qituvchi bo'lmay qolsa yoki o'chirilsa — kurslar o'qituvchilari ro'yxatidan olib tashlanadi (o'quvchilari o'zgarmaydi). */
export async function clearCourseTeacher(staffId: string): Promise<void> {
  const { courses } = await getSettings({ fresh: true });
  if (!courses.some((c) => c.teachers.includes(staffId))) return;
  const next: Course[] = courses.map((c) => (c.teachers.includes(staffId) ? { ...c, teachers: c.teachers.filter((t) => t !== staffId) } : c));
  await updateSettings({ $set: { courses: coursesForStorage(next) } });
}

/**
 * Kursga o'qituvchi qo'shish (mavjudlari qoladi). Kursda shu bitta o'qituvchi bo'lib qolsa — kursdagi o'qituvchisiz
 * o'quvchilar unga biriktiriladi; bir nechta bo'lsa — o'quvchilar o'zgarmaydi (ustoz qo'lda tanlanadi).
 * Nechta o'quvchi biriktirilganini qaytaradi; kurs topilmasa — null.
 */
export async function addCourseTeacher(courseName: string, staffId: string): Promise<{ course: string; assigned: number; teachers: number } | null> {
  const { courses } = await getSettings({ fresh: true });
  const course = courses.find((c) => sameCourse(c.name, courseName));
  if (!course) return null;
  const teachers = course.teachers.includes(staffId) ? course.teachers : [...course.teachers, staffId];
  await updateSettings({ $set: { courses: coursesForStorage(courses.map((c) => (c === course ? { ...c, teachers } : c))) } });
  const assigned = teachers.length === 1 ? await assignCourseStudents(course.name, staffId, null) : 0;
  return { course: course.name, assigned, teachers: teachers.length };
}
