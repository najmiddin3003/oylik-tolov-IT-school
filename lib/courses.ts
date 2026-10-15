// Kurslar: o'quvchining «guruh» maydoni kurs nomi bilan yuritiladi (masalan, "Web dasturlash").
// Sof funksiyalar — server va brauzerda ishlatiladi (testlanadi).
import { normalizeText } from "./normalize";

export type Course = { name: string; fee: number | null };

/** Markazdagi kurslar (rahbar Sozlamalar → Kurslar bo'limida o'zgartiradi). */
export const DEFAULT_COURSES: Course[] = [
  { name: "Web dasturlash", fee: 300_000 },
  { name: "Kompyuter savodxonligi", fee: null },
  { name: "Grafik dizayn", fee: null },
];

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

/** Sozlamalardan o'qilgan ro'yxatni tozalash (bo'sh nomlar, takrorlar, noto'g'ri narxlar olib tashlanadi). */
export function normalizeCourses(raw: { name?: string | null; fee?: number | null }[] | null | undefined): Course[] {
  if (!raw) return DEFAULT_COURSES;
  const out: Course[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const name = cleanCourseName(String(c.name ?? ""));
    const k = courseKey(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ name, fee: typeof c.fee === "number" && c.fee > 0 ? Math.round(c.fee) : null });
  }
  return out;
}
