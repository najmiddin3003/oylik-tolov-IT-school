import { timingSafeEqual } from "node:crypto";
import { runSync } from "@/lib/sync";

// Kuniga bir marta chaqiriladi: Vercel Cron (vercel.json) yoki tashqi cron
//   curl -H "Authorization: Bearer $CRON_SECRET" https://sayt.uz/api/cron/sync
export const maxDuration = 60;

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runSync("cron");
  if (!result) return Response.json({ skipped: "boshqa tekshiruv ketmoqda" }, { status: 409 });
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
