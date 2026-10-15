// Kurs o'qituvchisi: Sozlamalar → Kurslar bo'limida kursga biriktirilgan o'qituvchi shu kurs o'quvchilariga avtomatik
// biriktiriladi — oyligi shu o'quvchilar to'lovlaridan hisoblanadi. Ruxsat tekshiruvi chaqiruvchida.
// "server-only" qo'yilmagan: Sheets importi orqali ichki rejalashtiruvchi (instrumentation) ham ishlatadi.
import { connectDB } from "./db";
import { courseStudentsToAssign, courseTeacher, type Course } from "./courses";
import { Staff, Student } from "./models";
import { getSettings, updateSettings } from "./settings";

/**
 * Kurs nomi -> kurs o'qituvchisi (yangi o'quvchi, import, kurs almashtirish uchun). Kirishi o'chirilgan yoki o'qituvchi
 * bo'lmay qolgan xodim biriktirilmaydi. Sozlamalar bir marta o'qiladi — ko'p o'quvchi uchun qayta-qayta chaqirsa bo'ladi.
 */
export async function courseTeacherResolver(): Promise<(group: string | null | undefined) => string | null> {
  await connectDB();
  const [settings, teachers] = await Promise.all([
    getSettings({ fresh: true }),
    Staff.find({ role: "teacher", status: { $ne: "disabled" } }, { _id: 1 }).lean<{ _id: unknown }[]>(),
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

/** Xodim o'qituvchi bo'lmay qolsa yoki o'chirilsa — kurslardagi o'qituvchi belgisi olib tashlanadi (o'quvchilari o'zgarmaydi). */
export async function clearCourseTeacher(staffId: string): Promise<void> {
  const { courses } = await getSettings({ fresh: true });
  if (!courses.some((c) => c.teacher === staffId)) return;
  const next: Course[] = courses.map((c) => (c.teacher === staffId ? { ...c, teacher: null } : c));
  await updateSettings({ $set: { courses: next } });
}
