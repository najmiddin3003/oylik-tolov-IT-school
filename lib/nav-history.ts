// Yuqori paneldagi «Orqaga / Oldinga» tugmalari uchun kirilgan sahifalar tarixi (sof funksiyalar — brauzer va testlarda).
// Tarix localStorage da saqlanadi (components/HistoryNav.tsx). Qoidalar brauzernikiga o'xshash: yangi sahifaga o'tilsa,
// «oldinga» qismi o'chadi; bitta sahifa ichida faqat so'rov (?month=, filtr) o'zgarsa — yangi qadam qo'shilmaydi, sahifaning
// oxirgi holati eslab qolinadi (orqaga — oldingi sahifaga).

export type NavHistory = {
  /** Manzillar: yo'l va so'rov ("/staff/abc?month=2026-11") */
  entries: string[];
  /** Hozirgi sahifa (entries ichida); tarix bo'sh bo'lsa — -1 */
  index: number;
};

/** Saqlanadigan eng ko'p qadam (eskilari tushib qoladi) */
export const NAV_HISTORY_MAX = 50;

export function emptyHistory(): NavHistory {
  return { entries: [], index: -1 };
}

/** Manzilning yo'l qismi (so'rovsiz). */
export function pathOf(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

const isUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && v.length <= 2000;

/** Saqlangan qiymatni o'qish (buzilgan yoki eski bo'lsa — bo'sh tarix). */
export function parseNavHistory(raw: string | null | undefined): NavHistory {
  if (!raw) return emptyHistory();
  try {
    const v = JSON.parse(raw) as Partial<NavHistory>;
    const entries = Array.isArray(v.entries) ? v.entries.filter(isUrl).slice(-NAV_HISTORY_MAX) : [];
    if (!entries.length) return emptyHistory();
    const index = typeof v.index === "number" && Number.isInteger(v.index) ? Math.min(Math.max(v.index, 0), entries.length - 1) : entries.length - 1;
    return { entries, index };
  } catch {
    return emptyHistory();
  }
}

/** Oddiy o'tish (havola, menyu, sahifani yangilash): yangi sahifa — tarixga qo'shiladi, «oldinga» qismi o'chadi. */
export function recordVisit(h: NavHistory, url: string): NavHistory {
  const current = h.entries[h.index];
  if (current === url) return h;
  // Shu sahifaning o'zi, faqat so'rov o'zgargan (oy, filtr) — yangi qadam emas
  if (current !== undefined && pathOf(current) === pathOf(url)) {
    const entries = [...h.entries];
    entries[h.index] = url;
    return { entries, index: h.index };
  }
  const entries = [...h.entries.slice(0, h.index + 1), url].slice(-NAV_HISTORY_MAX);
  return { entries, index: entries.length - 1 };
}

/** Brauzerning o'z «orqaga / oldinga» tugmasi: qo'shni qadam bo'lsa — o'sha, aks holda oddiy o'tish. */
export function recordPop(h: NavHistory, url: string): NavHistory {
  if (h.entries[h.index] === url) return h;
  if (h.index > 0 && h.entries[h.index - 1] === url) return { ...h, index: h.index - 1 };
  if (h.entries[h.index + 1] === url) return { ...h, index: h.index + 1 };
  return recordVisit(h, url);
}

/**
 * Bizning tugma bilan `target` qadamga o'tildi. Kelgan manzil kutilganidan farq qilsa (masalan, sahifa boshqa joyga
 * yo'naltirdi) — o'sha qadamdan oddiy o'tish deb yoziladi.
 */
export function arriveAt(h: NavHistory, target: number, url: string): NavHistory {
  if (target < 0 || target >= h.entries.length) return recordVisit(h, url);
  if (h.entries[target] === url) return { ...h, index: target };
  return recordVisit({ ...h, index: target }, url);
}

export const canGoBack = (h: NavHistory) => h.index > 0;
export const canGoForward = (h: NavHistory) => h.index >= 0 && h.index < h.entries.length - 1;
