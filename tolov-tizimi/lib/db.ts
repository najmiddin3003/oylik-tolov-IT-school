import mongoose from "mongoose";

// Dev rejimida (HMR) va bitta server jarayonida ulanishni qayta ishlatish uchun global kesh.
const g = globalThis as unknown as { __mongoosePromise?: Promise<typeof mongoose> };

export function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI ko'rsatilmagan (.env.local faylini tekshiring)");
  }
  if (!g.__mongoosePromise) {
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
