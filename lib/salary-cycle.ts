// Oylik davri: foizli oylik (o'qituvchi, foizli rahbar) uchun to'lov qaysi oy oyligiga hisoblanishi.
// Oy «oylik olindi» deb yozilmaguncha yopilmaydi: keyingi oy boshlangan bo'lsa ham, shu paytgacha tushgan to'lovlar
// hali ochiq oyga qo'shiladi; «oylik» yozilgandan keyin tushganlari — keyingi oyga.
// Sof funksiyalar — server va testlarda.
import { dateToISO, shiftMonth } from "./time";

/**
 * Oylik davri shu oydan boshlab yuritiladi. Undan oldingi oylar eski qoida bo'yicha — kalendar oyi tugashi bilan
 * yopilgan hisoblanadi (o'tgan hisoblar o'zgarmaydi, «oylik» yozilmagan eski oylarga pul yig'ilib qolmaydi).
 */
export const SALARY_CYCLE_FROM = "2026-10";

/** To'lov: qaysi oy uchun, summa, to'langan sana va saytga kiritilgan vaqt */
export type CyclePayment = { month: string; amount: number; paidAt: Date; createdAt?: Date | null };

/** Xodimning «oylik» yozuvi (avans oyni yopmaydi): qaysi oy uchun, olingan sana va yozilgan vaqt */
export type CycleClose = { month: string; date: Date; createdAt?: Date | null };

/** Vaqt kaliti: [Toshkent kuni "YYYY-MM-DD", o'sha kun ichidagi tartib — saytga yozilgan vaqt (ms)] */
type Key = readonly [day: string, ms: number];

function compareKeys(a: Key, b: Key): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  return a[1] - b[1];
}

/**
 * To'lov qachon «tushgan» hisoblanadi: to'langan kuni (bir kunda — kiritilgan vaqti bo'yicha).
 * Keyingi oylar uchun oldindan to'lov — o'sha oy boshlanganda (eski qoida: oldindan to'lov o'z oyi kelganda).
 */
function paymentKey(p: CyclePayment): Key {
  const day = dateToISO(p.paidAt);
  const start = `${p.month}-01`;
  if (day < start) return [start, Number.NEGATIVE_INFINITY];
  return [day, (p.createdAt ?? p.paidAt).getTime()];
}

/** Oy qachon yopildi: «oylik» olingan kun (bir kunda — yozuv yozilgan vaqti bo'yicha). */
function closeKey(c: CycleClose): Key {
  return [dateToISO(c.date), (c.createdAt ?? c.date).getTime()];
}

export type SalaryCycles = {
  /** Oylik oyi → shu oy oyligiga hisoblangan to'lovlar yig'indisi (foiz asosi); `from` dan oldingi oylar ham (eski qoida) */
  bases: Map<string, number>;
  /** Oy yopilgan kun ("YYYY-MM-DD"); hali yopilmagan, ishlanmagan yoki `from` dan oldingi oy — null */
  closedOn: (month: string) => string | null;
  /** Hozir tushgan to'lov qaysi oy oyligiga qo'shiladi (ochiq oy) */
  current: string;
  /** Shu xodimning to'lovi qaysi oy oyligiga hisoblangan (`bases` bilan bir xil qoida) */
  monthOf: (p: CyclePayment) => string;
};

/**
 * Xodimning to'lovlarini oylik oylariga taqsimlash.
 *
 * - To'lovning o'z oyi — u tushgan kalendar oy (o'tgan oy qarzi uchun noyabrda to'lansa — noyabr; dekabr uchun oldindan —
 *   dekabr). `from` dan oldingi oylar shu bilan tugaydi.
 * - `from` dan boshlab: to'lov tushgan paytda hali yopilmagan eng oldingi oyga qo'shiladi. Masalan, oktabr oyligi hali
 *   olinmagan bo'lsa, noyabrda tushgan to'lovlar ham oktabr oyligiga; oktabr uchun «oylik» yozilgach — noyabrga.
 * - Oy yopiladi — shu oy uchun birinchi «oylik» yozilganda. Keyingi oy uchun «oylik» yozilsa, oldingi ochiq oylar ham
 *   o'sha payt yopiladi (oylik bir oy o'tkazib yozilsa, pul eski oyda yig'ilib qolmaydi).
 * - Kutilmaydigan oy: o'z oyida umuman to'lov tushmagan va «oylik» yozilmagan oy (xodim hali ishlamagan, ta'tilda) —
 *   ochiq turmaydi.
 */
export function salaryCycles(payments: CyclePayment[], closes: CycleClose[], now: Date, from: string = SALARY_CYCLE_FROM): SalaryCycles {
  // Har oyning birinchi «oylik» yozuvi
  const raw = new Map<string, Key>();
  for (const c of closes) {
    if (c.month < from) continue;
    const k = closeKey(c);
    const prev = raw.get(c.month);
    if (!prev || compareKeys(k, prev) < 0) raw.set(c.month, k);
  }
  // Oy yopilishi = shu yoki keyingi oylar uchun eng birinchi «oylik» yozuvi
  const recordMonths = [...raw.keys()].sort();
  const closeAt = new Map<string, Key>();
  let earliest: Key | null = null;
  for (let i = recordMonths.length - 1; i >= 0; i--) {
    const k = raw.get(recordMonths[i])!;
    if (!earliest || compareKeys(k, earliest) < 0) earliest = k;
    closeAt.set(recordMonths[i], earliest);
  }
  const closeOf = (month: string): Key | null => {
    const m = recordMonths.find((r) => r >= month);
    return m ? closeAt.get(m)! : null;
  };
  const openAt = (month: string, key: Key) => {
    const c = closeOf(month);
    return !c || compareKeys(key, c) < 0;
  };

  const keyed = payments.map((p) => ({ amount: p.amount, key: paymentKey(p) }));
  // Ishlangan oylar (o'z oyida pul tushgan yoki «oylik» yozilgan) — faqat shular keyingi to'lovlarni kutib ochiq turadi
  const earned = [...new Set([...keyed.map((x) => x.key[0].slice(0, 7)), ...recordMonths].filter((m) => m >= from))].sort();

  const target = (key: Key): string => {
    const own = key[0].slice(0, 7);
    if (own < from) return own;
    for (const m of earned) {
      if (m >= own) break;
      if (openAt(m, key)) return m;
    }
    // O'z oyi oldinroq yopilgan bo'lsa (oylik oy tugamasdan berilgan) — keyingi ochiq oyga
    let m = own;
    while (!openAt(m, key)) m = shiftMonth(m, 1);
    return m;
  };

  const bases = new Map<string, number>();
  for (const { amount, key } of keyed) {
    const m = target(key);
    bases.set(m, (bases.get(m) ?? 0) + amount);
  }
  return {
    bases,
    closedOn: (month) => (earned.includes(month) ? (closeOf(month)?.[0] ?? null) : null),
    current: target([dateToISO(now), now.getTime()]),
    monthOf: (p) => target(paymentKey(p)),
  };
}
