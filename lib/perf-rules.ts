// Sayt tezligi o'lchovi: sahifa nomlari, manzilni sahifa turiga keltirish, statistika va brauzer xabarini tekshirish.
// Sof funksiyalar — proxy, server, brauzer va testlarda.

/** O'lchanadigan sahifalar (manzil turi -> nomi). Boshqa manzillar yozilmaydi. */
export const PERF_ROUTES: Record<string, string> = {
  "/": "Bosh sahifa",
  "/students": "O‘quvchilar",
  "/students/new": "Yangi o‘quvchi",
  "/students/[id]": "O‘quvchi profili",
  "/students/[id]/edit": "O‘quvchini tahrirlash",
  "/qarzdorlar": "Qarzdorlar",
  "/payments": "To‘lovlar",
  "/kassa": "Kassa",
  "/olinganlar": "Olingan avans/oylik",
  "/staff": "Xodimlar",
  "/staff/[id]": "Xodim",
  "/me": "Profilim",
  "/faoliyat": "Faoliyat tarixi",
  "/reja": "Reja va yangiliklar",
  "/settings": "Sozlamalar",
  "/sync": "Google Sheets",
  "/tezlik": "Tezlik",
};

/** Proxy sahifa so'roviga qo'yadigan sarlavha: sahifa turi (serverdagi o'lchov uchun). */
export const PERF_HEADER = "x-perf-route";

/**
 * O'lchov turi: server — sahifa serverda tayyorlangan vaqt; load — sayt brauzerda birinchi ochilib, mazmun chiqqunicha;
 * nav — sahifaga o'tish (menyu, havola, filtr) bosilgandan mazmun chiqqunicha.
 */
export type PerfKind = "server" | "load" | "nav";
export const PERF_KINDS: readonly PerfKind[] = ["server", "load", "nav"];

/** "/students/6ac9…/edit" -> "/students/[id]/edit"; ro'yxatda yo'q manzil — null. */
export function perfRoute(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const route = clean.replace(/\/[a-f0-9]{24}(?=\/|$)/gi, "/[id]");
  return Object.hasOwn(PERF_ROUTES, route) ? route : null;
}

/** Eng katta qabul qilinadigan vaqt (ms): bundan uzuni — xato o'lchov. */
export const PERF_MAX_MS = 120_000;

/** Brauzerdan kelgan o'lchov: { route, kind: "load" | "nav", ms, ttfb? }. Noto'g'ri bo'lsa — null. */
export function parsePerfBeacon(raw: unknown): { route: string; kind: "load" | "nav"; ms: number; ttfb: number | null } | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const route = typeof b.route === "string" ? perfRoute(b.route) : null;
  const kind = b.kind === "load" || b.kind === "nav" ? b.kind : null;
  const ms = typeof b.ms === "number" && Number.isFinite(b.ms) ? Math.round(b.ms) : NaN;
  if (!route || !kind || !(ms > 0 && ms <= PERF_MAX_MS)) return null;
  const ttfb = typeof b.ttfb === "number" && Number.isFinite(b.ttfb) && b.ttfb >= 0 && b.ttfb <= PERF_MAX_MS ? Math.round(b.ttfb) : null;
  return { route, kind, ms, ttfb: kind === "load" ? ttfb : null };
}

export type PerfStats = { n: number; median: number; p90: number };

/** Mediana va 90-persentil (ochilishlarning 90 foizi shundan tezroq); bo'sh — null. */
export function perfStats(values: number[]): PerfStats | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { n: sorted.length, median, p90: at(0.9) };
}

/** Vaqt bahosi: tez (≤ 1 s), o'rtacha (≤ 2,5 s), sekin. */
export function perfTone(ms: number): "emerald" | "amber" | "rose" {
  return ms <= 1000 ? "emerald" : ms <= 2500 ? "amber" : "rose";
}

/** 850 -> "0,85 s"; 12 400 -> "12,4 s"; 90 -> "90 ms" */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return `${(s < 10 ? s.toFixed(2) : s.toFixed(1)).replace(".", ",")} s`;
}
