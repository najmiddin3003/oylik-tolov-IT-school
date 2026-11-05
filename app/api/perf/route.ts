// Brauzerdan tezlik o'lchovi: sayt birinchi ochilganda va sahifaga o'tilganda mazmun qancha vaqtda chiqqani
// (components/PerfWatcher.tsx yuboradi). Faqat tizimga kirgan foydalanuvchidan; yozish javobdan keyin.
import { after } from "next/server";
import { getSession } from "@/lib/auth";
import { recordPerf, requestOrigin } from "@/lib/perf";
import { parsePerfBeacon } from "@/lib/perf-rules";

export async function POST(request: Request) {
  // Qaysi Vercel tuguni orqali kelgani (brauzer o'lchovlari foydalanuvchining tuguni bo'yicha guruhlanadi)
  const origin = requestOrigin(request.headers.get("x-vercel-id"));
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const text = await request.text();
  if (text.length > 2000) return new Response(null, { status: 413 });
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const entry = parsePerfBeacon(raw);
  if (!entry) return new Response(null, { status: 400 });
  after(() => recordPerf({ ...entry, role: session.role, ...origin }));
  return new Response(null, { status: 204 });
}
