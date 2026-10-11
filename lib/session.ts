// Sessiya tokeni (imzolangan JWT). proxy.ts va server kodida birga ishlatiladi (bazaga murojaat qilmaydi).
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "tt_session";
export const SESSION_DAYS = 30;

/** owner — markaz rahbari (hamma narsa), admin — administrator (faqat to'lovlar). */
export type Role = "owner" | "admin";

export type SessionPayload = {
  role: Role;
  /** Parol barmoq izi: parol almashsa sessiya bekor bo'ladi */
  pv: string;
};

const TOKEN_VERSION = 2;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET kamida 32 belgidan iborat bo'lishi kerak (.env.local)");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(role: Role, pv: string): Promise<string> {
  return new SignJWT({ role, pv, v: TOKEN_VERSION })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(role)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** Token imzosi va muddatini tekshiradi. Parol barmoq izi esa lib/auth.ts da (bazadagi parol bilan) tekshiriladi. */
export async function readSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.v !== TOKEN_VERSION) return null;
    const role = payload.role;
    if ((role !== "owner" && role !== "admin") || payload.sub !== role || typeof payload.pv !== "string") return null;
    return { role, pv: payload.pv };
  } catch {
    return null;
  }
}

/** Administrator kira oladigan sahifalar (qolganlari — faqat rahbar uchun). */
export function adminCanAccess(pathname: string): boolean {
  return pathname === "/payments" || pathname.startsWith("/payments/") || pathname === "/api/export/tolovlar";
}

export function homeFor(role: Role): string {
  return role === "owner" ? "/" : "/payments";
}
