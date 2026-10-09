export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Vercel'da jarayon doimiy emas — u yerda vercel.json cron ishlatiladi.
  if (process.env.VERCEL || process.env.INTERNAL_CRON === "false") return;
  if (!process.env.MONGODB_URI) return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
