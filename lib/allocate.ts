// To'lovni oylarga taqsimlash (sof funksiyalar).
import { compareMonths, shiftMonth } from "./time";

export type Allocation = { month: string; amount: number };

/**
 * Summani oylarga taqsimlaydi: `fromMonth` dan boshlab har oyni oylik to'lov (`fee`) gacha to'ldiradi,
 * ortig'i keyingi oylarga o'tadi (oldindan to'lov). Allaqachon to'liq to'langan oylar o'tkazib yuboriladi.
 * `paid` — har oy uchun hozirgacha to'langan summa; funksiya uni yangilaydi.
 */
export function allocateAmount(
  amount: number,
  fee: number | ((month: string) => number),
  fromMonth: string,
  paid: Map<string, number>,
  maxMonths = 60,
): Allocation[] {
  if (!(amount > 0)) return [];
  const add = (m: string, v: number) => paid.set(m, (paid.get(m) ?? 0) + v);
  const feeOf = typeof fee === "function" ? fee : () => fee;

  // Narxi 0 bo'lgan oylar o'tkazib yuboriladi (masalan, bepul oy, keyin narx belgilangan);
  // umuman narx bo'lmasa — butun summa birinchi oyga yoziladi (pastdagi qoldiq qismi).
  const out: Allocation[] = [];
  let rest = amount;
  let m = fromMonth;
  for (let i = 0; rest > 0 && i < maxMonths; i++, m = shiftMonth(m, 1)) {
    const free = feeOf(m) - (paid.get(m) ?? 0);
    if (free <= 0) continue;
    const take = Math.min(free, rest);
    out.push({ month: m, amount: take });
    add(m, take);
    rest -= take;
  }
  if (rest > 0) {
    // Juda katta summa (5 yildan ortiq) — qolganini oxirgi oyga qo'shamiz
    const last = out[out.length - 1] ?? { month: fromMonth, amount: 0 };
    if (!out.length) out.push(last);
    last.amount += rest;
    add(last.month, rest);
  }
  return out;
}

/**
 * Sheets'dagi to'lov (sana bo'yicha) qaysi oydan boshlab taqsimlanadi:
 * bir oy oldingi qarzni ham yopadi (masalan 3-oktabrda sentabr uchun to'lash),
 * lekin o'qish boshlangan oydan oldinga o'tmaydi.
 */
export function importFromMonth(paymentMonth: string, studentStartMonth: string): string {
  const prev = shiftMonth(paymentMonth, -1);
  return compareMonths(prev, studentStartMonth) < 0 ? studentStartMonth : prev;
}
