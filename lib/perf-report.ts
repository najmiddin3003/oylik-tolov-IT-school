import "server-only";
// «Tezlik» sahifasi (rahbar): yozilgan o'lchovlardan har sahifa va butun sayt bo'yicha xulosa.
import { requireOwner } from "./auth";
import { connectDB } from "./db";
import { Perf } from "./models";
import { PERF_ROUTES, perfStats, type PerfKind, type PerfStats } from "./perf-rules";
import type { Role } from "./session";

/**
 * Vaqt bo'laklari (faqat bo'laklari yozilgan o'lchovlar bo'yicha, mediana): serverdan birinchi javob, server ma'lumoti
 * to'liq kelguncha («kutish») va undan keyin brauzerda chizish; yangi ulanish o'rnatilgan o'lchovlar soni.
 */
export type PerfSplit = {
  n: number;
  ttfb: number | null;
  wait: number | null;
  render: number | null;
  newConn: number;
  connMs: number | null;
};

/** Server so'rovlari va ulardan nechtasi server «uyg'onishi»ga to'g'ri kelgani (uyg'onish vaqti — mediana, taxminiy). */
export type ColdStats = { requests: number; cold: number; boot: number | null };

export type PerfRow = {
  route: string;
  label: string;
  server: PerfStats | null;
  load: PerfStats | null;
  nav: PerfStats | null;
  navSplit: PerfSplit | null;
  loadSplit: PerfSplit | null;
  cold: ColdStats;
  views: number;
};
export type SlowRow = { route: string; label: string; kind: PerfKind; ms: number; wait: number | null; role: Role; at: string };

type Doc = {
  route: string;
  kind: string;
  ms: number;
  role: string;
  at: Date;
  ttfb?: number | null;
  wait?: number | null;
  conn?: number | null;
  cold?: boolean | null;
  boot?: number | null;
};

const median = (xs: number[]) => perfStats(xs)?.median ?? null;

function splitOf(docs: Doc[]): PerfSplit | null {
  const timed = docs.filter((d) => d.wait != null);
  if (!timed.length) return null;
  const conns = timed.filter((d) => (d.conn ?? 0) > 0);
  return {
    n: timed.length,
    ttfb: median(timed.flatMap((d) => (d.ttfb != null ? [d.ttfb] : []))),
    wait: median(timed.map((d) => d.wait!)),
    render: median(timed.map((d) => Math.max(0, d.ms - d.wait!))),
    newConn: conns.length,
    connMs: median(conns.map((d) => d.conn!)),
  };
}

function coldOf(docs: Doc[]): ColdStats {
  const server = docs.filter((d) => d.kind === "server");
  const cold = server.filter((d) => d.cold === true);
  return { requests: server.length, cold: cold.length, boot: median(cold.flatMap((d) => (d.boot != null ? [d.boot] : []))) };
}

function summaryOf(docs: Doc[]) {
  const of = (kind: PerfKind) => docs.filter((d) => d.kind === kind);
  return {
    server: perfStats(of("server").map((d) => d.ms)),
    load: perfStats(of("load").map((d) => d.ms)),
    nav: perfStats(of("nav").map((d) => d.ms)),
    navSplit: splitOf(of("nav")),
    loadSplit: splitOf(of("load")),
    cold: coldOf(docs),
  };
}

/** «Tezlik» sahifasi (rahbar): oxirgi `hours` soat bo'yicha har sahifaning va butun saytning vaqtlari. */
export async function perfSummary(hours: number, role: Role | null) {
  await requireOwner();
  await connectDB();
  const since = new Date(Date.now() - hours * 3600_000);
  const filter = { at: { $gte: since }, ...(role ? { role } : {}) };
  const docs = (
    await Perf.find(filter, { route: 1, kind: 1, ms: 1, role: 1, at: 1, ttfb: 1, wait: 1, conn: 1, cold: 1, boot: 1, _id: 0 })
      .sort({ at: -1 })
      .limit(100_000)
      .lean<Doc[]>()
  ).filter((d) => Object.hasOwn(PERF_ROUTES, d.route));

  const byRoute = new Map<string, Doc[]>();
  for (const d of docs) {
    const list = byRoute.get(d.route);
    if (list) list.push(d);
    else byRoute.set(d.route, [d]);
  }
  const rows: PerfRow[] = [...byRoute].map(([route, list]) => {
    const s = summaryOf(list);
    return {
      route,
      label: PERF_ROUTES[route],
      ...s,
      // Ochilishlar soni: brauzer o'lchovlari (birinchi ochilish + o'tish), bo'lmasa — server
      views: (s.load?.n ?? 0) + (s.nav?.n ?? 0) || (s.server?.n ?? 0),
    };
  });
  // Eng sekinlari tepada: sahifaga o'tish (yoki birinchi ochilish, yoki server) mediana bo'yicha
  const key = (r: PerfRow) => r.nav?.median ?? r.load?.median ?? r.server?.median ?? 0;
  rows.sort((a, b) => key(b) - key(a));

  const slowest: SlowRow[] = docs
    .filter((d) => d.kind !== "server")
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 10)
    .map((d) => ({ route: d.route, label: PERF_ROUTES[d.route], kind: d.kind as PerfKind, ms: d.ms, wait: d.wait ?? null, role: d.role as Role, at: d.at.toISOString() }));

  return { rows, slowest, overall: summaryOf(docs), total: docs.length, since: since.toISOString() };
}
