// Xodimlar: rollar nomi, oylik foizi va sessiya barmoq izi (sof funksiyalar — server, brauzer va testlarda).
// Brauzerda ham ishlatiladi — node:crypto ga bog'liq narsa bu yerda yo'q.
import { amountFor, percentFor, type AmountChange, type PercentChange } from "./fees";
import { normalizeUzPhone } from "./phone";
import type { Role } from "./session";
import { compareMonths, shiftMonth } from "./time";

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

/**
 * «Oylar bo'yicha oylik» jadvali uchun oylar, eng yangisi birinchi: joriy oygacha oxirgi `count` oy.
 * Tanlangan oy bu oraliqdan tashqarida bo'lsa (ancha eski yoki kelgusi oy) — tanlangan oygacha oxirgi `count` oy.
 */
export function payHistoryMonths(selected: string, current: string, count = 12): string[] {
  const inWindow = compareMonths(selected, current) <= 0 && compareMonths(selected, shiftMonth(current, -(count - 1))) >= 0;
  const end = inWindow ? current : selected;
  return Array.from({ length: count }, (_, i) => shiftMonth(end, -i));
}

/**
 * Oylik hali belgilanmagan eng eski oylar (oylik ham, olingan pul ham 0) jadvaldan tushiriladi — xodim ishga kirmasdan
 * oldingi bo'sh oylar ko'rinmaydi. Qatorlar eng yangisi birinchi; tanlangan oy va undan keyingilari doim qoladi.
 */
export function trimEmptyPayMonths<T extends { month: string; share: number; taken: number }>(rows: T[], selected: string): T[] {
  let end = rows.length;
  while (end > 0) {
    const r = rows[end - 1];
    if (r.share !== 0 || r.taken !== 0 || compareMonths(r.month, selected) >= 0) break;
    end--;
  }
  return rows.slice(0, end);
}

/** Bu oy rejasi (foizli oylik): o'quvchilar shu oy to'lashi kerak bo'lgan summa, amalda to'langani va rejadagi oylik. */
export type PayPlan = {
  /** Shu oy to'lashi kerak bo'lgan (faol, o'qishni boshlagan) o'quvchilar */
  students: number;
  /** To'liq to'laganlar */
  paidCount: number;
  /** To'lamagan yoki qisman to'laganlar */
  debtors: number;
  /** O'quvchilarning shu oy uchun oylik to'lovlari jami */
  expected: number;
  /**
   * Shu oy uchun to'langan, lekin oldingi oy oyligiga hisoblangan (oylik davri bo'yicha: masalan, oktabr oyligi hali
   * olinmagan paytda tushgan noyabr to'lovi) — bu oy oyligiga qayta qo'shilmaydi
   */
  earlier: number;
  /** `earlier` qaysi oylar oyligiga hisoblangan ("YYYY-MM") */
  earlierMonths: string[];
  /** Amalda yig'ildi — shu oy oyligiga: shu oy uchun to'langan (oylik to'lovidan oshmagan qismi), `earlier` siz */
  collected: number;
  /** Hali to'lanmagan */
  debt: number;
  percent: number;
  /** Rejadagi oylik — faqat qo'lga tegmagan pul: hamma to'lasa (collected + debt) × foiz */
  planShare: number;
};

/**
 * O'quvchilar ro'yxatidan (shu oy holati bilan) bu oy rejasi. `debt` — o'quvchining shu oy uchun qolgan qarzi,
 * `earlier` — uning shu oy uchun to'lovlaridan oldingi oy oyligiga hisoblangani.
 * expected = earlier + collected + debt.
 */
export function payPlanOf(rows: { monthlyFee: number; debt: number; earlier?: number }[], percent: number, earlierMonths: string[] = []): PayPlan {
  let expected = 0;
  let debt = 0;
  let earlier = 0;
  let debtors = 0;
  for (const r of rows) {
    const fee = r.monthlyFee;
    const owe = Math.min(Math.max(r.debt, 0), fee);
    const paid = fee - owe;
    expected += fee;
    debt += owe;
    earlier += Math.min(Math.max(r.earlier ?? 0, 0), paid);
    if (r.debt > 0) debtors++;
  }
  const collected = expected - debt - earlier;
  return {
    students: rows.length,
    paidCount: rows.length - debtors,
    debtors,
    expected,
    earlier,
    earlierMonths: earlier ? earlierMonths : [],
    collected,
    debt,
    percent,
    planShare: Math.round(((collected + debt) * percent) / 100),
  };
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
