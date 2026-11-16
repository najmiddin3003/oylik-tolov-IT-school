import "server-only";
// Davomat qilinmagan guruh o'qituvchisiga SMS: davomat ochilgandan (dars boshlanib 30 daqiqa) sozlamadagi daqiqa o'tib
// ham guruhda belgilanmagan o'quvchi bo'lsa — o'qituvchi (ro'yxatdan o'tgan, faol xodim) telefoniga bir marta SMS.
// Tez-tez chaqiriladi: /api/ping (cron-job.org har 5 daqiqada), /api/cron/attendance, saytda sahifa ochilganda
// (HeaderTools — `after`), o'z serverida — rejalashtiruvchi. Sozlamalarda «Hozir tekshirish» tugmasi ham bor.
import { attendanceDay, type AttendanceDayGroup } from "./attendance";
import {
  attendanceSmsAt,
  attendanceSmsBlocker,
  attendanceSmsDue,
  attendanceSmsShouldSend,
  attendanceSmsState,
  ATTENDANCE_SMS_MAX_TRIES,
  renderAttendanceSms,
  type AttendanceSmsLogs,
  type AttendanceSmsState,
} from "./attendance-sms-rules";
import { connectDB } from "./db";
import { eskizConfigured, EskizError, normalizeUzPhone, sendSms } from "./eskiz";
import { Setting, SmsLog, Staff } from "./models";
import { tashkentClock } from "./schedule";
import { getSettings } from "./settings";
import { nowMs } from "./time";

export type AttendanceSmsOutcome = { status: "sent" | "skipped" | "failed"; message: string; sent: number };

/** Jarayon ichida: tekshiruv daqiqada bir martadan ko'p emas (ping har 5 daqiqada, lekin bir nechta nusxa bo'lishi mumkin) */
const g = globalThis as unknown as { __attSmsAt?: number };

const refOf = (iso: string, key: string) => `${iso}|${key}`;

/** Bugungi davomat SMS yozuvlari guruh kaliti (ref) bo'yicha. */
async function todayLogs(iso: string) {
  const docs = await SmsLog.find({ kind: "attendance", day: iso }, { ref: 1, status: 1, error: 1, phone: 1, createdAt: 1 }).sort({ createdAt: 1 }).lean();
  const by = new Map<string, AttendanceSmsLogs & { lastError: string; sentAt: Date | null; phone: string }>();
  for (const d of docs) {
    const cur = by.get(d.ref ?? "") ?? { sent: false, failed: 0, skipped: false, lastError: "", sentAt: null, phone: "" };
    if (d.status === "sent") {
      cur.sent = true;
      cur.sentAt = (d as { createdAt?: Date }).createdAt ?? null;
      cur.phone = d.phone ?? "";
    } else if (d.status === "failed") {
      cur.failed++;
      cur.lastError = d.error ?? "";
    } else cur.skipped = true;
    by.set(d.ref ?? "", cur);
  }
  return by;
}

type TeacherInfo = { name: string; phone: string | null; status: string };

