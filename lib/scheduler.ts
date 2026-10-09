// O'z serverida (VPS, `next start`) ishlaganda kuniga bir marta Sheets tekshiruvini ishga tushiradi.
// Vercel'da bu ishlamaydi — u yerda vercel.json dagi cron /api/cron/sync ni chaqiradi.
import { runSyncIfDue } from "./sync";

const g = globalThis as unknown as { __syncSchedulerStarted?: boolean };
const CHECK_EVERY_MS = 15 * 60_000;

export function startScheduler() {
  if (g.__syncSchedulerStarted) return;
  g.__syncSchedulerStarted = true;

  const tick = () => {
    runSyncIfDue()
      .then((ran) => {
        if (ran) console.log("[scheduler] Sheets bilan kunlik tekshiruv bajarildi");
      })
      .catch((err) => console.error("[scheduler] tekshiruv xatosi:", err));
  };

  setTimeout(tick, 20_000);
  setInterval(tick, CHECK_EVERY_MS).unref?.();
  console.log("[scheduler] kunlik Sheets tekshiruvi rejalashtirildi");
}
