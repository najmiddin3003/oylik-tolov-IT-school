import "server-only";
// Sayt tezligi o'lchovi: yozish (server va brauzer o'lchovlari). Rahbar uchun xulosa — lib/perf-report.ts.
// Yozish foydalanuvchini kutdirmaydi — javob yuborilgandan keyin (`after`) bajariladi.
import { headers } from "next/headers";
import { after } from "next/server";
import { cache } from "react";
import { connectDB } from "./db";
import { Perf } from "./models";
import { PERF_HEADER, perfRoute, type PerfKind } from "./perf-rules";
import type { Role } from "./session";

/** Bitta o'lchovni yozish (Vercel loglarida ham bir qator). Xato bo'lsa — jim o'tadi: o'lchov sahifani buzmasin. */
export async function recordPerf(entry: { route: string; kind: PerfKind; ms: number; ttfb?: number | null; role: Role }): Promise<void> {
  console.log(`[perf] ${entry.kind} ${entry.route} ${entry.ms}ms${entry.ttfb != null ? ` ttfb=${entry.ttfb}ms` : ""} (${entry.role})`);
  try {
    await connectDB();
    await Perf.create({ ...entry, ttfb: entry.ttfb ?? null, at: new Date() });
  } catch (err) {
    console.error("[perf] yozilmadi", err);
  }
}

/**
 * Sahifa serverda qancha vaqtda tayyorlanganini o'lchashni boshlaydi: shu paytdan javob to'liq yuborilguncha.
 * Sahifa guard'lari chaqiradi; bir so'rovda bir marta (menyu va sahifa birga chaqirsa ham). Sahifa turini proxy
 * so'rovga qo'yadi — prefetch va server action so'rovlarida u yo'q, ular o'lchanmaydi.
 */
export const startServerPerf = cache(async (role: Role): Promise<void> => {
  const route = perfRoute((await headers()).get(PERF_HEADER) ?? "");
  if (!route) return;
  const t0 = performance.now();
  after(() => recordPerf({ route, kind: "server", ms: Math.round(performance.now() - t0), role }));
});
