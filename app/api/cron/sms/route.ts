import { cronAuthorized } from "@/lib/cron";
import { runParentSms } from "@/lib/parent-sms";
import { runDailySms } from "@/lib/sms";

// Har kuni kechqurun (20:00, Toshkent) chaqiriladi: Vercel Cron (vercel.json) yoki tashqi cron
//   curl -H "Authorization: Bearer $CRON_SECRET" https://sayt.uz/api/cron/sms
// Avval rahbarga kunlik jami (Sheets'dagi yangi to'lovlar olib kelinadi), keyin — ota-onalarga eslatma.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailySms("cron");
  const parents = await runParentSms("cron").catch((err) => ({ status: "failed", message: (err as Error).message, sent: 0, failed: 0 }));
  return Response.json({ ...result, parents }, { status: result.status === "failed" ? 502 : 200 });
}
