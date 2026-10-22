// Sheets kataklaridagi "erkin" yozuvlarni (ism, telefon, summa, oy, sana) solishtiriladigan ko'rinishga keltirish.
import { isValidMonth, monthKey } from "./time";

const APOSTROPHES = /[ʻʼ'`‘’´ʹ]/g;

/** Matnni solishtirish uchun: kichik harf, apostroflar bir xil, ortiqcha bo'shliqsiz. */
export function normalizeText(s: string): string {
  return s.toLowerCase().replace(APOSTROPHES, "'").replace(/\s+/g, " ").trim();
}

/** Ism kaliti: so'zlar tartibi muhim emas ("Aliyev Vali" == "Vali Aliyev"). */
export function nameKey(name: string): string {
  return normalizeText(name)
    .replace(/[.,;:()"]/g, " ")
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Ismning «yumshoq» kaliti — yozilishidagi odatiy farqlarsiz: x/h, qo'sh harf, apostrof
 * ("Xakimova" ≈ "Hakimova", "Izatullayev" ≈ "Izzatullayev", "To'xtasin" ≈ "Toxtasin"). Faqat taklif uchun.
 */
export function looseNameKey(name: string): string {
  return normalizeText(name)
    .replace(/[.,;:()"]/g, " ")
    .replace(/'/g, "")
    .replace(/x/g, "h")
    .replace(/(.)\1+/g, "$1")
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** Ikki ism qanchalik o'xshash: 0..1 (yumshoq kalitlar bo'yicha tahrir masofasi; 1 — bir xil). */
export function nameSimilarity(a: string, b: string): number {
  const x = looseNameKey(a);
  const y = looseNameKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

/** Telefon kaliti: oxirgi 9 raqam (+998 bor-yo'qligidan qat'i nazar). 7 tadan kam raqam bo'lsa — bo'sh. */
export function phoneKey(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) return "";
  return digits.slice(-9);
}

/** "500 000", "500,000 so'm", "500000.00" -> 500000. Tushunib bo'lmasa — null. */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negative = /^-|^\(.*\)$/.test(s);
  // Oxiridagi tiyin qismini (",50" yoki ".00") olib tashlaymiz — so'mda kasr ishlatilmaydi.
  s = s.replace(/[.,]\d{1,2}(?=\D*$)/, "");
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const MONTH_WORDS: Array<[RegExp, number]> = [
  [/^(yanvar|январ|january|jan)/, 1],
  [/^(fevral|феврал|february|feb)/, 2],
  [/^(mart|март|march|mar)/, 3],
  [/^(aprel|апрел|april|apr)/, 4],
  [/^(may|май|мая)/, 5],
  [/^(iyun|июн|june|jun)/, 6],
  [/^(iyul|июл|july|jul)/, 7],
  [/^(avgust|август|august|aug)/, 8],
  [/^(sentabr|sentyabr|сентябр|september|sep)/, 9],
  [/^(oktabr|oktyabr|октябр|october|oct)/, 10],
  [/^(noyabr|ноябр|november|nov)/, 11],
  [/^(dekabr|декабр|december|dec)/, 12],
];

function monthFromWord(word: string): number | null {
  const w = normalizeText(word);
  for (const [re, m] of MONTH_WORDS) if (re.test(w)) return m;
  return null;
}

function validYear(y: number): boolean {
  return y >= 2000 && y <= 2100;
}

function expandYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Sana katagini "YYYY-MM-DD" ga aylantiradi.
 * Qo'llab-quvvatlanadi: 09.10.2026, 9.10.26, 2026-10-09, 10/9/2026 (AQSh formati, Sheets standarti),
 * 25/10/2026 (birinchi son 12 dan katta bo'lsa — kun/oy), "2026-10-09 14:30".
 */
export function parseDateCell(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), expandYear(Number(match[3]))];
  } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s))) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    y = expandYear(Number(match[3]));
    if (a > 12) [d, m] = [a, b];
    else [m, d] = [a, b];
  } else {
    return null;
  }
  if (!validYear(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * "Oy" katagini "YYYY-MM" ga aylantiradi.
 * Qo'llab-quvvatlanadi: 2026-10, 10.2026, 10/2026, "Oktabr 2026", "oktyabr", "Октябрь 2026", to'liq sana.
 * Yil yozilmagan bo'lsa — `fallbackYear` ishlatiladi.
 */
export function parseMonthCell(raw: string | null | undefined, fallbackYear: number): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (isValidMonth(s)) return s;

  let match = /^(\d{4})[-/.](\d{1,2})$/.exec(s);
  if (match) return safeMonth(Number(match[1]), Number(match[2]));

  match = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (match) return safeMonth(Number(match[2]), Number(match[1]));

  const fullDate = parseDateCell(s);
  if (fullDate) return fullDate.slice(0, 7);

  // So'z bilan yozilgan oy: "Oktabr 2026", "2026 oktabr", "oktabr"
  const words = normalizeText(s).split(/[\s,.\-/]+/).filter(Boolean);
  let month: number | null = null;
  let year: number | null = null;
  for (const w of words) {
    if (/^\d{4}$/.test(w)) year = Number(w);
    else if (/^\d{2}$/.test(w) && month !== null) year = expandYear(Number(w));
    else if (month === null) month = monthFromWord(w);
  }
  if (month !== null) return safeMonth(year ?? fallbackYear, month);

  // Faqat raqam: "10" -> joriy yilning 10-oyi
  if (/^\d{1,2}$/.test(s)) return safeMonth(fallbackYear, Number(s));

  return null;
}

function safeMonth(y: number, m: number): string | null {
  if (!validYear(y) || m < 1 || m > 12) return null;
  return monthKey(y, m);
}