/** Guruh o'qituvchilari: ism, telefon (to'g'ri bo'lsa) va holati. */
async function teachersOf(groups: AttendanceDayGroup[]): Promise<Map<string, TeacherInfo>> {
  const ids = [...new Set(groups.map((gr) => gr.teacherId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map();
  const docs = await Staff.find({ _id: { $in: ids } }, { name: 1, phone: 1, status: 1 }).lean();
  return new Map(docs.map((d) => [String(d._id), { name: d.name, phone: normalizeUzPhone(d.phone ?? ""), status: d.status }]));
}

/** Tekshiruv ishlaganini yozib qo'yish (Sozlamalarda «Oxirgi tekshiruv» sifatida ko'rinadi). */
async function noteCheck(note: string) {
  await Setting.updateOne({ _id: "main" }, { $set: { attendanceSmsCheckedAt: new Date(), attendanceSmsCheckNote: note.slice(0, 300) } });
}

/**
 * Davomati kechikkan guruhlar o'qituvchisiga SMS. `force` — jarayon ichidagi «daqiqada bir marta» cheklovisiz
 * (Sozlamalardagi «Hozir tekshirish»).
 */
export async function runAttendanceSms(trigger: "cron" | "auto", opts: { force?: boolean } = {}): Promise<AttendanceSmsOutcome> {
  const none = (message: string): AttendanceSmsOutcome => ({ status: "skipped", message, sent: 0 });
  if (!opts.force && g.__attSmsAt && Date.now() - g.__attSmsAt < 50_000) return none("Yaqinda tekshirildi");
  g.__attSmsAt = Date.now();
  await connectDB();
  const settings = await getSettings(opts.force ? { fresh: true } : {});
  const cfg = settings.attendanceSms;
  if (!cfg.enabled) return none("Davomat SMS o‘chirilgan");
  const done = async (out: AttendanceSmsOutcome) => {
    await noteCheck(out.message);
    return out;
  };
  if (!eskizConfigured()) return done(none("Eskiz kalitlari kiritilmagan (ESKIZ_EMAIL, ESKIZ_PASSWORD)"));
  const clock = tashkentClock(nowMs());
  const groups = (await attendanceDay({ teacherId: null }, clock.iso)).filter(
    (gr) => gr.summary.missing > 0 && attendanceSmsDue(gr.start, gr.end, cfg.delayMinutes, clock.minutes),
  );
  if (!groups.length) return done(none("Davomati kechikkan guruh yo‘q"));

  // Bir vaqtda ikki jarayon bir xil SMS yubormasligi uchun qulf
  const now = new Date();
  const lock = await Setting.updateOne(
    { _id: "main", $or: [{ attendanceSmsLockUntil: null }, { attendanceSmsLockUntil: { $lt: now } }] },
    { $set: { attendanceSmsLockUntil: new Date(now.getTime() + 2 * 60_000) } },
  );
  if (lock.modifiedCount !== 1) return none("Boshqa jarayon yubormoqda");
  try {
    const [logs, teachers] = await Promise.all([todayLogs(clock.iso), teachersOf(groups)]);
    let sent = 0;
    let blocked = 0;
    let firstError = "";
    for (const gr of groups) {
      const ref = refOf(clock.iso, gr.key);
      const log = logs.get(ref);
      const base = { day: clock.iso, trigger, kind: "attendance" as const, ref, months: [] as string[], count: gr.summary.missing, studentName: `${gr.start} ${gr.course}` };
      // O'qituvchi: ro'yxatdan o'tgan (faol) xodim va telefoni bo'lsa
      const staff = gr.teacherId ? (teachers.get(gr.teacherId) ?? null) : null;
      const why = attendanceSmsBlocker(staff, Boolean(gr.teacherId));
      if (why || !staff?.phone) {
        blocked++;
        // Sabab jurnalga bir marta yoziladi; keyin bartaraf etilsa (masalan, o'qituvchi ro'yxatdan o'tsa) — SMS yuboriladi
        if (!log?.skipped && !log?.sent) await SmsLog.create({ ...base, status: "skipped", error: why ?? "Telefon raqami yo‘q", text: "" });
        continue;
      }
      if (!attendanceSmsShouldSend(log)) continue;
      const phone = staff.phone;
      const text = renderAttendanceSms(cfg.template, { group: gr.course, start: gr.start, missing: gr.summary.missing, teacher: staff.name });
      try {
        const providerId = await sendSms(phone, text, settings.sms.sender);
        await SmsLog.create({ ...base, phone, text, status: "sent", providerId });
        sent++;
      } catch (err) {
        const error = err instanceof EskizError ? err.message : `Kutilmagan xato: ${(err as Error).message}`;
        if (!(err instanceof EskizError)) console.error("[attendance-sms]", err);
        const tries = (log?.failed ?? 0) + 1;
        await SmsLog.create({ ...base, phone, text, status: "failed", error: `${error} (urinish ${tries}/${ATTENDANCE_SMS_MAX_TRIES})` });
        firstError ||= error;
      }
    }
    return done({
      status: firstError && !sent ? "failed" : sent ? "sent" : "skipped",
      message: `${sent} ta SMS yuborildi${blocked ? `; ${blocked} ta guruhga yuborib bo‘lmadi (o‘qituvchi)` : ""}${firstError ? `; xato: ${firstError}` : ""}`,
      sent,
    });
  } finally {
    await Setting.updateOne({ _id: "main" }, { $set: { attendanceSmsLockUntil: null } });
  }
}

export type AttendanceSmsGroupRow = {
  key: string;
  start: string;
  end: string;
  course: string;
  teacherName: string;
  /** O'qituvchi telefoni ("998…"); yo'q yoki noto'g'ri — null */
  phone: string | null;
  missing: number;
  total: number;
  /** SMS ketadigan vaqt ("14:40") */
  dueAt: string;
  state: AttendanceSmsState;
  /** Holat izohi: nega yuborilmaydi, xato matni yoki yuborilgan vaqti (ISO) */
  detail: string;
};

export type AttendanceSmsToday = {
  /** Tekshiruv oxirgi marta qachon ishlagan (ISO) va natijasi */
  checkedAt: string | null;
  checkNote: string;
  eskiz: boolean;
  groups: AttendanceSmsGroupRow[];
};

/** Sozlamalar → «Davomat SMS»: bugungi har bir guruh — SMS holati va yuborilmasa sababi; tekshiruv qachon ishlagani. */
export async function attendanceSmsToday(delayMinutes: number): Promise<AttendanceSmsToday> {
  await connectDB();
  const clock = tashkentClock(nowMs());
  const [groups, doc] = await Promise.all([
    attendanceDay({ teacherId: null }, clock.iso),
    Setting.findById("main", { attendanceSmsCheckedAt: 1, attendanceSmsCheckNote: 1 }).lean<{ attendanceSmsCheckedAt?: Date | null; attendanceSmsCheckNote?: string | null }>(),
  ]);
  const [logs, teachers] = await Promise.all([todayLogs(clock.iso), teachersOf(groups)]);
  return {
    checkedAt: doc?.attendanceSmsCheckedAt ? doc.attendanceSmsCheckedAt.toISOString() : null,
    checkNote: doc?.attendanceSmsCheckNote ?? "",
    eskiz: eskizConfigured(),
    groups: groups.map((gr) => {
      const log = logs.get(refOf(clock.iso, gr.key));
      const staff = gr.teacherId ? (teachers.get(gr.teacherId) ?? null) : null;
      const blocker = attendanceSmsBlocker(staff, Boolean(gr.teacherId));
      const state = attendanceSmsState({ missing: gr.summary.missing, start: gr.start, end: gr.end, delay: delayMinutes, minutes: clock.minutes, logs: log, blocker });
      const detail =
        state === "sent"
          ? (log?.sentAt?.toISOString() ?? "")
          : state === "blocked"
            ? (blocker ?? "")
            : state === "failed"
              ? (log?.lastError ?? "")
              : "";
      return {
        key: gr.key,
        start: gr.start,
        end: gr.end,
        course: gr.course,
        teacherName: staff?.name ?? gr.teacherName,
        phone: state === "sent" && log?.phone ? log.phone : (staff?.phone ?? null),
        missing: gr.summary.missing,
        total: gr.summary.total,
        dueAt: attendanceSmsAt(gr.start, delayMinutes),
        state,
        detail,
      };
    }),
  };
}
