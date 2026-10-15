// Eskiz.uz SMS shlyuzi. Kalitlar Vercel'da: ESKIZ_EMAIL, ESKIZ_PASSWORD (kabinetdagi maxfiy kod).
// API: https://documenter.getpostman.com/view/663428/RzfmES4z

// ESKIZ_BASE_URL — faqat sinov uchun (soxta server); odatda kerak emas
const base = () => process.env.ESKIZ_BASE_URL || "https://notify.eskiz.uz/api";

export class EskizError extends Error {}

// Telefon yordamchilari lib/phone.ts da (brauzerda ham ishlatiladi)
export { formatUzPhone, normalizeUzPhone } from "./phone";
import { normalizeUzPhone } from "./phone";

export function eskizConfigured(): boolean {
  return Boolean(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);
}

let cachedToken: { token: string; at: number } | null = null;

async function login(): Promise<string> {
  // Token ~30 kun yaroqli; protsess ichida 12 soat saqlaymiz
  if (cachedToken && Date.now() - cachedToken.at < 12 * 3600_000) return cachedToken.token;
  if (!eskizConfigured()) throw new EskizError("Eskiz kalitlari kiritilmagan (ESKIZ_EMAIL, ESKIZ_PASSWORD)");
  const res = await fetch(`${base()}/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: process.env.ESKIZ_EMAIL!, password: process.env.ESKIZ_PASSWORD! }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { token?: string }; message?: string };
  if (!res.ok || !json.data?.token) {
    throw new EskizError(`Eskiz'ga kirib bo‘lmadi (HTTP ${res.status}${json.message ? `: ${json.message}` : ""})`);
  }
  cachedToken = { token: json.data.token, at: Date.now() };
  return json.data.token;
}

async function authed(path: string, body: URLSearchParams): Promise<{ status: number; json: Record<string, unknown> }> {
  const call = async (token: string) => {
    const res = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };
  let r = await call(await login());
  if (r.status === 401) {
    cachedToken = null; // token eskirgan bo'lsa — qayta kiramiz
    r = await call(await login());
  }
  return r;
}

/** Bitta SMS yuborish. Muvaffaqiyatli bo'lsa Eskiz xabar ID sini qaytaradi. */
export async function sendSms(phone: string, message: string, from = "4546"): Promise<string> {
  const to = normalizeUzPhone(phone);
  if (!to) throw new EskizError(`Telefon raqam noto‘g‘ri: ${phone}`);
  const { status, json } = await authed(
    "/message/sms/send",
    new URLSearchParams({ mobile_phone: to, message, from: from || "4546" }),
  );
  if (status >= 400 || json.status === "error") {
    const msg = typeof json.message === "string" ? json.message : JSON.stringify(json.message ?? json).slice(0, 200);
    throw new EskizError(`Eskiz SMS yubormadi (HTTP ${status}): ${msg}`);
  }
  return String(json.id ?? "");
}
