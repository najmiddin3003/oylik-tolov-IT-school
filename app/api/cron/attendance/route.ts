import { runAttendanceSms } from "@/lib/attendance-sms";
import { cronAuthorized } from "@/lib/cron";

// Davomat qilinmagan guruhlar o'qituvchisiga SMS. Tez-tez chaqirilishi kerak (masalan, cron-job.org har 5 daqiqada):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://sayt.uz/api/cron/attendance
// /api/ping ham shu tekshiruvni ishga tushiradi — alohida sozlash shart emas.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runAttendanceSms("cron");
  return Response.json(result, { status: result.status === "failed" ? 502 : 200 });
}
