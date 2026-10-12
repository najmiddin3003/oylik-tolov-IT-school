// Qarzdorlar haqida kunlik SMS (Eskiz): har oyning tanlangan sanasidan (standart — 1-sana, ya'ni har kuni)
// kechqurun, hamma to'laguncha kuniga bir marta. SMS'dan oldin Google Sheets'dagi yangi to'lovlar olib kelinadi.
import { connectDB } from "./db";
import { eskizConfigured, EskizError, normalizeUzPhone, sendSms } from "./eskiz";
import { loadStudents, monthRows, sortDebtors } from "./ledger";
import { Setting, SmsLog, SyncRun } from "./models";
import { DEFAULT_SMS_START_DAY, renderSmsText, smsCandidateMonths } from "./reminders";
import { getSettings, type AppSettings } from "./settings";
import { runSync, type SyncTrigger } from "./sync";
import { MONTH_NAMES, todayISO } from "./time";

export type SmsTrigger = "cron" | "auto" | "test";
export type SmsOutcome = { status: "sent" | "skipped" | "failed"; message: string; text?: string };

const monthName = (m: string) => MONTH_NAMES[Number(m.slice(5, 7)) - 1] ?? m;

/** Kunlik SMS vaqti (Toshkent bo'yicha soat) — o'z serverida ishlaganda. Vercel'da vercel.json dagi cron. */
export function smsHour(): number {
  const h = Number(process.env.SMS_HOUR ?? 20);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 20;
}

/** Hozirgi holat bo'yicha: qaysi oylar uchun nechta (takrorlanmas) o'quvchi to'lamagan va SMS matni. */
export async function buildDebtSms(template: string, today = todayISO(), startDay = DEFAULT_SMS_START_DAY) {
  const months = smsCandidateMonths(today, 2, startDay);
  const students = await loadStudents();
  const lists = await Promise.all(months.map((m) => monthRows(m, students)));
  const ids = new Set<string>();
  const withDebt: string[] = [];
  months.forEach((m, i) => {
    const debtors = sortDebtors(lists[i]);
    if (debtors.length) withDebt.push(m);
    for (const d of debtors) ids.add(d.id);
  });
  const count = ids.size;
  return { months: withDebt, count, text: count ? renderSmsText(template, withDebt, count, monthName) : "" };
}

type Delivery = { trigger: SmsTrigger; day: string; phone: string; sender: string; months: string[]; count: number; text: string };

async function deliver(d: Delivery): Promise<SmsOutcome> {
  const base = { day: d.day, trigger: d.trigger, months: d.months, count: d.count, phone: d.phone, text: d.text };
  try {
    const providerId = await sendSms(d.phone, d.text, d.sender);
    await SmsLog.create({ ...base, status: "sent", providerId });
    return { status: "sent", message: "SMS yuborildi", text: d.text };
  } catch (err) {
    const error = err instanceof EskizError ? err.message : `Kutilmagan xato: ${(err as Error).message}`;
    if (!(err instanceof EskizError)) console.error("[sms]", err);
    await SmsLog.create({ ...base, status: "failed", error });
    return { status: "failed", message: error, text: d.text };
  }
}

async function logSkip(day: string, trigger: SmsTrigger, reason: string) {
  // Kuniga bitta "yuborilmadi" yozuvi (jurnal to'lib ketmasligi uchun)
  await SmsLog.updateOne(
    { day, trigger, status: "skipped" },
    { $set: { error: reason }, $setOnInsert: { day, trigger, status: "skipped", months: [], count: 0 } },
    { upsert: true },
  );
}

/**
 * SMS'dan oldin Google Sheets'dagi so'nggi to'lovlarni olib kelish (avtomatik qo'shish yoqilgan bo'lsa):
 * kun davomida jadvalga yozilgan to'lovlar ham hisobga olinsin. Yarim soat ichida tekshiruv bo'lgan bo'lsa — shart emas.
 */
async function refreshFromSheets(settings: AppSettings, trigger: SyncTrigger): Promise<void> {
  if (!settings.sheetUrl || !settings.autoImport) return;
  if (await SyncRun.exists({ ok: true, startedAt: { $gt: new Date(Date.now() - 30 * 60_000) } })) return;
  try {
    await runSync(trigger);
  } catch (err) {
    console.error("[sms] Sheets tekshiruvi:", err);
  }
}

