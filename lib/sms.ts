// Qarzdorlar haqida kunlik SMS (Eskiz): har oyning tanlangan sanasidan (standart — 1-sana, ya'ni har kuni)
// kechqurun, hamma to'laguncha. Har bir xodimga o'z telefoniga: o'qituvchiga — o'z o'quvchilari soni, administratorga —
// jami, rahbarga — jami (N kunda bir marta). SMS'dan oldin Google Sheets'dagi yangi to'lovlar olib kelinadi.
import { connectDB } from "./db";
import { eskizConfigured, EskizError, normalizeUzPhone, sendSms } from "./eskiz";
import { loadStudents, monthRows, sortDebtors } from "./ledger";
import { Setting, SmsLog, Staff, SyncRun } from "./models";
import { debtSmsEveryDays, debtSmsScope, DEFAULT_SMS_START_DAY, ownerSmsDue, renderSmsText, smsCandidateMonths } from "./reminders";
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

/** Hozirgi holat bo'yicha qarzdorlar: oylar va har bir oydagi qarzdorlar (o'qituvchisi bilan). */
async function debtorsByMonth(today: string, startDay: number) {
  const months = smsCandidateMonths(today, 2, startDay);
  const students = await loadStudents();
  const lists = await Promise.all(months.map((m) => monthRows(m, students)));
  return months.map((m, i) => ({ month: m, debtors: sortDebtors(lists[i]).map((d) => ({ id: d.id, teacherId: d.teacherId })) }));
}

type DebtData = Awaited<ReturnType<typeof debtorsByMonth>>;

/** Bitta qabul qiluvchi uchun: qaysi oylar bo'yicha nechta (takrorlanmas) o'quvchi to'lamagan va SMS matni. */
function debtSmsFor(data: DebtData, template: string, teacherId: string | null) {
  const ids = new Set<string>();
  const withDebt: string[] = [];
  for (const { month, debtors } of data) {
    const mine = teacherId ? debtors.filter((d) => d.teacherId === teacherId) : debtors;
    if (mine.length) withDebt.push(month);
    for (const d of mine) ids.add(d.id);
  }
  const count = ids.size;
  return { months: withDebt, count, text: count ? renderSmsText(template, withDebt, count, monthName) : "" };
}

/** Markaz bo'yicha jami (sinov SMS va eski chaqiruvlar uchun). */
export async function buildDebtSms(template: string, today = todayISO(), startDay = DEFAULT_SMS_START_DAY) {
  return debtSmsFor(await debtorsByMonth(today, startDay), template, null);
}

type Delivery = {
  trigger: SmsTrigger;
  day: string;
  phone: string;
  sender: string;
  months: string[];
  count: number;
  text: string;
  staff?: { id: string; name: string } | null;
};

async function deliver(d: Delivery): Promise<SmsOutcome> {
  const base = { day: d.day, trigger: d.trigger, months: d.months, count: d.count, phone: d.phone, text: d.text, staff: d.staff?.id ?? null, staffName: d.staff?.name ?? "" };
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
    { day, trigger, status: "skipped", kind: { $nin: ["parent", "attendance"] } },
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

/** Qarzdorlar SMS'ini oladigan xodimlar: o'chirilmagan, telefoni to'g'ri; rolga qarab o'z soni yoki jami. */
async function debtSmsRecipients() {
  const docs = await Staff.find({ status: { $ne: "disabled" } }, { name: 1, phone: 1, role: 1, teaches: 1 }).sort({ role: 1, name: 1 }).lean();
  const seen = new Set<string>();
  const out: { id: string; name: string; role: string; teaches: boolean; phone: string }[] = [];
  for (const d of docs) {
    const phone = normalizeUzPhone(d.phone ?? "");
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ id: String(d._id), name: d.name ?? "", role: d.role, teaches: d.teaches === true, phone });
  }
  return out;
}

/**
 * Bugungi qarzdorlar SMS'i kimga ketadi (yubormaydi — faqat ko'rsatadi): har bir xodim, qaysi son va nega
 * yuborilmasligi (bugun yuborilgan, rahbar navbati emas, to'lamagan yo'q).
 */
export async function previewDailySms(today = todayISO()) {
  await connectDB();
  const settings = await getSettings({ fresh: true });
  const recipients = await debtSmsRecipients();
  const data = await debtorsByMonth(today, settings.sms.startDay);
  const sentToday = new Set((await SmsLog.distinct("phone", { ...SUMMARY, day: today, status: "sent", trigger: { $ne: "test" } })).map(String));
  const out = [];
  for (const r of recipients) {
    const own = debtSmsScope(r.role, r.teaches) === "own";
    const { count, text } = debtSmsFor(data, settings.sms.template, own ? r.id : null);
    let reason = "";
    if (sentToday.has(r.phone)) reason = "bugun allaqachon yuborilgan";
    else if (debtSmsEveryDays(r.role, r.teaches)) {
      const last = await SmsLog.findOne({ ...SUMMARY, phone: r.phone, status: "sent", trigger: { $ne: "test" } }, { day: 1 }).sort({ day: -1 }).lean();
      if (settings.sms.ownerEveryDays <= 0) reason = "rahbarga yuborilmaydi (sozlama)";
      else if (!ownerSmsDue(last?.day ?? null, today, settings.sms.ownerEveryDays)) reason = `navbati emas (har ${settings.sms.ownerEveryDays} kunda; oxirgisi ${last?.day})`;
    }
    if (!reason && !count) reason = "to‘lamagan o‘quvchi yo‘q";
    out.push({ name: r.name, role: r.role, teaches: r.teaches, phone: r.phone, scope: own ? "own" : "all", count, willSend: !reason, reason, text: reason ? "" : text });
  }
  return {
    settings: { enabled: settings.sms.enabled, startDay: settings.sms.startDay, ownerEveryDays: settings.sms.ownerEveryDays, sender: settings.sms.sender },
    recipients: out,
  };
}

