// Parollarni xavfsiz saqlash (scrypt) va sessiyani parol almashganda bekor qilish uchun "barmoq izi".
// scrypt asinxron ishlatiladi — tekshiruv paytida server boshqa so'rovlarga javob berishda davom etadi.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;

export const MIN_PASSWORD_LENGTH = 8;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  if (expected.length !== KEYLEN) return false;
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64url"));
  return timingSafeEqual(expected, actual);
}

/** Matnni vaqt bo'yicha teng taqqoslash — .env dagi parol uchun. */
export function safeEqualText(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a.normalize("NFKC")).digest();
  const hb = createHash("sha256").update(b.normalize("NFKC")).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Parolning qisqa barmoq izi (AUTH_SECRET bilan HMAC): sessiya tokenida saqlanadi.
 * Parol almashsa — iz o'zgaradi va eski sessiyalar yaroqsiz bo'ladi. Izdan parolni topib bo'lmaydi.
 */
export function fingerprint(secretMaterial: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(secretMaterial).digest("base64url").slice(0, 16);
}
