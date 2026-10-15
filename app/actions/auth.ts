"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { getSession, passwordVersion, requireAuth, roleForPassword, setSessionCookie } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { formatUzPhone, normalizeUzPhone } from "@/lib/eskiz";
import { clearFailedLogins, clientIp, loginBlocked, recordFailedLogin } from "@/lib/login-guard";
import { Staff } from "@/lib/models";
import { cleanOtpInput, OTP_LENGTH } from "@/lib/otp-code";
import { sendOtp, verifyOtp } from "@/lib/otp";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/passwords";
import { homeFor, SESSION_COOKIE, type Role } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { activeStaffRoles, findStaffByPhone, getStaffById, staffPasswordVersion } from "@/lib/staff";
import { legacyLoginAllowed } from "@/lib/staff-rules";
import type { FormState } from "./types";

export type LoginState = { error?: string; phone?: string };

const pause = () => new Promise((r) => setTimeout(r, 800)); // parol tanlashni sekinlashtirish

/**
 * Kirish: telefon raqam + parol (xodim profili). Telefon bo'sh qoldirilsa — eski umumiy parol
 * (rahbar / administrator), faqat shu rolda hali faol xodim profili bo'lmasa (o'tish davri).
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phoneRaw = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!password) return { error: "Parolni kiriting", phone: phoneRaw };

  const ip = await clientIp();
  let target: { role: Role; pv: string; sid?: string } | null = null;
  let error = "";
  try {
    if (await loginBlocked(ip)) {
      return { error: "Juda ko‘p noto‘g‘ri urinish bo‘ldi. 15 daqiqadan keyin qayta urinib ko‘ring.", phone: phoneRaw };
    }
    if (phoneRaw) {
      const phone = normalizeUzPhone(phoneRaw);
      if (!phone) return { error: "Telefon raqamni to‘liq kiriting, masalan: 90 123 45 67", phone: phoneRaw };
      const staff = await findStaffByPhone(phone);
      if (staff?.status === "active" && staff.passwordHash && (await verifyPassword(password, staff.passwordHash))) {
        const sid = String(staff._id);
        target = { role: staff.role, pv: staffPasswordVersion(sid, staff.passwordHash), sid };
        await Staff.updateOne({ _id: staff._id }, { $set: { lastLoginAt: new Date() } });
      } else if (staff?.status === "invited") {
        error = "Siz hali ro‘yxatdan o‘tmagansiz: «Ro‘yxatdan o‘tish» orqali SMS kod bilan parol yarating.";
      } else if (staff?.status === "disabled") {
        error = "Kirishingiz o‘chirilgan. Rahbarga murojaat qiling.";
      } else {
        error = "Telefon raqam yoki parol noto‘g‘ri";
      }
    } else {
      const settings = await getSettings({ fresh: true });
      const role = await roleForPassword(password, settings);
      if (role && legacyLoginAllowed(role, await activeStaffRoles())) {
        target = { role, pv: passwordVersion(role, settings)! };
      } else if (role) {
        error = "Endi telefon raqamingiz va o‘z parolingiz bilan kiring.";
      } else {
        const configured = settings.ownerPasswordHash || process.env.ADMIN_PASSWORD;
        error = configured ? "Telefon raqamingizni ham kiriting (yoki parol noto‘g‘ri)" : "ADMIN_PASSWORD sozlanmagan (.env.local faylini tekshiring)";
      }
    }
    if (target) await clearFailedLogins(ip);
    else await recordFailedLogin(ip);
  } catch (err) {
    console.error("[login]", err);
    return { error: "Ma’lumotlar bazasiga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.", phone: phoneRaw };
  }

  if (!target) {
    await pause();
    return { error, phone: phoneRaw };
  }
  // Bir marta kirgandan keyin 30 kun davomida brauzer sessiyani eslab qoladi
  await setSessionCookie(target.role, target.pv, target.sid);
  await logActivity({ role: target.role, staffId: target.sid ?? null }, "login", target.sid ? "Tizimga kirdi" : "Tizimga kirdi (umumiy parol bilan)");
  redirect(homeFor(target.role));
}

export async function logout() {
  const session = await getSession().catch(() => null);
  if (session) await logActivity(session, "logout", "Tizimdan chiqdi");
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- Ro'yxatdan o'tish / parolni tiklash (SMS kod) ----------

export type CodeState = {
  step: "phone" | "code";
  phone?: string;
  /** Kimga: ro'yxatdan o'tish yoki parolni tiklash */
  purpose?: "activate" | "reset";
  name?: string;
  error?: string;
  info?: string;
  /** Qayta yuborish mumkin bo'lgan vaqt (ms) */
  resendAt?: number;
  /** Faqat lokal sinovda (SMS yuborilmaganda) — kod ekranda ko'rsatiladi */
  devCode?: string;
  fieldErrors?: Record<string, string>;
};

