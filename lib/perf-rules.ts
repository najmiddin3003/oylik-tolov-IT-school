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
  "/davomat": "Davomat",
  "/payments": "To‘lovlar",
  "/olinganlar": "Olingan avans/oylik",
  "/staff": "Xodimlar",
  "/staff/[id]": "Xodim",
  "/me": "Profilim",
  "/faoliyat": "Faoliyat tarixi",
  "/reja": "Reja va yangiliklar",
  "/settings": "Sozlamalar",
  "/sync": "Google Sheets",
  "/sync/arxiv/[id]": "Sheets arxivi",
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

export type PerfBeacon = {
  route: string;
  kind: "load" | "nav";
  /** Bosilgandan (yoki sayt so'ralgandan) mazmun chiqquncha */
  ms: number;
  /** Serverdan birinchi javob kelguncha */
  ttfb: number | null;
  /** Server ma'lumoti to'liq kelguncha (mazmun chiqqan paytdan oshmaydi); ms − wait — brauzerda chizish */
  wait: number | null;
  /** Yangi ulanish o'rnatish vaqti (0 — avvalgi ulanish ishlatildi) */
  conn: number | null;
};

/** Ixtiyoriy vaqt: 0…max oralig'ida butun ms; yo'q yoki noto'g'ri — null. */
function optMs(v: unknown, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > PERF_MAX_MS) return null;
  return Math.min(Math.round(v), max);
}

/** Brauzerdan kelgan o'lchov: { route, kind: "load" | "nav", ms, ttfb?, wait?, conn? }. Noto'g'ri bo'lsa — null. */
export function parsePerfBeacon(raw: unknown): PerfBeacon | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const route = typeof b.route === "string" ? perfRoute(b.route) : null;
  const kind = b.kind === "load" || b.kind === "nav" ? b.kind : null;
  const ms = typeof b.ms === "number" && Number.isFinite(b.ms) ? Math.round(b.ms) : NaN;
  if (!route || !kind || !(ms > 0 && ms <= PERF_MAX_MS)) return null;
  // Bo'laklar bir-biridan oshmaydi: ulanish ≤ birinchi javob ≤ to'liq javob ≤ mazmun chiqqan payt
  const wait = optMs(b.wait, ms);
  const ttfb = optMs(b.ttfb, wait ?? ms);
  const conn = optMs(b.conn, ttfb ?? wait ?? ms);
  return { route, kind, ms, ttfb, wait, conn };
}

/** Vercel tugunlari (regionlar): kodi -> shahar */
export const VERCEL_REGIONS: Record<string, string> = {
  arn1: "Stokgolm",
  bom1: "Mumbay",
  cdg1: "Parij",
  cle1: "Klivlend",
  cpt1: "Keyptaun",
  dub1: "Dublin",
  dxb1: "Dubay",
  fra1: "Frankfurt",
  gru1: "San-Paulu",
  hkg1: "Gonkong",
  hnd1: "Tokio",
  iad1: "Vashington",
  icn1: "Seul",
  kix1: "Osaka",
  lhr1: "London",
  pdx1: "Portlend",
  sfo1: "San-Fransisko",
  sin1: "Singapur",
  syd1: "Sidney",
  yul1: "Monreal",
};

/** "hkg1" -> "hkg1 · Gonkong"; noma'lum — kodi o'zi */
export function regionLabel(code: string): string {
  return VERCEL_REGIONS[code] ? `${code} · ${VERCEL_REGIONS[code]}` : code;
}

/**
 * Vercel so'rov belgisi (`x-vercel-id`): "hkg1::arn1::x4vbv-1793793493358-3b4e…" — so'rov kirgan tugun (birinchi
 * region), o'tgan regionlar va tugun so'rovni qabul qilgan vaqt (ms).
 */
export function parseVercelId(id: string | null | undefined): { pop: string | null; regions: string[]; at: number | null } {
  if (!id) return { pop: null, regions: [], at: null };
  const parts = id.split("::");
  const regions = parts.filter((p) => /^[a-z]{3}\d$/.test(p));
  const m = /-(\d{13})-/.exec(parts[parts.length - 1] ?? "");
  return { pop: regions[0] ?? null, regions, at: m ? Number(m[1]) : null };
}

/**
 * So'rov tugunga kelgandan bizning kod ishga tushguncha o'tgan vaqt (ms): tugundan serverga yo'l va ishga tushish.
 * Serverlar soati biroz farq qilishi mumkin — kichik manfiy qiymat 0, katta farq yoki belgisiz — null.
 */
export function edgeLag(at: number | null, now: number): number | null {
  if (at == null) return null;
  const lag = now - at;
  if (lag < -50 || lag > 60_000) return null;
  return Math.max(0, Math.round(lag));
}

/** «Tezlik» sahifasidagi davrlar */
export const PERF_PERIODS = [
  { key: "1h", label: "1 soat", hours: 1 },
  { key: "24h", label: "24 soat", hours: 24 },
  { key: "7d", label: "7 kun", hours: 7 * 24 },
  { key: "30d", label: "30 kun", hours: 30 * 24 },
] as const;

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
