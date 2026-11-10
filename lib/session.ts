// Sessiya tokeni (imzolangan JWT). proxy.ts va server kodida birga ishlatiladi (bazaga murojaat qilmaydi).
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "tt_session";
export const SESSION_DAYS = 30;

/**
 * owner — markaz rahbari (hamma narsa), admin — administrator (to'lovlar), teacher — o'qituvchi
 * (faqat o'z o'quvchilari, to'lovlari va oyligini ko'radi).
 */
export type Role = "owner" | "admin" | "teacher";

export const ROLES: readonly Role[] = ["owner", "admin", "teacher"];

export type SessionPayload = {
  role: Role;
  /** Parol barmoq izi: parol almashsa sessiya bekor bo'ladi */
  pv: string;
  /** Xodim profili bilan kirilgan bo'lsa — xodim ID si (eski umumiy parol bilan kirilganda yo'q) */
  sid?: string;
};

const TOKEN_VERSION = 2;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET kamida 32 belgidan iborat bo'lishi kerak (.env.local)");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(role: Role, pv: string, sid?: string): Promise<string> {
  return new SignJWT({ role, pv, v: TOKEN_VERSION, ...(sid ? { sid } : {}) })
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
    if (!ROLES.includes(role as Role) || payload.sub !== role || typeof payload.pv !== "string") return null;
    const sid = typeof payload.sid === "string" && /^[a-f0-9]{24}$/i.test(payload.sid) ? payload.sid : undefined;
    // O'qituvchi faqat xodim profili bilan kira oladi
    if (role === "teacher" && !sid) return null;
    return { role: role as Role, pv: payload.pv, ...(sid ? { sid } : {}) };
  } catch {
    return null;
  }
}

/** Xodim profili sahifasi (rahbardan boshqalar uchun; rahbarda ham ochiladi). */
const ME = (p: string) => p === "/me" || p.startsWith("/me/");

const under = (p: string, base: string) => p === base || p.startsWith(`${base}/`);

/** Rol bo'yicha qaysi sahifalarga kirish mumkin (proxy va sahifalar shu bilan tekshiradi). */
export function canAccess(role: Role, pathname: string): boolean {
  if (role === "owner") return true;
  // Hamma xodim: o'z profili, faoliyat tarixi va tezlik o'lchovini yuborish (brauzer)
  if (ME(pathname) || under(pathname, "/faoliyat") || pathname === "/api/perf") return true;
  if (under(pathname, "/payments") || pathname === "/api/export/tolovlar") return true;
  // Qarzdorlar va davomat — hamma rol (o'qituvchiga faqat o'z o'quvchilari)
  if (under(pathname, "/qarzdorlar") || under(pathname, "/davomat")) return true;
  // O'zi olgan avans/oylik — o'qituvchi va administrator
  if (under(pathname, "/olinganlar")) return true;
  if (role === "teacher") {
    if (pathname === "/" || pathname === "/students" || pathname === "/api/export/oquvchilar") return true;
    // O'quvchi profili va o'z o'quvchisini tahrirlash (cheklangan maydonlar; yangi qo'shish — rahbarda)
    return /^\/students\/[a-f0-9]{24}(\/edit)?$/i.test(pathname);
  }
  return false;
}

/** Eski nom (testlar va mavjud kod uchun): administrator kira oladigan sahifalar. */
export function adminCanAccess(pathname: string): boolean {
  return canAccess("admin", pathname);
}

export function homeFor(role: Role): string {
  return role === "admin" ? "/payments" : "/";
}
