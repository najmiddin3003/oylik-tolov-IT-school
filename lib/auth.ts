import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { fingerprint, safeEqualText, verifyPassword } from "./passwords";
import { homeFor, readSessionToken, SESSION_COOKIE, type Role } from "./session";
import { getSettings, type AppSettings } from "./settings";

export type Session = { role: Role };

/** Parolning joriy barmoq izi. Parol almashsa — o'zgaradi va eski sessiyalar bekor bo'ladi. */
export function passwordVersion(role: Role, s: AppSettings): string | null {
  if (role === "owner") {
    if (s.ownerPasswordHash) return fingerprint(`owner:${s.ownerPasswordHash}`);
    const env = process.env.ADMIN_PASSWORD;
    return env ? fingerprint(`owner-env:${env}`) : null;
  }
  return s.adminPasswordHash ? fingerprint(`admin:${s.adminPasswordHash}`) : null;
}

/** Rahbar parolimi? Bazada o'rnatilgan bo'lsa — o'sha, aks holda .env dagi ADMIN_PASSWORD. */
export async function isOwnerPassword(password: string, s: AppSettings): Promise<boolean> {
  if (s.ownerPasswordHash) return verifyPassword(password, s.ownerPasswordHash);
  const env = process.env.ADMIN_PASSWORD;
  return Boolean(env) && safeEqualText(password, env!);
}

/** Parol kimniki: rahbar, administrator yoki hech kim. */
export async function roleForPassword(password: string, s: AppSettings): Promise<Role | null> {
  if (!password) return null;
  if (await isOwnerPassword(password, s)) return "owner";
  if (s.adminPasswordHash && (await verifyPassword(password, s.adminPasswordHash))) return "admin";
  return null;
}

async function readSession(fresh: boolean): Promise<Session | null> {
  const payload = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  let expected = passwordVersion(payload.role, await getSettings({ fresh }));
  // Kesh eskirgan bo'lishi mumkin (parol boshqa server nusxasida hozirgina almashgan) — bir marta yangidan o'qiymiz
  if (!fresh && expected !== payload.pv) expected = passwordVersion(payload.role, await getSettings({ fresh: true }));
  if (!expected || expected !== payload.pv) return null;
  return { role: payload.role };
}

/** Joriy so'rovning sessiyasi (bitta so'rov ichida bir marta o'qiladi; sozlamalar 15 soniyalik keshdan). */
export const getSession = cache(async (): Promise<Session | null> => readSession(false));

type AuthOptions = {
  /**
   * Parol/kirish huquqini keshsiz, bazadan yangidan tekshirish. Ma'lumot o'zgartiradigan amallar
   * (server action, eksport) uchun: parol almashgan yoki opaning kirishi o'chirilgan bo'lsa — darhol to'xtaydi.
   */
  fresh?: boolean;
};

/** Kirmagan bo'lsa — /login ga. Eskirgan cookie bo'lsa — avval tozalanadi (/logout). */
export async function requireAuth(opts: AuthOptions = {}): Promise<Session> {
  const session = opts.fresh ? await readSession(true) : await getSession();
  if (session) return session;
  const hasCookie = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  redirect(hasCookie ? "/logout" : "/login");
}

/** Faqat markaz rahbari uchun. Administrator bo'lsa — to'lovlar sahifasiga qaytariladi. */
export async function requireOwner(opts: AuthOptions = {}): Promise<Session> {
  const session = await requireAuth(opts);
  if (session.role !== "owner") redirect(homeFor(session.role));
  return session;
}

/**
 * Sahifa kontenti boshida: sahifani so'rov vaqtida render qilishni bildiradi (joriy oy/sana
 * hisoblanishidan oldin shart — Cache Components) va kirishni tekshiradi.
 */
export async function pageGuard(): Promise<Session> {
  await connection();
  return requireAuth();
}

export async function ownerGuard(): Promise<Session> {
  await connection();
  return requireOwner();
}
