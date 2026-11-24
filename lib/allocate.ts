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
 * To'lov tanlangan oyning qolgan to'lovidan ko'p bo'lsa — avval undan oldingi to'lanmagan oylar (eng eskisidan, `earliest`
 * dan boshlab), keyin tanlangan oy va keyingilari. Masalan, noyabr uchun 500 000 (oylik 300 000, oktabr to'lanmagan):
 * oktabr 300 000, noyabr 200 000. Ko'p bo'lmasa (yoki oldingi qarz yo'q) — tanlangan oydan boshlab (avvalgidek).
 */
export function allocateWithDebts(
  amount: number,
  fee: number | ((month: string) => number),
  month: string,
  paid: Map<string, number>,
  earliest: string,
): Allocation[] {
  const feeOf = typeof fee === "function" ? fee : () => fee;
  const free = (m: string) => feeOf(m) - (paid.get(m) ?? 0);
  if (amount > free(month)) {
    for (let m = earliest; compareMonths(m, month) < 0; m = shiftMonth(m, 1)) {
      if (free(m) > 0) return allocateAmount(amount, feeOf, m, paid);
    }
  }
  return allocateAmount(amount, feeOf, month, paid);
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

/** Ortiqcha to'lovni ko'chirish: `from` oyidagi ortiqcha `amount` — `to` oyiga (oldingi to'lanmagan oy). */
export type Move = { from: string; to: string; amount: number };

/**
 * Mavjud to'lovlarni tekshirish: oy to'lovi oylikdan ko'p (ortiqcha), undan oldingi oy esa to'lanmagan bo'lsa — shu oyning
 * puli eng eski to'lanmagan oydan boshlab qayta taqsimlanadi (yangi to'lovdagi kabi): noyabrga 500 000 yozilgan, oylik
 * 300 000, oktabr to'lanmagan — oktabrga 300 000, noyabrda 200 000 qoladi. `months` — tekshiriladigan oylar (o'sish
 * tartibida); `fee` — shu oy to'lanishi kerak bo'lgan summa (to'lamaydigan oylarda 0).
 */
export function overpaymentMoves(months: string[], fee: (m: string) => number, paid: Map<string, number>): Move[] {
  const left = new Map(months.map((m) => [m, paid.get(m) ?? 0]));
  const moves: Move[] = [];
  for (const src of months) {
    // Faqat ortiqcha to'langan oy qayta taqsimlanadi; uning puli avval oldingi qarzlarni yopadi
    if ((left.get(src) ?? 0) <= fee(src)) continue;
    for (const dst of months) {
      const available = left.get(src) ?? 0;
      if (dst >= src || available <= 0) break;
      const need = fee(dst) - (left.get(dst) ?? 0);
      if (need <= 0) continue;
      const x = Math.min(need, available);
      moves.push({ from: src, to: dst, amount: x });
      left.set(dst, (left.get(dst) ?? 0) + x);
      left.set(src, available - x);
    }
  }
  return moves;
}
