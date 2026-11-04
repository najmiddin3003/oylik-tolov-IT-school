import "server-only";
// «Tezlik» sahifasi (rahbar): yozilgan o'lchovlardan har sahifa bo'yicha xulosa.
import { requireOwner } from "./auth";
import { connectDB } from "./db";
import { Perf } from "./models";
import { PERF_ROUTES, perfStats, type PerfKind, type PerfStats } from "./perf-rules";
import type { Role } from "./session";

export type PerfRow = { route: string; label: string; server: PerfStats | null; load: PerfStats | null; nav: PerfStats | null; views: number };
export type SlowRow = { route: string; label: string; kind: PerfKind; ms: number; role: Role; at: string };

/** «Tezlik» sahifasi (rahbar): oxirgi `days` kun bo'yicha har sahifaning mediana va 90-persentil vaqtlari. */
export async function perfSummary(days: number, role: Role | null) {
  await requireOwner();
  await connectDB();
  const since = new Date(Date.now() - days * 24 * 3600_000);
  const filter = { at: { $gte: since }, ...(role ? { role } : {}) };
  const docs = await Perf.find(filter, { route: 1, kind: 1, ms: 1, role: 1, at: 1, _id: 0 }).sort({ at: -1 }).limit(100_000).lean();

  const byRoute = new Map<string, Record<PerfKind, number[]>>();
  for (const d of docs) {
    if (!Object.hasOwn(PERF_ROUTES, d.route)) continue;
    const r = byRoute.get(d.route) ?? { server: [], load: [], nav: [] };
    r[d.kind as PerfKind].push(d.ms);
    byRoute.set(d.route, r);
  }
  const rows: PerfRow[] = [...byRoute].map(([route, v]) => ({
    route,
    label: PERF_ROUTES[route],
    server: perfStats(v.server),
    load: perfStats(v.load),
    nav: perfStats(v.nav),
    // Ochilishlar soni: brauzer o'lchovlari (birinchi ochilish + o'tish), bo'lmasa — server
    views: v.load.length + v.nav.length || v.server.length,
  }));
  // Eng sekinlari tepada: sahifaga o'tish (yoki birinchi ochilish, yoki server) mediana bo'yicha
  const key = (r: PerfRow) => r.nav?.median ?? r.load?.median ?? r.server?.median ?? 0;
  rows.sort((a, b) => key(b) - key(a));

  const slowest: SlowRow[] = docs
    .filter((d) => d.kind !== "server" && Object.hasOwn(PERF_ROUTES, d.route))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 10)
    .map((d) => ({ route: d.route, label: PERF_ROUTES[d.route], kind: d.kind as PerfKind, ms: d.ms, role: d.role as Role, at: d.at.toISOString() }));

  return { rows, slowest, total: docs.length, since: since.toISOString() };
}
