import { cronAuthorized } from "@/lib/cron";
import { runDailySms } from "@/lib/sms";

// Har kuni kechqurun (20:00, Toshkent) chaqiriladi: Vercel Cron (vercel.json) yoki tashqi cron
//   curl -H "Authorization: Bearer $CRON_SECRET" https://sayt.uz/api/cron/sms
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailySms("cron");
  return Response.json(result, { status: result.status === "failed" ? 502 : 200 });
}
