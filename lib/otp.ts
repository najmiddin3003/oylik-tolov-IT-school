import "server-only";
// Xodimlar uchun SMS tasdiqlash: ro'yxatdan o'tish (parol yaratish) va parolni tiklash.
// Kod faqat rahbar «Xodimlar» bo'limida qo'shgan raqamlarga yuboriladi.
import { connectDB } from "./db";
import { eskizConfigured, EskizError, formatUzPhone, sendSms } from "./eskiz";
import { Otp } from "./models";
import {
  generateOtpCode,
  isLocalDb,
  hashOtpCode,
  OTP_MAX_ATTEMPTS,
  OTP_PER_IP_HOUR,
  OTP_PER_PHONE_DAY,
  OTP_RESEND_MS,
  OTP_TTL_MS,
  otpMatches,
  renderOtpText,
} from "./otp-code";
import { getSettings } from "./settings";
import { ensureOwnerInvite, findStaffByPhone, type StaffLean } from "./staff";

export type OtpPurpose = "activate" | "reset";

export type SendOtpResult =
  | { ok: true; purpose: OtpPurpose; name: string; resendAt: number; devCode?: string }
  | { ok: false; error: string; resendAt?: number };

/**
 * Lokal sinovda (Eskiz kalitlarisiz, production emas va baza ham lokal) — kod SMS o'rniga ekranda ko'rsatiladi.
 * Haqiqiy bazaga ulangan dev server kodni hech qachon ekranga chiqarmaydi (aks holda SMS'siz parol qo'yish mumkin bo'lardi).
 */
function devMode(): boolean {
  return !eskizConfigured() && process.env.NODE_ENV !== "production" && isLocalDb(process.env.MONGODB_URI);
}

export async function sendOtp(phone: string, ip: string): Promise<SendOtpResult> {
  await connectDB();
  let staff = await findStaffByPhone(phone);
  // Rahbarning birinchi kirishi: profili hali yo'q bo'lsa — shu yerda yaratiladi (faqat rahbar raqami uchun)
  if (!staff && (await ensureOwnerInvite(phone))) staff = await findStaffByPhone(phone);
  if (!staff) {
    return { ok: false, error: "Bu raqam xodimlar ro‘yxatida yo‘q. Rahbar sizni «Xodimlar» bo‘limida qo‘shgan bo‘lishi kerak." };
  }
  if (staff.status === "disabled") return { ok: false, error: "Kirishingiz o‘chirilgan. Rahbarga murojaat qiling." };
  const purpose: OtpPurpose = staff.status === "active" ? "reset" : "activate";

  // Chegaralar: qayta yuborishdan oldin 1 daqiqa, raqamga kuniga 5 ta, bir manzildan soatiga 10 ta
  const now = Date.now();
  const last = await Otp.findOne({ phone }, { createdAt: 1 }).sort({ createdAt: -1 }).lean<{ createdAt: Date }>();
  if (last && now - last.createdAt.getTime() < OTP_RESEND_MS) {
    const resendAt = last.createdAt.getTime() + OTP_RESEND_MS;
    return { ok: false, error: `Kod yaqinda yuborildi — ${Math.ceil((resendAt - now) / 1000)} soniyadan keyin qayta so‘rang`, resendAt };
  }
  const [perPhone, perIp] = await Promise.all([
    Otp.countDocuments({ phone, createdAt: { $gt: new Date(now - 24 * 3600_000) } }),
    ip ? Otp.countDocuments({ ip, createdAt: { $gt: new Date(now - 3600_000) } }) : Promise.resolve(0),
  ]);
  if (perPhone >= OTP_PER_PHONE_DAY) {
    return { ok: false, error: "Bugun bu raqamga juda ko‘p kod yuborildi. Ertaga urinib ko‘ring yoki rahbarga murojaat qiling." };
  }
  if (perIp >= OTP_PER_IP_HOUR) return { ok: false, error: "Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta urinib ko‘ring." };

  const code = generateOtpCode();
  // Faqat eng oxirgi kod ishlaydi
  await Otp.updateMany({ phone, usedAt: null }, { $set: { usedAt: new Date() } });
  const otp = await Otp.create({ phone, purpose, codeHash: hashOtpCode(phone, code), expiresAt: new Date(now + OTP_TTL_MS), ip });
  const resendAt = now + OTP_RESEND_MS;

  if (devMode()) {
    console.log(`[otp] ${formatUzPhone(phone)}: ${code} (lokal rejim — SMS yuborilmadi)`);
    return { ok: true, purpose, name: staff.name, resendAt, devCode: code };
  }
  if (!eskizConfigured()) {
    await Otp.updateOne({ _id: otp._id }, { $set: { usedAt: new Date() } });
    return { ok: false, error: "SMS xizmati sozlanmagan (Eskiz kalitlari yo‘q). Rahbarga murojaat qiling." };
  }
  try {
    const settings = await getSettings({ fresh: true });
    await sendSms(phone, renderOtpText(settings.sms.otpTemplate, code), settings.sms.sender);
  } catch (err) {
    await Otp.updateOne({ _id: otp._id }, { $set: { usedAt: new Date() } });
    if (!(err instanceof EskizError)) console.error("[otp]", err);
    const msg = err instanceof EskizError ? err.message : "Kutilmagan xato";
    return { ok: false, error: `SMS yuborilmadi: ${msg}` };
  }
  return { ok: true, purpose, name: staff.name, resendAt };
}

export type VerifyOtpResult = { ok: true; staff: StaffLean } | { ok: false; error: string };

/** Kodni tekshiradi: to'g'ri bo'lsa — kod ishlatilgan bo'ladi va xodim qaytariladi. */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  await connectDB();
  const now = new Date();
  // Urinish avval sanaladi (bir vaqtda ko'p urinib, chegarani aylanib o'tib bo'lmasin)
  const otp = await Otp.findOneAndUpdate(
    { phone, usedAt: null, expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { sort: { createdAt: -1 }, returnDocument: "after" },
  ).lean<{ _id: unknown; codeHash: string; attempts: number }>();
  if (!otp) return { ok: false, error: "Kod eskirgan yoki urinishlar tugagan — yangi kod so‘rang" };
  if (!otpMatches(phone, code, otp.codeHash)) {
    const left = OTP_MAX_ATTEMPTS - otp.attempts;
    return { ok: false, error: left > 0 ? `Kod noto‘g‘ri. Yana ${left} ta urinish qoldi` : "Kod noto‘g‘ri — yangi kod so‘rang" };
  }
  const used = await Otp.updateOne({ _id: otp._id, usedAt: null }, { $set: { usedAt: now } });
  if (used.modifiedCount !== 1) return { ok: false, error: "Kod allaqachon ishlatilgan — yangi kod so‘rang" };
  const staff = await findStaffByPhone(phone);
  if (!staff || staff.status === "disabled") return { ok: false, error: "Kirishingiz o‘chirilgan. Rahbarga murojaat qiling." };
  return { ok: true, staff };
}
