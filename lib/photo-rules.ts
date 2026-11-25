// Rasm (o'quvchi va xodim): formadan kelgan qiymatni tekshirish (sof funksiya — testlanadi).
// Brauzer rasmni 320 px gacha kichraytirib, "data:image/jpeg;base64,..." ko'rinishida yuboradi.

export const PHOTO_MAX_BYTES = 300 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/webp", "image/png"] as const;

export type PhotoInput =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "set"; type: (typeof PHOTO_TYPES)[number]; base64: string }
  | { kind: "error"; error: string };

/** Forma maydoni: "" — o'zgarmaydi, "remove" — o'chiriladi, data URL — yangi rasm. */
export function parsePhotoField(raw: string | null | undefined): PhotoInput {
  const v = String(raw ?? "").trim();
  if (!v) return { kind: "keep" };
  if (v === "remove") return { kind: "remove" };
  const m = /^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!m) return { kind: "error", error: "Rasm formati noto‘g‘ri (JPG, PNG yoki WebP)" };
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > PHOTO_MAX_BYTES) return { kind: "error", error: "Rasm juda katta" };
  return { kind: "set", type: m[1] as (typeof PHOTO_TYPES)[number], base64: m[2] };
}

/** Rasm manzili (yo'q bo'lsa — null): yangilansa manzil ham o'zgaradi (brauzer keshi eskisini ko'rsatmasin). */
export function photoUrl(owner: "student" | "staff", id: string, photoAt: Date | string | null | undefined): string | null {
  if (!photoAt) return null;
  const v = new Date(photoAt).getTime();
  return Number.isFinite(v) ? `/api/photo/${owner}/${id}?v=${v}` : null;
}
