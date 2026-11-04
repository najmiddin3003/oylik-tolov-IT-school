import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { fingerprint, safeEqualText, verifyPassword } from "./passwords";
import { createSessionToken, homeFor, readSessionToken, SESSION_COOKIE, SESSION_DAYS, type Role } from "./session";
import { getSettings, type AppSettings } from "./settings";
import { activeStaffRoles, getStaffById, staffPasswordVersion } from "./staff";
import { legacyLoginAllowed } from "./staff-rules";
import { startServerPerf } from "./perf";

export type Session = {
  role: Role;
  /** Xodim profili bilan kirilgan bo'lsa — xodim ID si; eski umumiy parol bilan — null */
  staffId: string | null;
  /** Xodimning ismi (eski umumiy parol bilan kirilganda — null) */
  name: string | null;
};

/** Eski umumiy parolning joriy barmoq izi. Parol almashsa — o'zgaradi va eski sessiyalar bekor bo'ladi. */
export function passwordVersion(role: Role, s: AppSettings): string | null {
  if (role === "owner") {
    if (s.ownerPasswordHash) return fingerprint(`owner:${s.ownerPasswordHash}`);
    const env = process.env.ADMIN_PASSWORD;
    return env ? fingerprint(`owner-env:${env}`) : null;
  }
  if (role === "admin") return s.adminPasswordHash ? fingerprint(`admin:${s.adminPasswordHash}`) : null;
  return null;
}

/** Rahbarning eski umumiy paroli: bazada o'rnatilgan bo'lsa — o'sha, aks holda .env dagi ADMIN_PASSWORD. */
export async function isOwnerPassword(password: string, s: AppSettings): Promise<boolean> {
  if (s.ownerPasswordHash) return verifyPassword(password, s.ownerPasswordHash);
  const env = process.env.ADMIN_PASSWORD;
  return Boolean(env) && safeEqualText(password, env!);
}

/** Eski umumiy parol kimniki: rahbar, administrator yoki hech kim. */
export async function roleForPassword(password: string, s: AppSettings): Promise<Role | null> {
  if (!password) return null;
  if (await isOwnerPassword(password, s)) return "owner";
  if (s.adminPasswordHash && (await verifyPassword(password, s.adminPasswordHash))) return "admin";
  return null;
}

async function readSession(fresh: boolean): Promise<Session | null> {
  const payload = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  // Xodim profili: xodim faol, roli o'zgarmagan va paroli almashmagan bo'lishi kerak
  if (payload.sid) {
    const staff = await getStaffById(payload.sid);
    if (!staff || staff.status !== "active" || staff.role !== payload.role || !staff.passwordHash) return null;
    if (staffPasswordVersion(String(staff._id), staff.passwordHash) !== payload.pv) return null;
    return { role: staff.role, staffId: String(staff._id), name: staff.name };
  }

  // Eski umumiy parol — faqat o'tish davrida (shu roldagi faol xodim profili bo'lmasa)
  if (!legacyLoginAllowed(payload.role, await activeStaffRoles())) return null;
  let expected = passwordVersion(payload.role, await getSettings({ fresh }));
  // Kesh eskirgan bo'lishi mumkin (parol boshqa server nusxasida hozirgina almashgan) — bir marta yangidan o'qiymiz
  if (!fresh && expected !== payload.pv) expected = passwordVersion(payload.role, await getSettings({ fresh: true }));
  if (!expected || expected !== payload.pv) return null;
  return { role: payload.role, staffId: null, name: null };
}

/** Joriy so'rovning sessiyasi (bitta so'rov ichida bir marta o'qiladi; sozlamalar 15 soniyalik keshdan). */
export const getSession = cache(async (): Promise<Session | null> => readSession(false));

type AuthOptions = {
  /**
   * Parol/kirish huquqini keshsiz, bazadan yangidan tekshirish. Ma'lumot o'zgartiradigan amallar
   * (server action, eksport) uchun: parol almashgan yoki kirish o'chirilgan bo'lsa — darhol to'xtaydi.
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

/** Faqat ko'rsatilgan rollar uchun; boshqasi o'z bosh sahifasiga qaytariladi. */
export async function requireRole(roles: readonly Role[], opts: AuthOptions = {}): Promise<Session> {
  const session = await requireAuth(opts);
  if (!roles.includes(session.role)) redirect(homeFor(session.role));
  return session;
}

/** Faqat markaz rahbari uchun. */
export async function requireOwner(opts: AuthOptions = {}): Promise<Session> {
  return requireRole(["owner"], opts);
}

/**
 * Sahifa kontenti boshida: sahifani so'rov vaqtida render qilishni bildiradi (joriy oy/sana
 * hisoblanishidan oldin shart — Cache Components) va kirishni tekshiradi.
 */
export async function pageGuard(): Promise<Session> {
  await connection();
  return tracked(await requireAuth());
}

export async function ownerGuard(): Promise<Session> {
  await connection();
  return tracked(await requireOwner());
}

export async function roleGuard(roles: readonly Role[]): Promise<Session> {
  await connection();
  return tracked(await requireRole(roles));
}

/** Sahifa ochildi: tezlik o'lchovini boshlash (bir so'rovda bir marta; lib/perf.ts). */
async function tracked(session: Session): Promise<Session> {
  await startServerPerf(session.role);
  return session;
}

/** Kirish cookie'sini o'rnatish (30 kun). */
export async function setSessionCookie(role: Role, pv: string, sid?: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(role, pv, sid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}
