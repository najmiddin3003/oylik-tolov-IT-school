import "server-only";
// Texnik yordam (faqat o'qish): sayt egasi Vercel'da SUPPORT_TOKEN qo'ysa, shu kalit bilan ma'lumotni tekshirish
// mumkin (masalan, «bu o'quvchi CRMda bormi?»). Kalit yo'q yoki qisqa bo'lsa — manzil umuman ishlamaydi (404).
import { timingSafeEqual } from "node:crypto";

/** Kalit kamida shuncha belgi bo'lishi kerak (taxmin qilib bo'lmasligi uchun). */
export const SUPPORT_TOKEN_MIN = 24;

/** Vercel'ga nusxalanganda kalit oxiriga tushib qolgan bo'shliq/yangi qator hisobga olinmaydi. */
function supportToken(): string {
  return (process.env.SUPPORT_TOKEN ?? "").trim();
}

export function supportEnabled(): boolean {
  return supportToken().length >= SUPPORT_TOKEN_MIN;
}

export function supportAuthorized(request: Request): boolean {
  const secret = supportToken();
  const header = request.headers.get("authorization")?.trim();
  if (secret.length < SUPPORT_TOKEN_MIN || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
