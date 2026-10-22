import "server-only";
// Xodimlar bilan ishlash (baza). Ruxsat tekshiruvi chaqiruvchida (lib/auth.ts, server action'lar).
import mongoose from "mongoose";
import { cache } from "react";
import { connectDB } from "./db";
import type { AmountChange, PercentChange } from "./fees";
import { Staff } from "./models";
import { fingerprint } from "./passwords";
import type { Role } from "./session";
import { ownerPhone, TEACHING_FILTER, type ShareBase, type StaffStatus } from "./staff-rules";

export type StaffLean = {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  role: Role;
  status: StaffStatus;
  passwordHash?: string | null;
  shareHistory?: { from?: string | null; percent?: number | null }[] | null;
  shareBase?: ShareBase | null;
  /** Belgilangan oylik tarixi (administrator) */
  salaryHistory?: { from?: string | null; amount?: number | null }[] | null;
  /** Rahbar o'zi ham dars beradi */
  teaches?: boolean | null;
  activatedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  /** Shaxsiy sozlamalar (maydon yo'q — standart) */
  prefs?: { syncAlert?: boolean | null } | null;
};

/** Brauzerga uzatiladigan ko'rinish (parol izisiz). */
export type StaffView = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  status: StaffStatus;
  shareHistory: PercentChange[];
  shareBase: ShareBase;
  salaryHistory: AmountChange[];
  /** Rahbar o'zi ham dars beradi (o'qituvchilar ro'yxatlarida ko'rinadi) */
  teaches: boolean;
  activatedAt: string | null;
  lastLoginAt: string | null;
};

export function shareHistoryOf(s: Pick<StaffLean, "shareHistory">): PercentChange[] {
  return (s.shareHistory ?? [])
    .filter((h) => h && typeof h.from === "string" && typeof h.percent === "number")
    .map((h) => ({ from: h.from!, percent: h.percent! }));
}

export function salaryHistoryOf(s: Pick<StaffLean, "salaryHistory">): AmountChange[] {
  return (s.salaryHistory ?? [])
    .filter((h) => h && typeof h.from === "string" && typeof h.amount === "number")
    .map((h) => ({ from: h.from!, amount: h.amount! }));
}

export function toStaffView(s: StaffLean): StaffView {
  return {
    id: String(s._id),
    name: s.name,
    phone: s.phone,
    role: s.role,
    status: s.status,
    shareHistory: shareHistoryOf(s),
    shareBase: s.shareBase === "center" ? "center" : "students",
    salaryHistory: salaryHistoryOf(s),
    teaches: s.role === "owner" && s.teaches === true,
    activatedAt: s.activatedAt ? s.activatedAt.toISOString() : null,
    lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null,
  };
}

/** Xodim sessiyasining barmoq izi: parol almashsa — eski sessiyalar bekor bo'ladi. */
export function staffPasswordVersion(staffId: string, passwordHash: string): string {
  return fingerprint(`staff:${staffId}:${passwordHash}`);
}

/** Sessiya tekshiruvi uchun (bitta so'rov ichida bir marta o'qiladi). */
export const getStaffById = cache(async (id: string): Promise<StaffLean | null> => {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return Staff.findById(id).lean<StaffLean>();
});

export async function findStaffByPhone(phone: string): Promise<StaffLean | null> {
  await connectDB();
  return Staff.findOne({ phone }).lean<StaffLean>();
}

/**
 * Rahbarning birinchi kirishi: rahbar profili hali umuman yo'q bo'lsa va kiritilgan raqam rahbarniki (OWNER_PHONE)
 * bo'lsa — profil «ro'yxatdan o'tmagan» holatda yaratiladi, keyin odatdagidek SMS kod bilan o'zi parol qo'yadi.
 * Rahbar profili bor bo'lsa (yoki raqam boshqa xodimniki) — hech narsa qilinmaydi. Yaratilgan bo'lsa — true.
 */
export async function ensureOwnerInvite(phone: string): Promise<boolean> {
  if (phone !== ownerPhone(process.env.OWNER_PHONE)) return false;
  await connectDB();
  if (await Staff.exists({ $or: [{ role: "owner" }, { phone }] })) return false;
  try {
    await Staff.create({ name: "Rahbar", phone, role: "owner", status: "invited", shareBase: "center" });
    return true;
  } catch (err) {
    // Bir vaqtda ikki so'rov kelgan bo'lsa — birinchisi yaratgan (telefon noyob)
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
}

/** Qaysi rollarda faol xodim profili bor (eski umumiy parollarni o'chirish uchun). */
export const activeStaffRoles = cache(async (): Promise<Set<Role>> => {
  await connectDB();
  const roles = (await Staff.distinct("role", { status: "active" })) as Role[];
  return new Set(roles);
});

export async function listStaff(): Promise<StaffLean[]> {
  await connectDB();
  return Staff.find({}).sort({ role: 1, name: 1 }).lean<StaffLean[]>();
}

/**
 * O'qituvchilar ro'yxati (o'quvchiga va kursga biriktirish uchun): faollar va hali ro'yxatdan o'tmaganlar,
 * dars ham beradigan rahbar bilan birga.
 */
export const listTeachers = cache(async (): Promise<{ id: string; name: string; status: StaffStatus }[]> => {
  await connectDB();
  const docs = await Staff.find({ ...TEACHING_FILTER, status: { $ne: "disabled" } }, { name: 1, status: 1 }).sort({ name: 1 }).lean<StaffLean[]>();
  return docs.map((d) => ({ id: String(d._id), name: d.name, status: d.status }));
});

/** O'qituvchilar nomi (id -> ism), o'chirilganlari ham (eski yozuvlarda ko'rsatish uchun). */
export const teacherNames = cache(async (): Promise<Map<string, string>> => {
  await connectDB();
  const docs = await Staff.find(TEACHING_FILTER, { name: 1 }).lean<StaffLean[]>();
  return new Map(docs.map((d) => [String(d._id), d.name]));
});
