import "server-only";
// Texnik yordam (faqat o'qish): sayt egasi Vercel'da SUPPORT_TOKEN qo'ysa, shu kalit bilan ma'lumotni tekshirish
// mumkin (masalan, «bu o'quvchi CRMda bormi?»). Kalit yo'q yoki qisqa bo'lsa — manzil umuman ishlamaydi (404).
import { timingSafeEqual } from "node:crypto";

/** Kalit kamida shuncha belgi bo'lishi kerak (taxmin qilib bo'lmasligi uchun). */
export const SUPPORT_TOKEN_MIN = 24;

export function supportEnabled(): boolean {
  return (process.env.SUPPORT_TOKEN ?? "").length >= SUPPORT_TOKEN_MIN;
}

export function supportAuthorized(request: Request): boolean {
  const secret = process.env.SUPPORT_TOKEN ?? "";
  const header = request.headers.get("authorization");
  if (secret.length < SUPPORT_TOKEN_MIN || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
