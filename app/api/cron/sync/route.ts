import { cronAuthorized } from "@/lib/cron";
import { runSync } from "@/lib/sync";

// Kuniga bir marta chaqiriladi: Vercel Cron (vercel.json) yoki tashqi cron
//   curl -H "Authorization: Bearer $CRON_SECRET" https://sayt.uz/api/cron/sync
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runSync("cron");
  if (!result) return Response.json({ skipped: "boshqa tekshiruv ketmoqda" }, { status: 409 });
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
