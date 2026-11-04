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

export type PerfEntry = {
  route: string;
  kind: PerfKind;
  ms: number;
  role: Role;
  ttfb?: number | null;
  wait?: number | null;
  conn?: number | null;
  cold?: boolean | null;
  boot?: number | null;
};

/** Bitta o'lchovni yozish (Vercel loglarida ham bir qator). Xato bo'lsa — jim o'tadi: o'lchov sahifani buzmasin. */
export async function recordPerf(entry: PerfEntry): Promise<void> {
  const parts = [
    entry.ttfb != null ? `ttfb=${entry.ttfb}ms` : "",
    entry.wait != null ? `wait=${entry.wait}ms` : "",
    entry.conn ? `conn=${entry.conn}ms` : "",
    entry.cold ? `cold${entry.boot != null ? `=${entry.boot}ms` : ""}` : "",
  ].filter(Boolean);
  console.log(`[perf] ${entry.kind} ${entry.route} ${entry.ms}ms${parts.length ? ` ${parts.join(" ")}` : ""} (${entry.role})`);
  try {
    await connectDB();
    await Perf.create({
      route: entry.route,
      kind: entry.kind,
      ms: entry.ms,
      role: entry.role,
      ttfb: entry.ttfb ?? null,
      wait: entry.wait ?? null,
      conn: entry.conn ?? null,
      cold: entry.cold ?? null,
      boot: entry.boot ?? null,
      at: new Date(),
    });
  } catch (err) {
    console.error("[perf] yozilmadi", err);
  }
}

/**
 * Server nusxasi (instance) «uyg'onishi»: ishlamay turgan server yangidan ishga tushib, birinchi so'rovga javob beradi —
 * foydalanuvchi shu vaqtni qo'shimcha kutadi. Shu nusxa hali sahifa ochmagan bo'lsa, so'rov «sovuq» deb belgilanadi.
 * Node'da `performance.now()` jarayon ishga tushgandan beri sanaladi: sovuq so'rovda u taxminan uyg'onishga ketgan vaqt.
 */
let warmed = false;
const BOOT_MAX_MS = 30_000;

/**
 * Sahifa serverda qancha vaqtda tayyorlanganini o'lchashni boshlaydi: shu paytdan javob to'liq yuborilguncha.
 * Sahifa guard'lari chaqiradi; bir so'rovda bir marta (menyu va sahifa birga chaqirsa ham). Sahifa turini proxy
 * so'rovga qo'yadi — prefetch va server action so'rovlarida u yo'q, ular o'lchanmaydi.
 */
export const startServerPerf = cache(async (role: Role): Promise<void> => {
  const route = perfRoute((await headers()).get(PERF_HEADER) ?? "");
  if (!route) return;
  const t0 = performance.now();
  const cold = !warmed;
  warmed = true;
  // Jarayon ancha oldin ishga tushgan bo'lsa (boshqa so'rovlar uchun) — uyg'onish vaqti noma'lum
  const boot = cold && t0 <= BOOT_MAX_MS ? Math.round(t0) : null;
  after(() => recordPerf({ route, kind: "server", ms: Math.round(performance.now() - t0), role, cold, boot }));
});
