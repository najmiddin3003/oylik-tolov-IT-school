// Kurslar: o'quvchining «guruh» maydoni kurs nomi bilan yuritiladi (masalan, "Web dasturlash").
// Sof funksiyalar — server va brauzerda ishlatiladi (testlanadi).
import { normalizeText } from "./normalize";

export type Course = {
  name: string;
  fee: number | null;
  /** Kurs o'qituvchisi (xodim ID): shu kursdagi o'quvchilar unga biriktiriladi. Belgilanmagan — null */
  teacher: string | null;
};

/** Markazdagi kurslar (rahbar Sozlamalar → Kurslar bo'limida o'zgartiradi). */
export const DEFAULT_COURSES: Course[] = [
  { name: "Web dasturlash", fee: 300_000, teacher: null },
  { name: "Kompyuter savodxonligi", fee: null, teacher: null },
  { name: "Grafik dizayn", fee: null, teacher: null },
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
  return courses.find((c) => sameCourse(c.name, name))?.teacher ?? null;
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
 * O'quvchining kursi tanlanganda (yoki o'zgarganda) o'qituvchisi: bo'sh bo'lsa yoki avvalgi kursning o'qituvchisi bo'lsa —
 * yangi kursning o'qituvchisi qo'yiladi (yangi kursda o'qituvchi bo'lmasa — bo'sh). Boshqa o'qituvchi tanlangan bo'lsa — o'zgarmaydi.
 */
export function teacherOnCourseChange(current: string | null, oldCourseTeacher: string | null, newCourseTeacher: string | null): string | null {
  if (!current || (oldCourseTeacher !== null && current === oldCourseTeacher)) return newCourseTeacher;
  return current;
}

/** Sozlamalardan o'qilgan ro'yxatni tozalash (bo'sh nomlar, takrorlar, noto'g'ri narxlar olib tashlanadi). */
export function normalizeCourses(raw: { name?: string | null; fee?: number | null; teacher?: unknown }[] | null | undefined): Course[] {
  if (!raw) return DEFAULT_COURSES;
  const out: Course[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const name = cleanCourseName(String(c.name ?? ""));
    const k = courseKey(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const teacher = c.teacher ? String(c.teacher) : "";
    out.push({ name, fee: typeof c.fee === "number" && c.fee > 0 ? Math.round(c.fee) : null, teacher: OBJECT_ID.test(teacher) ? teacher : null });
  }
  return out;
}
