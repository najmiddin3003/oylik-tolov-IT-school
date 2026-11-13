// Chegirmalar: turlari (foiz yoki summa) va o'quvchining chegirma tarixi — "falon oydan boshlab chegirma = X".
// O'tgan oylar hisobi o'zgarmaydi. Sof funksiyalar — server, brauzer va testlarda.
import { feeFor, type FeeInfo } from "./fees";
import { compareMonths } from "./time";

export type DiscountKind = "percent" | "amount";

/** Sozlamalardagi chegirma turi */
export type DiscountType = { id: string; name: string; kind: DiscountKind; value: number };

/**
 * O'quvchining chegirma o'zgarishi: `from` oyidan boshlab shu chegirma (tur nomi va qiymati — o'sha paytdagi nusxa,
 * tur keyin o'zgarsa ham o'tgan oylar hisobi o'zgarmaydi). `kind: null` — shu oydan chegirma yo'q.
 */
export type DiscountChange = { from: string; typeId: string | null; name: string; kind: DiscountKind | null; value: number };

export const MAX_DISCOUNT_TYPES = 30;

export function isDiscountKind(v: unknown): v is DiscountKind {
  return v === "percent" || v === "amount";
}

/** Tur qiymatini tekshirish: foiz 1–100, summa 1 000 – 100 000 000. Xato matni yoki null. */
export function discountValueError(kind: DiscountKind, value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return "Qiymatni kiriting";
  if (kind === "percent" && (value > 100 || !Number.isInteger(value * 10))) return "Foiz 1 dan 100 gacha bo‘lishi kerak";
  if (kind === "amount" && (value > 100_000_000 || !Number.isInteger(value))) return "Summa noto‘g‘ri";
  return null;
}

function sorted(history: DiscountChange[] | null | undefined): DiscountChange[] {
  return [...(history ?? [])].filter((h) => h && h.from).sort((a, b) => compareMonths(a.from, b.from));
}

/** Shu oy uchun amaldagi chegirma (yo'q bo'lsa — null). */
export function discountAt(history: DiscountChange[] | null | undefined, month: string): DiscountChange | null {
  let cur: DiscountChange | null = null;
  for (const h of sorted(history)) {
    if (compareMonths(h.from, month) <= 0) cur = h;
    else break;
  }
  return cur && cur.kind ? cur : null;
}

/** Narxdan chegirma: foiz — butun so'mgacha yaxlitlanadi; summa — narxdan oshmaydi. */
export function applyDiscount(fee: number, d: Pick<DiscountChange, "kind" | "value"> | null): number {
  if (!d || !d.kind || fee <= 0) return fee;
  if (d.kind === "percent") return Math.max(0, Math.round((fee * (100 - Math.min(d.value, 100))) / 100));
  return Math.max(0, fee - d.value);
}

/** Chegirma bilan oylik to'lov (to'lanishi kerak bo'lgan summa). */
export function netFee(s: FeeInfo & { discountHistory?: DiscountChange[] | null }, month: string): number {
  return applyDiscount(feeFor(s, month), discountAt(s.discountHistory, month));
}

/** "`from` oyidan boshlab chegirma = `change`" (null — chegirma yo'q): undan keyingi eski o'zgarishlar bekor bo'ladi. */
export function setDiscountFrom(
  history: DiscountChange[] | null | undefined,
  from: string,
  change: Omit<DiscountChange, "from"> | null,
): DiscountChange[] {
  const kept = sorted(history).filter((h) => compareMonths(h.from, from) < 0);
  const before = kept.at(-1);
  const next: DiscountChange = change ? { from, ...change } : { from, typeId: null, name: "", kind: null, value: 0 };
  // O'zgarish yo'q bo'lsa (avvalgisi bilan bir xil yoki boshidan chegirma yo'q) — yozilmaydi
  const same = before
    ? before.kind === next.kind && before.value === next.value && before.typeId === next.typeId
    : next.kind === null;
  return same ? kept : [...kept, next];
}

/** "10%", "50 000 so'm" */
export function discountLabel(d: Pick<DiscountChange, "kind" | "value">): string {
  if (d.kind === "percent") return `${d.value}%`;
  return `${String(d.value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so‘m`;
}

/** Saqlangan turlar ro'yxatini tozalash (eski / buzilgan yozuvlar tashlanadi). */
export function normalizeDiscountTypes(raw: unknown): DiscountType[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is DiscountType => Boolean(t) && typeof t.id === "string" && typeof t.name === "string" && isDiscountKind(t.kind) && typeof t.value === "number")
    .map((t) => ({ id: t.id, name: t.name, kind: t.kind, value: t.value }))
    .slice(0, MAX_DISCOUNT_TYPES);
}
