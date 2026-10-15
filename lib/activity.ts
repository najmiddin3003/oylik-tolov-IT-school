import "server-only";
// Faoliyat jurnali: har bir amal (kirish, to'lov, o'quvchi, sozlama...) yoziladi. Har kim faqat o'z amallarini ko'radi.
import mongoose from "mongoose";
import { headers } from "next/headers";
import { deviceLabel } from "./activity-rules";
import { connectDB } from "./db";
import { Activity } from "./models";
import type { Role } from "./session";

export type Actor = { role: Role; staffId: string | null };

/**
 * Amalni jurnalga yozish. Hech qachon xato tashlamaydi — jurnal yozilmasa ham asosiy amal bajarilgan bo'ladi.
 * `text` — odam o'qiydigan qisqa tavsif ("Aliyev Vali: Oktabr uchun 300 000 so'm, naqd").
 */
export async function logActivity(actor: Actor, action: string, text: string): Promise<void> {
  try {
    let ip = "";
    let device = "";
    try {
      const h = await headers();
      ip = (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "").slice(0, 64);
      device = deviceLabel(h.get("user-agent"));
    } catch {
      // so'rovdan tashqarida (cron) — manzilsiz
    }
    await connectDB();
    await Activity.create({
      staff: actor.staffId && mongoose.isValidObjectId(actor.staffId) ? actor.staffId : null,
      role: actor.role,
      action,
      text: text.slice(0, 500),
      ip,
      device,
      at: new Date(),
    });
  } catch (err) {
    console.error("[activity]", err);
  }
}

export type ActivityRow = { id: string; action: string; text: string; ip: string; device: string; at: string };

/** Joriy foydalanuvchining amallari (eski umumiy parol bilan kirilganda — shu rolning profilsiz amallari). */
export async function listMyActivity(actor: Actor, opts: { group?: string; before?: Date; limit?: number } = {}): Promise<ActivityRow[]> {
  await connectDB();
  const filter: Record<string, unknown> = actor.staffId ? { staff: actor.staffId } : { staff: null, role: actor.role };
  if (opts.group === "auth") filter.action = { $in: ["login", "logout", "auth.register", "auth.reset", "auth.password"] };
  else if (opts.group) filter.action = { $regex: `^${opts.group.replace(/[^a-z]/g, "")}\\.` };
  if (opts.before) filter.at = { $lt: opts.before };
  const docs = await Activity.find(filter).sort({ at: -1 }).limit(opts.limit ?? 50).lean();
  return docs.map((d) => ({
    id: String(d._id),
    action: d.action,
    text: d.text ?? "",
    ip: d.ip ?? "",
    device: d.device ?? "",
    at: d.at.toISOString(),
  }));
}
