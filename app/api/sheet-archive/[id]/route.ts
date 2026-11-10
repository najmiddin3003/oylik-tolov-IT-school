import mongoose from "mongoose";
import { requireOwner } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { SheetArchive } from "@/lib/models";
import { toCSV } from "@/lib/sheet-archive-rules";

// Arxivdagi Google Sheets jadvalini yuklab olish (faqat rahbar): ?f=xlsx — asl fayl, ?f=csv — asosiy varaq qiymatlari.

function disposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request, ctx: RouteContext<"/api/sheet-archive/[id]">) {
  await requireOwner({ fresh: true });
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return new Response("Topilmadi", { status: 404 });
  const f = new URL(request.url).searchParams.get("f") === "xlsx" ? "xlsx" : "csv";
  await connectDB();
  const a = await SheetArchive.findById(id, f === "xlsx" ? { xlsx: 1, title: 1, month: 1 } : { rows: 1, title: 1, tab: 1, month: 1 }).lean();
  if (!a) return new Response("Topilmadi", { status: 404 });
  const base = `${a.title || "Google Sheets"} (${a.month})`;
  if (f === "xlsx") {
    if (!a.xlsx) return new Response("Asl fayl saqlanmagan", { status: 404 });
    // lean() — Buffer emas, BSON Binary qaytadi
    const raw = a.xlsx as unknown as Buffer | { value: () => Uint8Array };
    const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.value());
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": disposition(`${base}.xlsx`),
        "cache-control": "no-store",
      },
    });
  }
  // BOM — Excel'da o'zbekcha harflar to'g'ri ochilishi uchun
  const csv = `\ufeff${toCSV((a.rows ?? []) as unknown as string[][])}`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": disposition(`${base}${a.tab ? ` - ${a.tab}` : ""}.csv`),
      "cache-control": "no-store",
    },
  });
}
