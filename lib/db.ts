import dns from "node:dns";
import mongoose from "mongoose";

// Dev rejimida (HMR) va bitta server jarayonida ulanishni qayta ishlatish uchun global kesh.
const g = globalThis as unknown as { __mongoosePromise?: Promise<typeof mongoose> };

const LOOPBACK = new Set(["127.0.0.1", "::1"]);

/**
 * `mongodb+srv://` manzili uchun drayver DNS'dan SRV/TXT yozuvlarini so'raydi.
 * Ba'zi Windows kompyuterlarda Node tizim DNS'ini o'qiy olmay, faqat 127.0.0.1 ni ko'radi
 * va so'rov `querySrv ECONNREFUSED` bilan yiqiladi. Bunday holatda (yoki DNS_SERVERS berilsa)
 * SRV so'rovlari uchun ommaviy DNS serverlari ishlatiladi. Oddiy host nomlari bunga bog'liq emas.
 */
function ensureSrvDns(uri: string) {
  if (!uri.startsWith("mongodb+srv://")) return;
  const configured = process.env.DNS_SERVERS?.split(",").map((s) => s.trim()).filter(Boolean);
  const current = dns.getServers();
  const onlyLoopback = current.length > 0 && current.every((s) => LOOPBACK.has(s.replace(/^\[|\]$/g, "").split("%")[0]));
  if (configured?.length) {
    dns.setServers(configured);
  } else if (onlyLoopback) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.warn("[db] Tizim DNS'i faqat 127.0.0.1 — SRV so'rovlari uchun 8.8.8.8 / 1.1.1.1 ishlatiladi");
  }
}

export function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI ko'rsatilmagan (.env.local faylini tekshiring)");
  }
  if (!g.__mongoosePromise) {
    ensureSrvDns(uri);
    g.__mongoosePromise = mongoose
      .connect(uri, {
        dbName: process.env.MONGODB_DB || undefined,
        serverSelectionTimeoutMS: 10_000,
      })
      .catch((err) => {
        g.__mongoosePromise = undefined;
        throw err;
      });
  }
  return g.__mongoosePromise;
}
