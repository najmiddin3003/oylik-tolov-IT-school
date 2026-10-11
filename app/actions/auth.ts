"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passwordVersion, roleForPassword } from "@/lib/auth";
import { clearFailedLogins, clientIp, loginBlocked, recordFailedLogin } from "@/lib/login-guard";
import { createSessionToken, homeFor, SESSION_COOKIE, SESSION_DAYS, type Role } from "@/lib/session";
import { getSettings, type AppSettings } from "@/lib/settings";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!password) return { error: "Parolni kiriting" };

  let settings: AppSettings;
  let role: Role | null;
  const ip = await clientIp();
  try {
    settings = await getSettings({ fresh: true });
    if (await loginBlocked(ip)) {
      return { error: "Juda ko‘p noto‘g‘ri urinish bo‘ldi. 15 daqiqadan keyin qayta urinib ko‘ring." };
    }
    role = await roleForPassword(password, settings);
    if (role) await clearFailedLogins(ip);
    else await recordFailedLogin(ip);
  } catch (err) {
    console.error("[login]", err);
    return { error: "Ma’lumotlar bazasiga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring." };
  }

  if (!role) {
    await new Promise((r) => setTimeout(r, 800)); // parol tanlashni sekinlashtirish
    const configured = settings.ownerPasswordHash || process.env.ADMIN_PASSWORD;
    return { error: configured ? "Parol noto‘g‘ri" : "ADMIN_PASSWORD sozlanmagan (.env.local faylini tekshiring)" };
  }

  // Bir marta kirgandan keyin 30 kun davomida brauzer sessiyani eslab qoladi
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(role, passwordVersion(role, settings)!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  redirect(homeFor(role));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
