import "server-only";
// Parolni taxmin qilishni cheklash: bir manzildan 15 daqiqada 10 ta noto'g'ri urinish — vaqtincha bloklanadi.
// Umumiy hujum sezilsa (15 daqiqada 100+ xato) — har bir manzilga atigi 3 ta urinish qoladi.
import { headers } from "next/headers";
import { LoginAttempt } from "./models";

const WINDOW_MS = 15 * 60_000;
const PER_IP = 10;
const GLOBAL = 100;
const PER_IP_UNDER_ATTACK = 3;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip") || "local").slice(0, 64);
}

export async function loginBlocked(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [mine, all] = await Promise.all([
    LoginAttempt.countDocuments({ ip, at: { $gt: since } }),
    LoginAttempt.countDocuments({ at: { $gt: since } }),
  ]);
  return mine >= PER_IP || (all >= GLOBAL && mine >= PER_IP_UNDER_ATTACK);
}

export async function recordFailedLogin(ip: string): Promise<void> {
  await LoginAttempt.create({ ip, at: new Date() });
}

export async function clearFailedLogins(ip: string): Promise<void> {
  await LoginAttempt.deleteMany({ ip });
}
