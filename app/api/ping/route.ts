import mongoose from "mongoose";
import { connection } from "next/server";
import { connectDB } from "@/lib/db";

// Serverni «uyg'oq» ushlab turish: tashqi xizmat (masalan, cron-job.org) ish vaqtida har 5 daqiqada chaqiradi.
// Foydalanuvchi kam bo'lsa server uxlab qoladi va keyingi birinchi ochilish ~1,5 s ko'proq kutadi
// («Tezlik» → «Server uyg'onishi»). Bazaga ulanish ham tirik turadi. Kirish shart emas, hech qanday ma'lumot qaytarmaydi.
// Maxsus sozlama (maxDuration va h.k.) qo'yilmaydi — sahifalar bilan bir xil server funksiyasida qolishi uchun.
export async function GET() {
  await connection();
  const t0 = performance.now();
  try {
    await connectDB();
    await mongoose.connection.db?.command({ ping: 1 });
    return Response.json({ ok: true, ms: Math.round(performance.now() - t0) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