const SUMMARY = { kind: { $nin: ["parent", "attendance"] as ("parent" | "attendance")[] } };

/**
 * Kunlik qarzdorlar SMS'i — har bir xodimga o'z telefoniga, kuniga bir marta:
 *  - o'qituvchiga — faqat o'z o'quvchilaridan to'lamaganlar soni;
 *  - administratorga — markaz bo'yicha jami;
 *  - rahbarga — jami, sozlamadagi kunlarda bir marta (standart — 3 kunda 1);
 *  - dars ham beradigan rahbarga — o'qituvchidek: har kuni, faqat o'z o'quvchilari soni.
 * Joriy oy sozlamadagi sanadan boshlab sanaladi. To'lamagan yo'q bo'lsa — yuborilmaydi.
 */
export async function runDailySms(trigger: "cron" | "auto"): Promise<SmsOutcome> {
  await connectDB();
  const settings = await getSettings({ fresh: true });
  if (!settings.sms.enabled) return { status: "skipped", message: "SMS eslatma o‘chirilgan" };
  if (!eskizConfigured()) return { status: "skipped", message: "Eskiz kalitlari kiritilmagan" };

  // Bir vaqtda ikki jarayon (masalan, cron qayta chaqirsa) ikki marta yubormasligi uchun qulf
  if (!(await acquireLock("smsLockUntil", 2 * 60_000))) {
    return { status: "skipped", message: "Boshqa jarayon hozir SMS yubormoqda" };
  }
  try {
    const today = todayISO();
    const recipients = await debtSmsRecipients();
    if (!recipients.length) return { status: "skipped", message: "Telefon raqami bor xodim yo‘q" };

    const sentToday = new Set((await SmsLog.distinct("phone", { ...SUMMARY, day: today, status: "sent", trigger: { $ne: "test" } })).map(String));
    const recentFail =
      trigger === "auto"
        ? new Set((await SmsLog.distinct("phone", { ...SUMMARY, day: today, status: "failed", createdAt: { $gt: new Date(Date.now() - 3600_000) } })).map(String))
        : new Set<string>();
    const pending = [];
    for (const r of recipients) {
      if (sentToday.has(r.phone) || recentFail.has(r.phone)) continue;
      // Dars bermaydigan rahbar — jami, N kunda bir marta; dars ham beradigan rahbar — o'qituvchidek, har kuni
      if (debtSmsEveryDays(r.role, r.teaches)) {
        const last = await SmsLog.findOne({ ...SUMMARY, phone: r.phone, status: "sent", trigger: { $ne: "test" } }, { day: 1 }).sort({ day: -1 }).lean();
        if (!ownerSmsDue(last?.day ?? null, today, settings.sms.ownerEveryDays)) continue;
      }
      pending.push(r);
    }
    if (!pending.length) return { status: "skipped", message: "Bugun hammaga yuborilgan (yoki navbati emas)" };

    await refreshFromSheets(settings, trigger);
    const startDay = settings.sms.startDay;
    const data = await debtorsByMonth(today, startDay);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const r of pending) {
      const { months, count, text } = debtSmsFor(data, settings.sms.template, debtSmsScope(r.role, r.teaches) === "own" ? r.id : null);
      if (!count) continue;
      const res = await deliver({ trigger, day: today, phone: r.phone, sender: settings.sms.sender, months, count, text, staff: { id: r.id, name: r.name } });
      if (res.status === "sent") sent++;
      else {
        failed++;
        errors.push(`${r.name}: ${res.message}`);
      }
    }
    if (!sent && !failed) {
      const reason =
        Number(today.slice(8, 10)) < startDay ? `To‘lamaganlar yo‘q — joriy oy ${startDay}-sanadan sanaladi` : "Hamma to‘lagan — SMS kerak emas";
      await logSkip(today, trigger, reason);
      return { status: "skipped", message: reason };
    }
    if (!sent) return { status: "failed", message: errors.join("; ") };
    return { status: "sent", message: `${sent} ta xodimga SMS yuborildi${failed ? `, ${failed} tasida xato: ${errors.join("; ")}` : ""}` };
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

/** Sozlamalardan sinov SMS (hozirgi holat bo'yicha, markaz jami) — rahbarning o'z raqamiga. Daqiqada bir martadan ko'p emas. */
export async function sendTestSms(toPhone?: string | null): Promise<SmsOutcome> {
  await connectDB();
  const settings = await getSettings({ fresh: true });
  if (!eskizConfigured()) {
    return { status: "failed", message: "Eskiz kalitlari kiritilmagan (Vercel: ESKIZ_EMAIL va ESKIZ_PASSWORD)" };
  }
  const phone = normalizeUzPhone(toPhone || settings.sms.phone);
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
