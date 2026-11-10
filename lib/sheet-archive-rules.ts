// Google Sheets arxivi: sof funksiyalar (server va testlarda). Bazaga murojaat yo'q.
import { createHash } from "node:crypto";

/**
 * `Content-Disposition` sarlavhasidagi fayl nomi: avval `filename*=UTF-8''…` (to'liq, unicode), bo'lmasa `filename="…"`.
 * Google: «Chortoq tumani oktabr - O'quvchilar.csv», «Chortoq tumani oktabr.xlsx».
 */
export function filenameFromDisposition(header: string | null | undefined): string {
  const h = String(header ?? "");
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(h);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim()).trim();
    } catch {
      // pastdagi oddiy nomga o'tamiz
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"/.exec(h) ?? /filename\s*=\s*([^;]+)/.exec(h);
  return plain ? plain[1].trim() : "";
}

// Oy nomlari (o'zbekcha lotin/kirill, ruscha, inglizcha) -> oy raqami
const MONTH_WORDS: [string, number][] = [
  ["yanvar", 1], ["январ", 1], ["january", 1],
  ["fevral", 2], ["феврал", 2], ["february", 2],
  ["mart", 3], ["март", 3], ["march", 3],
  ["aprel", 4], ["апрел", 4], ["april", 4],
  ["may", 5], ["май", 5], ["мая", 5],
  ["iyun", 6], ["июн", 6], ["june", 6],
  ["iyul", 7], ["июл", 7], ["july", 7],
  ["avgust", 8], ["август", 8], ["august", 8],
  ["sentabr", 9], ["sentyabr", 9], ["сентабр", 9], ["сентябр", 9], ["september", 9],
  ["oktabr", 10], ["oktyabr", 10], ["октабр", 10], ["октябр", 10], ["october", 10],
  ["noyabr", 11], ["ноябр", 11], ["november", 11],
  ["dekabr", 12], ["декабр", 12], ["december", 12],
];
// Qisqa so'zlar faqat to'liq mos kelsa (boshqa so'zning boshi bo'lib qolmasin: «martaba», «mayda»)
const EXACT_ONLY = new Set(["may", "mart", "май", "мая", "март"]);

/** Jadval nomidagi oy va yil: «Chortoq tumani oktabr» -> { month: 10, year: null }. Topilmasa — null. */
export function monthFromTitle(title: string): { month: number; year: number | null } | null {
  const tokens = title.toLowerCase().replace(/[ʻʼ'`‘’]/g, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let month: number | null = null;
  for (const t of tokens) {
    const hit = MONTH_WORDS.find(([w]) => t === w || (!EXACT_ONLY.has(w) && t.startsWith(w)));
    if (hit) {
      month = hit[1];
      break;
    }
  }
  if (!month) return null;
  const y = /(?:^|\D)(20\d{2})(?:\D|$)/.exec(title);
  return { month, year: y ? Number(y[1]) : null };
}

/**
 * Jadval qaysi oy uchun arxivlanadi: «oylik» yozilgan, hali arxivlanmagan oylar (`candidates`, "YYYY-MM") ichidan.
 * Jadval nomida oy bo'lsa — faqat o'sha oy (boshqa oy jadvali tasodifan arxivlanib, havolasi o'chib qolmasin);
 * nomida oy bo'lmasa — eng oxirgisi. Mos oy yo'q — null.
 */
export function pickArchiveMonth(candidates: string[], title: string): string | null {
  const sorted = [...candidates].sort();
  const t = monthFromTitle(title);
  if (!t) return sorted.at(-1) ?? null;
  const fit = sorted.filter((m) => Number(m.slice(5, 7)) === t.month && (t.year === null || Number(m.slice(0, 4)) === t.year));
  return fit.at(-1) ?? null;
}

/** Bo'sh qator: hamma katakchasi bo'sh yoki faqat formulaning «0» qiymati (jadval oxiridagi tayyor qatorlar). */
export function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((c) => {
    const v = String(c ?? "").trim();
    return v === "" || v === "0";
  });
}

/** Oxiridagi bo'sh qatorlarni olib tashlash (qator raqamlari o'zgarmaydi). */
export function trimSheetRows(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && isBlankRow(rows[end - 1] ?? [])) end--;
  return rows.slice(0, end).map((r) => r.map((c) => String(c ?? "")));
}

/**
 * Har bir to'ldirilgan qatorning kaliti (mazmuni bo'yicha; qator raqami kirmaydi — ustiga qator qo'shilsa ham o'zgarmaydi).
 * Bir xil mazmunli qatorlar «#2», «#3» bilan ajratiladi. Qator o'zgartirilsa — kaliti ham o'zgaradi (yangi qator bo'lib
 * ko'rinadi, eskisi «o'chirilgan»).
 */
export function rowKeys(rows: readonly (readonly string[])[]): { index: number; key: string }[] {
  const seen = new Map<string, number>();
  const out: { index: number; key: string }[] = [];
  rows.forEach((r, index) => {
    if (isBlankRow(r)) return;
    const body = JSON.stringify(r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim()));
    const n = (seen.get(body) ?? 0) + 1;
    seen.set(body, n);
    out.push({ index, key: createHash("sha1").update(`${body}#${n}`).digest("hex") });
  });
  return out;
}

/**
 * Google HTML eksportini xavfsiz qilish: skript, tashqi resurs va hodisa atributlari olib tashlanadi.
 * (Ko'rsatishda ham iframe `sandbox` bilan — skript baribir ishlamaydi.)
 */
export function sanitizeSheetHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(?:script|link|meta|iframe|object|embed|base|form)\b[^>]*>/gi, "")
    .replace(/<\/(?:iframe|object|embed|form)\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/** Google uslublaridan tashqi manzillar (rasm, shrift) olib tashlanadi — arxiv internetsiz ham bir xil ko'rinadi. */
export function sanitizeSheetCss(css: string): string {
  return css.replace(/@import[^;]*;/gi, "").replace(/url\([^)]*\)/gi, "none");
}

/** Arxivdagi varaqni alohida (iframe ichida) ko'rsatish uchun to'liq HTML hujjat. */
export function sheetDocument(css: string, html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}${sanitizeSheetCss(css)}</style></head><body>${html}</body></html>`;
}

/** Qatorlarni CSV ga (RFC 4180): vergul, qo'shtirnoq yoki qator ko'chishi bo'lsa — qo'shtirnoq ichida. */
export function toCSV(rows: readonly (readonly string[])[]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map((c) => cell(String(c ?? ""))).join(",")).join("\r\n");
}

/** Ustun harfi: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
