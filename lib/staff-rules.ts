// Xodimlar: rollar nomi, oylik foizi va sessiya barmoq izi (sof funksiyalar — server, brauzer va testlarda).
// Brauzerda ham ishlatiladi — node:crypto ga bog'liq narsa bu yerda yo'q.
import { amountFor, percentFor, type AmountChange, type PercentChange } from "./fees";
import { normalizeUzPhone } from "./phone";
import type { Role } from "./session";

/**
 * Rahbarning telefon raqami: rahbar profili hali umuman yo'q bo'lsa, shu raqam kirish sahifasida birinchi marta
 * kiritilganda profil o'zi yaratiladi va SMS kod yuboriladi. Vercel'da OWNER_PHONE bilan almashtirsa bo'ladi.
 */
export const DEFAULT_OWNER_PHONE = "998941761405";

/** Rahbar raqami: OWNER_PHONE (to'g'ri bo'lsa) yoki standart. */
export function ownerPhone(envValue: string | undefined): string {
  return normalizeUzPhone(envValue ?? "") ?? DEFAULT_OWNER_PHONE;
}

export type StaffStatus = "invited" | "active" | "disabled";
export type ShareBase = "students" | "center";
/** Oylik turi: tushumdan foiz yoki belgilangan summa */
export type PayKind = "percent" | "fixed";

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

/**
 * Dars beradimi (o'qituvchilar ro'yxatlarida ko'rinadi, kurs va o'quvchi biriktiriladi): o'qituvchi yoki
 * «dars ham beradi» belgisi qo'yilgan rahbar (masalan, o'zi ham guruh o'qitadigan rahbar).
 */
export function isTeaching(s: { role: Role; teaches?: boolean | null }): boolean {
  return s.role === "teacher" || (s.role === "owner" && s.teaches === true);
}

/** Bazadan dars beradigan xodimlarni olish sharti — `isTeaching` bilan bir xil. */
export const TEACHING_FILTER = { $or: [{ role: "teacher" as const }, { role: "owner" as const, teaches: true }] };

/** Oylik turi: administrator — belgilangan oylik (har oy bir xil summa), o'qituvchi va rahbar — tushumdan foiz. */
export function payKindOf(role: Role): PayKind {
  return role === "admin" ? "fixed" : "percent";
}

/** Oylik foizi nimadan: o'qituvchi — o'z o'quvchilari to'lovlaridan, rahbar — butun markaz tushumidan. */
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

/** Xodimning shu oydagi belgilangan oyligi (tarix bo'lmasa — 0). */
export function staffSalary(history: AmountChange[], month: string): number {
  return amountFor(history, month, 0);
}

/**
 * To'lov qaysi oy oyligiga hisoblanadi: pul olingan oy, lekin to'lov qaysi oy uchun bo'lsa — o'sha oydan oldin emas.
 * O'tgan oy qarzi uchun oktabrda olingan pul — oktabr oyligiga (o'quvchi hisobida esa o'tgan oy bo'lib qoladi);
 * keyingi oy uchun oldindan to'lov — o'sha oy kelganda. Oylar "YYYY-MM".
 */
export function salaryMonthOf(forMonth: string, paidMonth: string): string {
  return paidMonth > forMonth ? paidMonth : forMonth;
}

/** Foizli oylik: foiz × asos (tushum), olingan oylik/avans ayiriladi. */
export function payOf(base: number, percent: number, taken: number) {
  const share = Math.round((base * percent) / 100);
  return { kind: "percent" as PayKind, base, percent, share, taken, left: share - taken };
}

/** Belgilangan oylik: shu oy uchun summa, olingan oylik/avans ayiriladi. */
export function fixedPayOf(amount: number, taken: number) {
  return { kind: "fixed" as PayKind, base: 0, percent: 0, share: amount, taken, left: amount - taken };
}

/** Oylik yozuvi: foizda — "Oylik (40%)", belgilangan oylikda — "Oylik". */
export function payLabel(pay: { kind: PayKind; percent: number }): string {
  return pay.kind === "fixed" ? "Oylik" : `Oylik (${pay.percent}%)`;
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
