import { timingSafeEqual } from "node:crypto";

/** Cron so'rovi kaliti: `Authorization: Bearer $CRON_SECRET` (Vercel Cron o'zi yuboradi). */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
