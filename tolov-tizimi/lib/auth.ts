import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "./session";

/** Har bir sahifa ma'lumoti va server action boshida chaqiriladi. Kirmagan bo'lsa — /login ga. */
export async function requireAuth(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSessionToken(token))) redirect("/login");
}

/**
 * Sahifa kontenti boshida: sahifani so'rov vaqtida render qilishni bildiradi (joriy oy/sana
 * hisoblanishidan oldin shart — Cache Components) va kirishni tekshiradi.
 */
export async function pageGuard(): Promise<void> {
  await connection();
  await requireAuth();
}
