// Xodimlar: rollar nomi, oylik foizi va sessiya barmoq izi (sof funksiyalar — server, brauzer va testlarda).
// Brauzerda ham ishlatiladi — node:crypto ga bog'liq narsa bu yerda yo'q.
import { percentFor, type PercentChange } from "./fees";
import type { Role } from "./session";

export type StaffStatus = "invited" | "active" | "disabled";
export type ShareBase = "students" | "center";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Rahbar",
  admin: "Administrator",
  teacher: "O‘qituvchi",
};

export const ROLE_HINT: Record<Role, string> = {
  owner: "Markaz rahbari — hamma bo‘limlar, xodimlar va moliya",
  admin: "To‘lovlarni kiritadi, qarzdorlarni ko‘radi",
  teacher: "O‘z o‘quvchilari, ularning to‘lovlari va oyligini ko‘radi",
};

export const STATUS_LABEL: Record<StaffStatus, string> = {
  invited: "Ro‘yxatdan o‘tmagan",
  active: "Faol",
  disabled: "Kirishi o‘chirilgan",
};

/** Oylik foizi nimadan: o'qituvchi — o'z o'quvchilari to'lovlaridan, administrator — butun markaz tushumidan. */
export function defaultShareBase(role: Role): ShareBase {
  return role === "teacher" ? "students" : "center";
}

/** Yangi xodim uchun standart foiz: o'qituvchi — 40%, qolganlar — 0 (oylik hisoblanmaydi). */
export function defaultPercent(role: Role): number {
  return role === "teacher" ? 40 : 0;
}

/** "40", "37,5" -> 40, 37.5; 0–100 oralig'idan tashqari yoki noto'g'ri — null. */
export function parsePercent(raw: unknown): number | null {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim().replace(",", ".") : "";
  if (!s || !/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}

/** Xodimning shu oydagi foizi (tarix bo'lmasa — 0). */
export function staffPercent(history: PercentChange[], month: string): number {
  return percentFor(history, month, 0);
}

/** Oylik: foiz × asos (tushum), olingan oylik/avans ayiriladi. */
export function payOf(base: number, percent: number, taken: number) {
  const share = Math.round((base * percent) / 100);
  return { base, percent, share, taken, left: share - taken };
}

/**
 * Eski umumiy parol (rahbar / administrator) bilan kirish faqat o'tish davrida: shu roldagi faol xodim
 * profili paydo bo'lishi bilan eski parol ishlamay qoladi.
 */
export function legacyLoginAllowed(role: Role, activeStaffRoles: ReadonlySet<Role>): boolean {
  if (role === "teacher") return false;
  return !activeStaffRoles.has(role);
}

/** "Najmiddin Karimov" -> "NK" */
export function staffInitials(name: string): string {
  const parts = name.replace(/[ʻʼ'`‘’]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
