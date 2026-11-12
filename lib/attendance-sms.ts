import "server-only";
// Davomat qilinmagan guruh o'qituvchisiga SMS: davomat ochilgandan (dars boshlanib 30 daqiqa) sozlamadagi daqiqa o'tib
// ham guruhda belgilanmagan o'quvchi bo'lsa — o'qituvchi (ro'yxatdan o'tgan, faol xodim) telefoniga bir marta SMS.
// Tez-tez chaqiriladi (/api/ping — cron-job.org har 5 daqiqada; /api/cron/attendance; o'z serverida — rejalashtiruvchi).
import { attendanceDay } from "./attendance";
import { attendanceSmsDue, renderAttendanceSms } from "./attendance-sms-rules";
import { connectDB } from "./db";
import { eskizConfigured, EskizError, normalizeUzPhone, sendSms } from "./eskiz";
import { Setting, SmsLog, Staff } from "./models";
import { tashkentClock } from "./schedule";
import { getSettings } from "./settings";
import { nowMs } from "./time";

export type AttendanceSmsOutcome = { status: "sent" | "skipped" | "failed"; message: string; sent: number };

/** Jarayon ichida: tekshiruv daqiqada bir martadan ko'p emas (ping har 5 daqiqada, lekin bir nechta nusxa bo'lishi mumkin) */
const g = globalThis as unknown as { __attSmsAt?: number };

export async function runAttendanceSms(trigger: "cron" | "auto"): Promise<AttendanceSmsOutcome> {
  const none = (message: string): AttendanceSmsOutcome => ({ status: "skipped", message, sent: 0 });
  if (g.__attSmsAt && Date.now() - g.__attSmsAt < 50_000) return none("Yaqinda tekshirildi");
  g.__attSmsAt = Date.now();
  await connectDB();
  const settings = await getSettings();
  const cfg = settings.attendanceSms;
  if (!cfg.enabled) return none("Davomat SMS o‘chirilgan");
  if (!eskizConfigured()) return none("Eskiz kalitlari kiritilmagan");
  const clock = tashkentClock(nowMs());
  const groups = (await attendanceDay({ teacherId: null }, clock.iso)).filter(
    (gr) => gr.summary.missing > 0 && attendanceSmsDue(gr.start, gr.end, cfg.delayMinutes, clock.minutes),
  );
  if (!groups.length) return none("Davomati kechikkan guruh yo‘q");

  // Bir vaqtda ikki jarayon bir xil SMS yubormasligi uchun qulf
  const now = new Date();
  const lock = await Setting.updateOne(
    { _id: "main", $or: [{ attendanceSmsLockUntil: null }, { attendanceSmsLockUntil: { $lt: now } }] },
    { $set: { attendanceSmsLockUntil: new Date(now.getTime() + 2 * 60_000) } },
  );
  if (lock.modifiedCount !== 1) return none("Boshqa jarayon yubormoqda");
  try {
    let sent = 0;
    let firstError = "";
    for (const gr of groups) {
      const ref = `${clock.iso}|${gr.key}`;
      if (await SmsLog.exists({ kind: "attendance", ref, status: { $in: ["sent", "skipped", "failed"] } })) continue;
      const base = { day: clock.iso, trigger, kind: "attendance" as const, ref, months: [] as string[], count: gr.summary.missing, studentName: `${gr.start} ${gr.course}` };
      // O'qituvchi: ro'yxatdan o'tgan (faol) xodim va telefoni bo'lsa
      const staff = gr.teacherId ? await Staff.findById(gr.teacherId, { name: 1, phone: 1, status: 1 }).lean() : null;
      const phone = staff?.status === "active" ? normalizeUzPhone(staff.phone ?? "") : null;
      if (!phone) {
        const why = !gr.teacherId ? "O‘qituvchi biriktirilmagan" : staff?.status !== "active" ? "O‘qituvchi ro‘yxatdan o‘tmagan" : "Telefon raqami yo‘q";
        await SmsLog.create({ ...base, status: "skipped", error: why, text: "" });
        continue;
      }
      const text = renderAttendanceSms(cfg.template, { group: gr.course, start: gr.start, missing: gr.summary.missing, teacher: staff!.name });
      try {
        const providerId = await sendSms(phone, text, settings.sms.sender);
        await SmsLog.create({ ...base, phone, text, status: "sent", providerId });
        sent++;
      } catch (err) {
        const error = err instanceof EskizError ? err.message : `Kutilmagan xato: ${(err as Error).message}`;
        if (!(err instanceof EskizError)) console.error("[attendance-sms]", err);
        await SmsLog.create({ ...base, phone, text, status: "failed", error });
        firstError ||= error;
      }
    }
    return { status: firstError && !sent ? "failed" : sent ? "sent" : "skipped", message: `${sent} ta SMS yuborildi${firstError ? `; xato: ${firstError}` : ""}`, sent };
  } finally {
    await Setting.updateOne({ _id: "main" }, { $set: { attendanceSmsLockUntil: null } });
  }
}
