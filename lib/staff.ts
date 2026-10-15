import "server-only";
// Xodimlar bilan ishlash (baza). Ruxsat tekshiruvi chaqiruvchida (lib/auth.ts, server action'lar).
import mongoose from "mongoose";
import { cache } from "react";
import { connectDB } from "./db";
import type { PercentChange } from "./fees";
import { Staff } from "./models";
import { fingerprint } from "./passwords";
import type { Role } from "./session";
import type { ShareBase, StaffStatus } from "./staff-rules";

export type StaffLean = {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  role: Role;
  status: StaffStatus;
  passwordHash?: string | null;
  shareHistory?: { from?: string | null; percent?: number | null }[] | null;
  shareBase?: ShareBase | null;
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
  activatedAt: string | null;
  lastLoginAt: string | null;
};

export function shareHistoryOf(s: Pick<StaffLean, "shareHistory">): PercentChange[] {
  return (s.shareHistory ?? [])
    .filter((h) => h && typeof h.from === "string" && typeof h.percent === "number")
    .map((h) => ({ from: h.from!, percent: h.percent! }));
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

/** O'qituvchilar ro'yxati (o'quvchiga biriktirish uchun): faollar va hali ro'yxatdan o'tmaganlar. */
export const listTeachers = cache(async (): Promise<{ id: string; name: string; status: StaffStatus }[]> => {
  await connectDB();
  const docs = await Staff.find({ role: "teacher", status: { $ne: "disabled" } }, { name: 1, status: 1 }).sort({ name: 1 }).lean<StaffLean[]>();
  return docs.map((d) => ({ id: String(d._id), name: d.name, status: d.status }));
});

/** O'qituvchilar nomi (id -> ism), o'chirilganlari ham (eski yozuvlarda ko'rsatish uchun). */
export const teacherNames = cache(async (): Promise<Map<string, string>> => {
  await connectDB();
  const docs = await Staff.find({ role: "teacher" }, { name: 1 }).lean<StaffLean[]>();
  return new Map(docs.map((d) => [String(d._id), d.name]));
});
