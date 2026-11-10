import { cronAuthorized } from "@/lib/cron";
import { runSync } from "@/lib/sync";
import { getSettings } from "@/lib/settings";

// Kuniga bir marta chaqiriladi: Vercel Cron (vercel.json) yoki tashqi cron
//   curl -H "Authorization: Bearer $CRON_SECRET" https://sayt.uz/api/cron/sync
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // Jadval arxivlangan, yangi oy havolasi hali qo'yilmagan — tekshiradigan narsa yo'q
  if (!(await getSettings({ fresh: true })).sheetUrl) return Response.json({ skipped: "Google Sheets havolasi yo'q (arxiv holati)" });
  const result = await runSync("cron");
  if (!result) return Response.json({ skipped: "boshqa tekshiruv ketmoqda" }, { status: 409 });
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
