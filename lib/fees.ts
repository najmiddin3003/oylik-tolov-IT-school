// Oylik to'lov narxi tarixi: "falon oydan boshlab narx = X". O'tgan oylar hisobi o'zgarmaydi.
import { compareMonths, shiftMonth } from "./time";

export type FeeChange = { from: string; fee: number };
export type FeeInfo = { monthlyFee: number; feeHistory?: FeeChange[] | null };

function sorted(history: FeeChange[] | null | undefined): FeeChange[] {
  return [...(history ?? [])].sort((a, b) => compareMonths(a.from, b.from));
}

/** Berilgan oy uchun oylik to'lov: asosiy narx, keyin `from <= oy` bo'lgan eng oxirgi o'zgarish. */
export function feeFor(s: FeeInfo, month: string): number {
  let fee = s.monthlyFee;
  for (const h of sorted(s.feeHistory)) {
    if (compareMonths(h.from, month) <= 0) fee = h.fee;
    else break;
  }
  return fee;
}

/**
 * "`from` oyidan boshlab narx = `fee`". Undan keyingi eski o'zgarishlar bekor bo'ladi.
 * `from` o'qish boshlangan oyga teng yoki undan oldin bo'lsa — asosiy narx almashtiriladi.
 */
export function applyFeeFrom(
  s: FeeInfo & { startMonth: string },
  from: string,
  fee: number,
): { monthlyFee: number; feeHistory: FeeChange[] } {
  if (compareMonths(from, s.startMonth) <= 0) return { monthlyFee: fee, feeHistory: [] };
  const kept = sorted(s.feeHistory).filter((h) => compareMonths(h.from, from) < 0);
  const before = feeFor({ monthlyFee: s.monthlyFee, feeHistory: kept }, shiftMonth(from, -1));
  return { monthlyFee: s.monthlyFee, feeHistory: before === fee ? kept : [...kept, { from, fee }] };
}

/** `after` oyidan keyingi (rejalashtirilgan) narx o'zgarishlari — tartiblangan. */
export function changesAfter(history: FeeChange[] | null | undefined, after: string): FeeChange[] {
  return sorted(history).filter((h) => compareMonths(h.from, after) > 0);
}

// ---------- Ulush foizi tarixi (masalan, tushumning 40%) ----------

export type PercentChange = { from: string; percent: number };

/** Berilgan oy uchun foiz: `from <= oy` bo'lgan eng oxirgi o'zgarish, bo'lmasa — standart. */
export function percentFor(history: PercentChange[] | null | undefined, month: string, fallback: number): number {
  let p = fallback;
  for (const h of [...(history ?? [])].sort((a, b) => compareMonths(a.from, b.from))) {
    if (compareMonths(h.from, month) <= 0) p = h.percent;
    else break;
  }
  return p;
}

/** "`from` oyidan boshlab foiz = `percent`": undan keyingi eski o'zgarishlar bekor bo'ladi. */
export function applyPercentFrom(history: PercentChange[] | null | undefined, from: string, percent: number): PercentChange[] {
  const kept = [...(history ?? [])]
    .filter((h) => compareMonths(h.from, from) < 0)
    .sort((a, b) => compareMonths(a.from, b.from));
  return [...kept, { from, percent }];
}

// ---------- Belgilangan oylik tarixi (masalan, administrator: har oy 3 000 000 so'm) ----------

export type AmountChange = { from: string; amount: number };

/** Berilgan oy uchun summa: `from <= oy` bo'lgan eng oxirgi o'zgarish, bo'lmasa — standart. */
export function amountFor(history: AmountChange[] | null | undefined, month: string, fallback: number): number {
  let a = fallback;
  for (const h of [...(history ?? [])].sort((x, y) => compareMonths(x.from, y.from))) {
    if (compareMonths(h.from, month) <= 0) a = h.amount;
    else break;
  }
  return a;
}

/** "`from` oyidan boshlab summa = `amount`": undan keyingi eski o'zgarishlar bekor bo'ladi. */
export function applyAmountFrom(history: AmountChange[] | null | undefined, from: string, amount: number): AmountChange[] {
  const kept = [...(history ?? [])]
    .filter((h) => compareMonths(h.from, from) < 0)
    .sort((a, b) => compareMonths(a.from, b.from));
  return [...kept, { from, amount }];
}

export function shareOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}
