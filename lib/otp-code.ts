// SMS tasdiqlash kodi: yaratish, iz (hash) va SMS matni (sof funksiyalar — testlanadi).
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
/** Kod shuncha vaqt yaroqli */
export const OTP_TTL_MS = 10 * 60_000;
/** Bitta kodga noto'g'ri urinishlar chegarasi */
export const OTP_MAX_ATTEMPTS = 5;
/** Bir raqamga qayta yuborishdan oldin kutish */
export const OTP_RESEND_MS = 60_000;
/** Bir raqamga kuniga ko'pi bilan */
export const OTP_PER_PHONE_DAY = 5;
/** Bir manzildan (IP) soatiga ko'pi bilan */
export const OTP_PER_IP_HOUR = 10;

// SMS matni (standart matn, kod o'rni) — brauzerda ham ishlatiladi, shuning uchun alohida faylda
export { DEFAULT_OTP_TEMPLATE, renderOtpText, templateHasCode } from "./otp-text";

export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Kodning izi (AUTH_SECRET bilan): bazada kodning o'zi saqlanmaydi. */
export function hashOtpCode(phone: string, code: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`otp:${phone}:${code}`).digest("base64url");
}

export function otpMatches(phone: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtpCode(phone, code));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Foydalanuvchi kiritgan koddan faqat raqamlar (bo'shliq va chiziqchalarsiz). */
export function cleanOtpInput(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\D/g, "").slice(0, OTP_LENGTH) : "";
}

/** Baza shu kompyuterdami (lokal sinov bazasi): mongodb://127.0.0.1 yoki localhost. */
export function isLocalDb(uri: string | undefined): boolean {
  return /^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(uri ?? "");
}