/** Kunlik SMS: bugun yuborilmagan bo'lsa va to'lamaganlar bo'lsa — yuboradi. */
export async function runDailySms(trigger: "cron" | "auto"): Promise<SmsOutcome> {
  await connectDB();
  const settings = await getSettings({ fresh: true });
  if (!settings.sms.enabled) return { status: "skipped", message: "SMS eslatma o‘chirilgan" };
  if (!eskizConfigured()) return { status: "skipped", message: "Eskiz kalitlari kiritilmagan" };
  const phone = normalizeUzPhone(settings.sms.phone);
  if (!phone) return { status: "skipped", message: "Telefon raqam noto‘g‘ri" };

  // Bir vaqtda ikki jarayon (masalan, cron qayta chaqirsa) ikki marta yubormasligi uchun qulf
  if (!(await acquireLock("smsLockUntil", 2 * 60_000))) {
    return { status: "skipped", message: "Boshqa jarayon hozir SMS yubormoqda" };
  }
  try {
    const today = todayISO();
    if (await SmsLog.exists({ day: today, status: "sent", trigger: { $ne: "test" } })) {
      return { status: "skipped", message: "Bugun SMS allaqachon yuborilgan" };
    }
    if (
      trigger === "auto" &&
      (await SmsLog.exists({ day: today, status: "failed", createdAt: { $gt: new Date(Date.now() - 3600_000) } }))
    ) {
      return { status: "skipped", message: "Yaqinda xato bo‘ldi — bir soatdan keyin qayta uriniladi" };
    }

    await refreshFromSheets(settings, trigger);
    const startDay = settings.sms.startDay;
    const { months, count, text } = await buildDebtSms(settings.sms.template, today, startDay);
    if (!count) {
      const reason =
        Number(today.slice(8, 10)) < startDay
          ? `To‘lamaganlar yo‘q — joriy oy ${startDay}-sanadan sanaladi`
          : "Hamma to‘lagan — SMS kerak emas";
      await logSkip(today, trigger, reason);
      return { status: "skipped", message: reason };
    }
    return await deliver({ trigger, day: today, phone, sender: settings.sms.sender, months, count, text });
  } finally {
    await Setting.updateOne({ _id: "main" }, { $set: { smsLockUntil: null } });
  }
}

/** Sozlamalar hujjatidagi vaqtinchalik qulf (atomik): olinsa — true. */
async function acquireLock(field: "smsLockUntil" | "smsTestLockUntil", ms: number): Promise<boolean> {
  const now = new Date();
  const res = await Setting.updateOne(
    { _id: "main", $or: [{ [field]: null }, { [field]: { $lt: now } }] },
    { $set: { [field]: new Date(now.getTime() + ms) } },
  );
  return res.modifiedCount === 1;
}

/** Sozlamalardan sinov SMS (hozirgi holat bo'yicha). Daqiqada bir martadan ko'p emas. */
export async function sendTestSms(): Promise<SmsOutcome> {
  await connectDB();
  const settings = await getSettings({ fresh: true });
  if (!eskizConfigured()) {
    return { status: "failed", message: "Eskiz kalitlari kiritilmagan (Vercel: ESKIZ_EMAIL va ESKIZ_PASSWORD)" };
  }
  const phone = normalizeUzPhone(settings.sms.phone);
  if (!phone) return { status: "failed", message: "Telefon raqam noto‘g‘ri" };
  // Qulf 1 daqiqa turadi (bo'shatilmaydi) — tez-tez bosilsa ham pullik SMS ko'payib ketmaydi
  if (!(await acquireLock("smsTestLockUntil", 60_000))) {
    return { status: "skipped", message: "Sinov SMS’ni daqiqada bir marta yuborish mumkin" };
  }
  await refreshFromSheets(settings, "manual");
  const today = todayISO();
  const built = await buildDebtSms(settings.sms.template, today, settings.sms.startDay);
  const months = built.count ? built.months : [today.slice(0, 7)];
  const text = built.count ? built.text : renderSmsText(settings.sms.template, months, 0, monthName);
  return deliver({ trigger: "test", day: today, phone, sender: settings.sms.sender, months, count: built.count, text });
}
