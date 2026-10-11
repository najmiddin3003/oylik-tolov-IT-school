// O'z serverida (VPS, `next start`) ishlaganda: kuniga bir marta Sheets tekshiruvi va kechki SMS eslatma.
// Vercel'da bu ishlamaydi — u yerda vercel.json dagi cron'lar /api/cron/sync va /api/cron/sms ni chaqiradi.
import { runDailySms, smsHour } from "./sms";
import { runSyncIfDue } from "./sync";
import { tashkentHour } from "./time";

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

    if (tashkentHour() >= smsHour()) {
      runDailySms("auto")
        .then((res) => {
          if (res.status !== "skipped") console.log(`[scheduler] SMS: ${res.status} — ${res.message}`);
        })
        .catch((err) => console.error("[scheduler] SMS xatosi:", err));
    }
  };

  setTimeout(tick, 20_000);
  setInterval(tick, CHECK_EVERY_MS).unref?.();
  console.log("[scheduler] kunlik Sheets tekshiruvi va SMS eslatma rejalashtirildi");
}