export async function requestCode(prev: CodeState, formData: FormData): Promise<CodeState> {
  const raw = String(formData.get("phone") ?? "").slice(0, 40);
  const phone = normalizeUzPhone(raw);
  if (!phone) return { step: "phone", phone: raw, error: "Telefon raqamni to‘liq kiriting, masalan: 90 123 45 67" };
  try {
    const res = await sendOtp(phone, await clientIp());
    if (!res.ok) {
      // Kod yaqinda yuborilgan bo'lsa — kod kiritish oynasida qolamiz
      const stay = prev.step === "code" && prev.phone === phone;
      return { ...(stay ? prev : { step: "phone" as const }), phone, error: res.error, resendAt: res.resendAt, devCode: undefined };
    }
    return {
      step: "code",
      phone,
      purpose: res.purpose,
      name: res.name,
      resendAt: res.resendAt,
      devCode: res.devCode,
      info: res.devCode
        ? "Lokal sinov rejimi: SMS yuborilmadi, kod quyida ko‘rsatilgan."
        : `Tasdiqlash kodi ${formatUzPhone(phone)} raqamiga SMS qilib yuborildi.`,
    };
  } catch (err) {
    console.error("[otp]", err);
    return { step: "phone", phone: raw, error: "Ma’lumotlar bazasiga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring." };
  }
}

export async function verifyCode(prev: CodeState, formData: FormData): Promise<CodeState> {
  const phone = normalizeUzPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { step: "phone", error: "Telefon raqamni qaytadan kiriting" };
  const code = cleanOtpInput(formData.get("code"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (code.length !== OTP_LENGTH) fieldErrors.code = `SMS’dagi ${OTP_LENGTH} xonali kodni kiriting`;
  if (password.length < MIN_PASSWORD_LENGTH) fieldErrors.password = `Kamida ${MIN_PASSWORD_LENGTH} ta belgi`;
  else if (password.length > 100) fieldErrors.password = "Juda uzun";
  if (confirm !== password) fieldErrors.confirm = "Parollar bir xil emas";
  const keep = { ...prev, step: "code" as const, phone };
  if (Object.keys(fieldErrors).length) return { ...keep, error: undefined, fieldErrors };

  let target: { role: Role; pv: string; sid: string };
  try {
    const res = await verifyOtp(phone, code);
    if (!res.ok) return { ...keep, error: res.error, fieldErrors: undefined };
    const sid = String(res.staff._id);
    const passwordHash = await hashPassword(password);
    // Shu orada rahbar kirishni o'chirgan yoki raqamni almashtirgan bo'lsa — qayta yoqib yubormaymiz
    const updated = await Staff.updateOne(
      { _id: res.staff._id, phone, status: { $ne: "disabled" } },
      { $set: { passwordHash, status: "active", activatedAt: res.staff.activatedAt ?? new Date(), lastLoginAt: new Date() } },
    );
    if (updated.matchedCount !== 1) return { ...keep, error: "Kirishingiz o‘chirilgan. Rahbarga murojaat qiling.", fieldErrors: undefined };
    target = { role: res.staff.role, pv: staffPasswordVersion(sid, passwordHash), sid };
    await logActivity(
      { role: res.staff.role, staffId: sid },
      res.staff.status === "active" ? "auth.reset" : "auth.register",
      res.staff.status === "active" ? "Parol SMS kod orqali tiklandi va tizimga kirdi" : "SMS kod bilan ro‘yxatdan o‘tdi va parol yaratdi",
    );
  } catch (err) {
    console.error("[otp]", err);
    return { ...keep, error: "Ma’lumotlar bazasiga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring." };
  }
  await setSessionCookie(target.role, target.pv, target.sid);
  redirect(homeFor(target.role));
}

// ---------- O'z parolini almashtirish (xodim profili) ----------

export async function changeMyPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAuth({ fresh: true });
  if (!session.staffId) return { error: "Bu amal xodim profili uchun" };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (next.length < MIN_PASSWORD_LENGTH) fieldErrors.next = `Kamida ${MIN_PASSWORD_LENGTH} ta belgi`;
  else if (next.length > 100) fieldErrors.next = "Juda uzun";
  if (confirm !== next) fieldErrors.confirm = "Parollar bir xil emas";
  await connectDB();
  const staff = await getStaffById(session.staffId);
  if (!staff?.passwordHash || !(await verifyPassword(current, staff.passwordHash))) fieldErrors.current = "Joriy parol noto‘g‘ri";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const passwordHash = await hashPassword(next);
  await Staff.updateOne({ _id: staff!._id }, { $set: { passwordHash } });
  await logActivity(session, "auth.password", "Parol almashtirildi");
  // Boshqa qurilmalardagi sessiyalar bekor bo'ladi; shu brauzerdagi sessiya yangilanadi
  await setSessionCookie(session.role, staffPasswordVersion(session.staffId, passwordHash), session.staffId);
  return { ok: true, message: "Parolingiz almashtirildi. Boshqa qurilmalarda qayta kirish kerak bo‘ladi.", nonce: Date.now() };
}
