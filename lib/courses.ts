// Kurslar: o'quvchining «guruh» maydoni kurs nomi bilan yuritiladi (masalan, "Web dasturlash").
// Sof funksiyalar — server va brauzerda ishlatiladi (testlanadi).
import { normalizeText } from "./normalize";

export type Course = {
  name: string;
  fee: number | null;
  /**
   * Kurs o'qituvchilari (xodim ID lari). Bitta bo'lsa — shu kursdagi o'quvchilar unga avtomatik biriktiriladi;
   * bir nechta bo'lsa — o'quvchining ustozi qo'lda tanlanadi.
   */
  teachers: string[];
};

/** Markazdagi kurslar (rahbar Sozlamalar → Kurslar bo'limida o'zgartiradi). */
export const DEFAULT_COURSES: Course[] = [
  { name: "Web dasturlash", fee: 300_000, teachers: [] },
  { name: "Kompyuter savodxonligi", fee: null, teachers: [] },
  { name: "Grafik dizayn", fee: null, teachers: [] },
];

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Taqqoslash kaliti: katta-kichik harf, bo'shliq va apostrof farqisiz. */
export function courseKey(name: string | null | undefined): string {
  return normalizeText(String(name ?? ""));
}

export function sameCourse(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = courseKey(a);
  return ka !== "" && ka === courseKey(b);
}

/** Nomni tozalash: ortiqcha bo'shliqlarsiz, 80 belgigacha. */
export function cleanCourseName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Tanlash ro'yxati uchun: sozlamalardagi kurslar + o'quvchilarda uchraydigan, lekin ro'yxatda yo'q nomlar
 * (masalan, Sheets'dan import qilingan eski guruh nomlari). Takrorlanmaydi.
 */
export function courseNames(courses: Course[], groups: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [...courses.map((c) => c.name), ...groups]) {
    const k = courseKey(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(cleanCourseName(name));
  }
  return out;
}

/** Kursning standart oylik narxi (belgilanmagan bo'lsa — null). */
export function courseFee(courses: Course[], name: string): number | null {
  return courses.find((c) => sameCourse(c.name, name))?.fee ?? null;
}

/** Kurs o'qituvchisi (belgilanmagan bo'lsa — null). */
export function courseTeacher(courses: Course[], name: string | null | undefined): string | null {
  const teachers = courseTeachers(courses, name);
  // Avtomatik biriktirish faqat kursda bitta o'qituvchi bo'lsa (bir nechta bo'lsa — kimga ekanini qo'lda tanlash kerak)
  return teachers.length === 1 ? teachers[0] : null;
}

/** Kursning barcha o'qituvchilari (bo'lmasa — bo'sh ro'yxat). */
export function courseTeachers(courses: Course[], name: string | null | undefined): string[] {
  return courses.find((c) => sameCourse(c.name, name))?.teachers ?? [];
}

/**
 * Kursga o'qituvchi biriktirilganda unga o'tadigan o'quvchilar: shu kursdagi o'qituvchisi yo'qlar va (kurs o'qituvchisi
 * almashgan bo'lsa) avvalgi kurs o'qituvchisining o'quvchilari. Boshqa o'qituvchiga alohida biriktirilganlar o'zgarmaydi.
 */
export function courseStudentsToAssign(
  students: { id: string; group?: string | null; teacher?: string | null }[],
  course: string,
  teacher: string,
  previous: string | null = null,
): string[] {
  return students
    .filter((s) => sameCourse(s.group, course) && s.teacher !== teacher && (!s.teacher || s.teacher === previous))
    .map((s) => s.id);
}

/**
 * O'quvchining kursi tanlanganda (yoki o'zgarganda) o'qituvchisi:
 * - joriy o'qituvchi yangi kursning o'qituvchilaridan biri bo'lsa — o'zgarmaydi;
 * - bo'sh bo'lsa yoki avvalgi kursning (yagona) o'qituvchisi bo'lsa — yangi kursning yagona o'qituvchisi qo'yiladi
 *   (yangi kursda o'qituvchi yo'q yoki bir nechta bo'lsa — bo'sh: qo'lda tanlanadi);
 * - boshqa o'qituvchi tanlangan bo'lsa — o'zgarmaydi.
 */
export function teacherOnCourseChange(
  current: string | null,
  oldCourseTeacher: string | null,
  newCourseTeacher: string | null,
  newCourseTeachers: string[] = [],
): string | null {
  if (current && newCourseTeachers.includes(current)) return current;
  if (!current || (oldCourseTeacher !== null && current === oldCourseTeacher)) return newCourseTeacher;
  return current;
}

/** Sozlamalardan o'qilgan ro'yxatni tozalash (bo'sh nomlar, takrorlar, noto'g'ri narxlar olib tashlanadi). */
export function normalizeCourses(
  raw: { name?: string | null; fee?: number | null; teacher?: unknown; teachers?: unknown }[] | null | undefined,
): Course[] {
  if (!raw) return DEFAULT_COURSES;
  const out: Course[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const name = cleanCourseName(String(c.name ?? ""));
    const k = courseKey(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    // O'qituvchilar ro'yxati; eski yozuvlarda — bitta "teacher" maydoni
    const list = Array.isArray(c.teachers) && c.teachers.length ? c.teachers : c.teacher ? [c.teacher] : [];
    const teachers = [...new Set(list.map((t) => String(t ?? "")).filter((t) => OBJECT_ID.test(t)))];
    out.push({ name, fee: typeof c.fee === "number" && c.fee > 0 ? Math.round(c.fee) : null, teachers });
  }
  return out;
}

/** Bazaga yoziladigan ko'rinish: o'qituvchilar ro'yxati + eski versiya uchun yagona o'qituvchi ("teacher"). */
export function coursesForStorage(courses: Course[]): { name: string; fee: number | null; teachers: string[]; teacher: string | null }[] {
  return courses.map((c) => ({ name: c.name, fee: c.fee, teachers: c.teachers, teacher: c.teachers.length === 1 ? c.teachers[0] : null }));
}
