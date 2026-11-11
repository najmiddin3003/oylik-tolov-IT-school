import "server-only";
// Ota-onalarga to'lov eslatmasi (Eskiz SMS): har oyning tanlangan sanasidan keyin, qarzi bor o'quvchining
// «Ota-ona telefoni»ga shablon bo'yicha SMS. Oyiga bir marta yoki to'laguncha har N kunda. Kunlik SMS bilan birga
// (kechqurun cron) ishlaydi. Har bir yuborish — SmsLog (kind: "parent").
import mongoose from "mongoose";
import { connectDB } from "./db";
import { eskizConfigured, EskizError, normalizeUzPhone, sendSms } from "./eskiz";
import { loadStudents, monthRows } from "./ledger";
import { Setting, SmsLog, Student } from "./models";
import { parentSmsAgain, parentSmsDue, renderParentSms } from "./parent-sms-rules";
import { smsCandidateMonths } from "./reminders";
import { getSettings, type AppSettings } from "./settings";
import { MONTH_NAMES, todayISO } from "./time";

const monthName = (m: string) => MONTH_NAMES[Number(m.slice(5, 7)) - 1] ?? m;
/** Bir ishga tushishda ko'pi bilan (qolganlari — keyingi kuni; takrorlanmaydi) */
const MAX_PER_RUN = 100;

export type ParentDebtor = { studentId: string; name: string; phone: string | null; months: string[]; debt: number };

