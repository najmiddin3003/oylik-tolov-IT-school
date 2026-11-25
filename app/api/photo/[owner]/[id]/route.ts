import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Photo } from "@/lib/models";

// O'quvchi yoki xodim rasmi (faqat tizimga kirganlarga). Manzildagi ?v= — yuklangan vaqt: rasm yangilansa manzil
// o'zgaradi, shuning uchun brauzer uzoq saqlab qo'yishi mumkin.
export async function GET(_request: Request, ctx: RouteContext<"/api/photo/[owner]/[id]">) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const { owner, id } = await ctx.params;
  if ((owner !== "student" && owner !== "staff") || !mongoose.isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDB();
  const p = await Photo.findOne({ owner, ref: id }, { data: 1, type: 1 }).lean();
  if (!p?.data) return new Response("Not found", { status: 404 });
  // lean() — Buffer emas, BSON Binary qaytadi
  const raw = p.data as unknown as Buffer | { value: () => Uint8Array };
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.value());
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": p.type || "image/jpeg", "cache-control": "private, max-age=31536000, immutable" },
  });
}
