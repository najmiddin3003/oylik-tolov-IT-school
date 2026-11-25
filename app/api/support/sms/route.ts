import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { SmsLog } from "@/lib/models";
import { supportAuthorized, supportEnabled } from "@/lib/support";
import { todayISO } from "@/lib/time";

// Texnik yordam: SMS jurnali (faqat o'qiydi — hech narsa yubormaydi).
//   /api/support/sms?day=YYYY-MM-DD  (standart — bugun, Toshkent)  &kind=summary|parent|attendance|all (standart — summary)
const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  await connection();
  if (!supportEnabled()) return new Response("Not found", { status: 404 });
  if (!supportAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const params = new URL(request.url).searchParams;
  const dayRaw = params.get("day") ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) ? dayRaw : todayISO();
  const kind = params.get("kind") ?? "summary";
  await connectDB();
  const filter =
    kind === "all" ? { day } : kind === "summary" ? { day, kind: { $nin: ["parent", "attendance"] as ("parent" | "attendance")[] } } : { day, kind: kind as "parent" | "attendance" };
  const logs = await SmsLog.find(filter).sort({ createdAt: 1 }).limit(300).lean();
  return Response.json(
    {
      day,
      kind,
      count: logs.length,
      logs: logs.map((l) => ({
        at: (l as { createdAt?: Date }).createdAt?.toISOString() ?? "",
        kind: l.kind ?? "summary",
        trigger: l.trigger,
        status: l.status,
        staffName: l.staffName ?? "",
        studentName: l.studentName ?? "",
        phone: l.phone ?? "",
        months: l.months ?? [],
        count: l.count ?? 0,
        text: l.text ?? "",
        error: l.error ?? "",
      })),
    },
    { headers: NO_STORE },
  );
}