/** Bugun eslatma oladigan o'quvchilar: joriy oy (sanasi kelgan bo'lsa) va oldingi 2 oy qarzi bilan. */
export async function parentDebtors(settings: AppSettings, today = todayISO()): Promise<ParentDebtor[]> {
  const p = settings.parentSms;
  const months = smsCandidateMonths(today, 2, p.startDay);
  const students = await loadStudents();
  const lists = await Promise.all(months.map((m) => monthRows(m, students)));
  const by = new Map<string, ParentDebtor>();
  months.forEach((m, i) => {
    for (const r of lists[i]) {
      if (r.status === "paid" || (r.status === "partial" && !p.includePartial) || r.debt <= 0) continue;
      const d = by.get(r.id) ?? { studentId: r.id, name: r.fullName, phone: null, months: [], debt: 0 };
      d.months.push(m);
      d.debt += r.debt;
      by.set(r.id, d);
    }
  });
  if (!by.size) return [];
  const phones = await Student.find({ _id: { $in: [...by.keys()] } }, { parentPhone: 1 }).lean();
  for (const s of phones) {
    const d = by.get(String(s._id));
    if (d) d.phone = normalizeUzPhone(s.parentPhone ?? "");
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Shu oyda har bir o'quvchiga oxirgi marta qachon yuborilgan ("YYYY-MM-DD"). */
async function lastSentThisMonth(ids: string[], today: string): Promise<Map<string, string>> {
  const rows = await SmsLog.aggregate<{ _id: mongoose.Types.ObjectId; day: string }>([
    {
      $match: {
        kind: "parent",
        status: "sent",
        trigger: { $ne: "test" },
        day: { $gte: `${today.slice(0, 7)}-01` },
        student: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    { $group: { _id: "$student", day: { $max: "$day" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.day]));
}

export type ParentSmsPreview = {
  due: boolean;
  debtors: number;
  noPhone: number;
  /** Bugun (yoki sana kelganda) yuboriladiganlar */
  toSend: number;
  sample: string;
};

/** Sozlamalar sahifasi uchun: hozir nechta ota-onaga boradi, nechtasida raqam yo'q va namuna matn. */
export async function parentSmsPreview(settings: AppSettings): Promise<ParentSmsPreview> {
  const today = todayISO();
  const list = await parentDebtors(settings, today);
  const withPhone = list.filter((d) => d.phone);
  const last = await lastSentThisMonth(
    withPhone.map((d) => d.studentId),
    today,
  );
  const toSend = withPhone.filter((d) => parentSmsAgain(today, settings.parentSms.repeatDays, last.get(d.studentId) ?? null)).length;
  const first = list[0];
  return {
    due: parentSmsDue(today, settings.parentSms.startDay),
    debtors: list.length,
    noPhone: list.length - withPhone.length,
    toSend,
    sample: renderParentSms(
      settings.parentSms.template,
      first ? { name: first.name, months: first.months, debt: first.debt, center: settings.centerName } : { name: "Aliyev Vali", months: [today.slice(0, 7)], debt: 300000, center: settings.centerName },
      monthName,
    ),
  };
}

export type ParentSmsOutcome = { status: "sent" | "skipped" | "failed"; message: string; sent: number; failed: number };

async function acquire(): Promise<boolean> {
  const now = new Date();
  const res = await Setting.updateOne(
    { _id: "main", $or: [{ parentSmsLockUntil: null }, { parentSmsLockUntil: { $lt: now } }] },
    { $set: { parentSmsLockUntil: new Date(now.getTime() + 5 * 60_000) } },
  );
  return res.modifiedCount === 1;
}

/** Ota-onalarga eslatma (kechki cron yoki o'z serveridagi rejalashtiruvchi). */
export async function runParentSms(trigger: "cron" | "auto"): Promise<ParentSmsOutcome> {
  await connectDB();
  const settings = await getSettings({ fresh: true });
  const none = (message: string): ParentSmsOutcome => ({ status: "skipped", message, sent: 0, failed: 0 });
  if (!settings.parentSms.enabled) return none("Ota-onalarga SMS o‘chirilgan");
  if (!eskizConfigured()) return none("Eskiz kalitlari kiritilmagan");
  const today = todayISO();
  if (!parentSmsDue(today, settings.parentSms.startDay)) return none(`Har oyning ${settings.parentSms.startDay}-sanasidan yuboriladi`);
  if (!(await acquire())) return none("Boshqa jarayon hozir yubormoqda");
  try {
    const list = (await parentDebtors(settings, today)).filter((d) => d.phone);
    const last = await lastSentThisMonth(
      list.map((d) => d.studentId),
      today,
    );
    const queue = list.filter((d) => parentSmsAgain(today, settings.parentSms.repeatDays, last.get(d.studentId) ?? null)).slice(0, MAX_PER_RUN);
    if (!queue.length) return none("Bugun yuboriladigan ota-ona yo‘q");
    let sent = 0;
    let failed = 0;
    let firstError = "";
    for (const d of queue) {
      const text = renderParentSms(settings.parentSms.template, { name: d.name, months: d.months, debt: d.debt, center: settings.centerName }, monthName);
      const base = { day: today, trigger, kind: "parent" as const, student: d.studentId, studentName: d.name, months: d.months, count: 1, phone: d.phone!, text };
      try {
        const providerId = await sendSms(d.phone!, text, settings.sms.sender);
        await SmsLog.create({ ...base, status: "sent", providerId });
        sent++;
      } catch (err) {
        const error = err instanceof EskizError ? err.message : `Kutilmagan xato: ${(err as Error).message}`;
        if (!(err instanceof EskizError)) console.error("[parent-sms]", err);
        await SmsLog.create({ ...base, status: "failed", error });
        failed++;
        firstError ||= error;
        // Kalit yoki shablon xatosi — qolganlariga ham bir xil bo'ladi, to'xtatamiz
        if (failed >= 3 && sent === 0) break;
      }
    }
    return {
      status: sent ? "sent" : "failed",
      message: `${sent} ta ota-onaga yuborildi${failed ? `, ${failed} tasi xato: ${firstError}` : ""}`,
      sent,
      failed,
    };
  } finally {
    await Setting.updateOne({ _id: "main" }, { $set: { parentSmsLockUntil: null } });
  }
}

/** Sinov: shablon bo'yicha bitta SMS ko'rsatilgan raqamga (birinchi qarzdor o'quvchi ma'lumoti bilan). */
export async function sendParentTestSms(phoneRaw: string): Promise<ParentSmsOutcome & { text?: string }> {
  await connectDB();
  const settings = await getSettings({ fresh: true });
  const fail = (message: string) => ({ status: "failed" as const, message, sent: 0, failed: 0 });
  if (!eskizConfigured()) return fail("Eskiz kalitlari kiritilmagan (Vercel: ESKIZ_EMAIL va ESKIZ_PASSWORD)");
  const phone = normalizeUzPhone(phoneRaw);
  if (!phone) return fail("Telefon raqam noto‘g‘ri");
  // Daqiqada bir marta (pullik SMS ko'payib ketmasligi uchun)
  if (await SmsLog.exists({ kind: "parent", trigger: "test", createdAt: { $gt: new Date(Date.now() - 60_000) } })) {
    return { status: "skipped", message: "Sinov SMS’ni daqiqada bir marta yuborish mumkin", sent: 0, failed: 0 };
  }
  const preview = await parentSmsPreview(settings);
  const text = preview.sample;
  const base = { day: todayISO(), trigger: "test" as const, kind: "parent" as const, months: [] as string[], count: 1, phone, text };
  try {
    const providerId = await sendSms(phone, text, settings.sms.sender);
    await SmsLog.create({ ...base, status: "sent", providerId });
    return { status: "sent", message: "Sinov SMS yuborildi", sent: 1, failed: 0, text };
  } catch (err) {
    const error = err instanceof EskizError ? err.message : `Kutilmagan xato: ${(err as Error).message}`;
    await SmsLog.create({ ...base, status: "failed", error });
    return fail(error);
  }
}
