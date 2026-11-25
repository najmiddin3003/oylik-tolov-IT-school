import "server-only";
// Rasmni saqlash / o'chirish: rasm «photos» to'plamida, o'quvchi yoki xodimda — faqat yuklangan vaqti (photoAt).
import { connectDB } from "./db";
import { Photo, Staff, Student } from "./models";
import type { PhotoInput } from "./photo-rules";

export async function storePhoto(owner: "student" | "staff", id: string, p: PhotoInput): Promise<void> {
  if (p.kind !== "set" && p.kind !== "remove") return;
  await connectDB();
  const M = owner === "student" ? Student : Staff;
  if (p.kind === "remove") {
    await Photo.deleteOne({ owner, ref: id });
    await (M as typeof Student).updateOne({ _id: id }, { $set: { photoAt: null } });
    return;
  }
  const now = new Date();
  await Photo.updateOne({ owner, ref: id }, { $set: { type: p.type, data: Buffer.from(p.base64, "base64") } }, { upsert: true });
  await (M as typeof Student).updateOne({ _id: id }, { $set: { photoAt: now } });
}
