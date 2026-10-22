// Google Sheets bilan saytdagi to'lovlarni solishtirish va natijani bazaga yozish.
import { compareRecords, parseSheet, type MismatchResult, type SheetWindow } from "./compare";
import { importFromRun } from "./importer";
import { LIVE } from "./ledger";
import { Payment, Setting, Student, SyncRun } from "./models";
import { getSettings } from "./settings";
import { fetchSheetRows, SheetError } from "./sheets";
import { dateToISO, isoToDate, lastScheduledTime, shiftMonth, todayISO } from "./time";

export type SyncTrigger = "auto" | "cron" | "manual";

const LOCK_MS = 5 * 60_000;
const KEEP_RUNS = 60;
const DAY_MS = 24 * 3600_000;

async function acquireLock(): Promise<boolean> {
  const now = new Date();
  const res = await Setting.updateOne(
    { _id: "main", $or: [{ syncLockedUntil: null }, { syncLockedUntil: { $lt: now } }] },
    { $set: { syncLockedUntil: new Date(now.getTime() + LOCK_MS) } },
  );
  return res.modifiedCount === 1;
}

async function releaseLock() {
  await Setting.updateOne({ _id: "main" }, { $set: { syncLockedUntil: null } });
}

/** Jadval qamragan davrdagi saytdagi to'lovlar. */
async function loadSitePayments(window: SheetWindow | null) {
  if (!window) return [];
  // Arxivlangan to'lovlar solishtirishda ham hisobga olinmaydi
  const filter =
    window.basis === "month"
      ? { ...LIVE, month: { $gte: window.monthFrom, $lte: window.monthTo } }
      : {
          ...LIVE,
          paidAt: {
            $gte: isoToDate(window.dateFrom)!,
            $lt: new Date(isoToDate(window.dateTo)!.getTime() + DAY_MS),
          },
        };
  const docs = await Payment.find(filter, { student: 1, month: 1, paidAt: 1, amount: 1 }).lean();
  return docs.map((p) => ({
    studentId: String(p.student),
    month: p.month,
    paidDate: dateToISO(p.paidAt),
    amount: p.amount,
  }));
}

/** O'quvchining shu oyga tegishli (oy maydoni yoki to'langan sanasi bo'yicha) hisobdagi to'lovi bormi. */
async function hasOtherPaymentInMonth(studentId: string, month: string): Promise<boolean> {
  const from = isoToDate(`${month}-01`);
  const to = isoToDate(`${shiftMonth(month, 1)}-01`);
  if (!from || !to) return false;
  const found = await Payment.exists({ ...LIVE, student: studentId, $or: [{ month }, { paidAt: { $gte: from, $lt: to } }] });
  return Boolean(found);
}

export type SyncOutcome = {
  id: string;
  ok: boolean;
  error: string;
  /** Hal qilinmay qolgan farqlar */
  mismatches: number;
  /** Sheets'dan avtomatik qo'shilgan to'lov qatorlari */
  imported: number;
};

/**
 * Tekshiruvni hozir ishga tushiradi. Boshqa tekshiruv ketayotgan bo'lsa — null qaytaradi.
 * Avtomatik qo'shish yoqilgan bo'lsa — «Saytda yo'q» to'lovlar (o'quvchisi saytda bor) darhol saytga yoziladi.
 */
export async function runSync(trigger: SyncTrigger): Promise<SyncOutcome | null> {
  const settings = await getSettings({ fresh: true });
  if (!(await acquireLock())) return null;

  const startedAt = new Date();
  try {
    let result: {
      ok: boolean;
      error: string;
      sheetRowCount: number;
      matchedCount: number;
      basis: "month" | "date";
      monthFrom: string;
      monthTo: string;
      dateFrom: string;
      dateTo: string;
      courseFilter: string;
      filteredOut: number;
      courseStats: { course: string; rows: number; matched: number; ignored: number }[];
      skipped: { row: number; reason: string }[];
      mismatches: MismatchResult[];
    };
    const failed = (error: string): typeof result => ({
      ok: false,
      error,
      sheetRowCount: 0,
      matchedCount: 0,
      basis: "date",
      monthFrom: "",
      monthTo: "",
      dateFrom: "",
      dateTo: "",
      courseFilter: settings.courseFilter,
      filteredOut: 0,
      courseStats: [],
      skipped: [],
      mismatches: [],
    });

    try {
      if (!settings.sheetUrl) throw new SheetError("Google Sheets havolasi kiritilmagan");
      const rows = await fetchSheetRows(settings.sheetUrl);
      const today = todayISO();
      const parsed = parseSheet(rows, settings.columns, {
        fallbackYear: Number(today.slice(0, 4)),
        today,
        courseFilter: settings.courseFilter,
      });
      if (parsed.missingColumns.length) {
        throw new SheetError(
          `Jadvalda kerakli ustun topilmadi: ${parsed.missingColumns.join(", ")}. «Google Sheets» sahifasida ustun nomlarini tekshiring.`,
        );
      }

      const [students, payments] = await Promise.all([
        Student.find({}, { fullName: 1, phone: 1, parentPhone: 1, group: 1, sheetNames: 1 }).lean(),
        loadSitePayments(parsed.window),
      ]);

      const cmp = compareRecords(
        parsed.records,
        students.map((s) => ({
          id: String(s._id),
          fullName: s.fullName,
          phone: s.phone ?? "",
          parentPhone: s.parentPhone ?? "",
          group: s.group ?? "",
          aliases: s.sheetNames ?? [],
        })),
        payments,
        { window: parsed.window, courseFilter: settings.courseFilter },
      );

      const w = parsed.window;
      result = {
        ok: true,
        error: "",
        sheetRowCount: parsed.records.length,
        matchedCount: cmp.matchedCount,
        basis: parsed.basis,
        monthFrom: w?.monthFrom ?? "",
        monthTo: w?.monthTo ?? "",
        dateFrom: w?.dateFrom ?? "",
        dateTo: w?.dateTo ?? "",
        courseFilter: settings.courseFilter,
        filteredOut: parsed.filteredOut,
        courseStats: [...new Set([...Object.keys(parsed.rowsByCourse), ...Object.keys(parsed.filteredByCourse)])]
          .map((course) => ({
            course,
            rows: parsed.rowsByCourse[course] ?? 0,
            matched: cmp.matchedByCourse[course] ?? 0,
            ignored: parsed.filteredByCourse[course] ?? 0,
          }))
          .sort((a, b) => b.rows - a.rows || b.ignored - a.ignored),
        skipped: parsed.skipped.slice(0, 100),
        mismatches: cmp.mismatches,
      };
    } catch (err) {
      if (!(err instanceof SheetError)) console.error("[sync]", err);
      result = failed(err instanceof SheetError ? err.message : `Kutilmagan xato: ${(err as Error).message}`);
    }

    const run = await SyncRun.create({ trigger, startedAt, finishedAt: new Date(), ...result });

    // Sheets'da bor, saytda yo'q to'lovlar — avtomatik saytga. Yangi o'quvchilar va summa farqlari — qo'lda tasdiqlanadi.
    let imported = 0;
    let resolved = 0;
    if (result.ok && settings.autoImport) {
      const ids: string[] = [];
      for (const m of run.mismatches) {
        if (m.kind !== "missing_on_site" || !m.studentId) continue;
        // Ehtiyot: saytda shu o'quvchining shu oyga tegishli to'lovi jadval oralig'idan tashqarida bo'lsa
        // (masalan, saytga boshqa kuni kiritilgan) — ikki marta yozilmasligi uchun avtomatik qo'shilmaydi.
        if (await hasOtherPaymentInMonth(String(m.studentId), m.month)) {
          const extra = "Saytda shu oy uchun boshqa sanada to‘lov bor — avtomatik qo‘shilmadi, tekshirib ko‘ring";
          await SyncRun.updateOne(
            { _id: run._id, "mismatches._id": m._id },
            { $set: { "mismatches.$.note": m.note ? `${m.note}. ${extra}` : extra } },
          );
          continue;
        }
        ids.push(String(m._id));
      }
      if (ids.length) {
        try {
          const res = await importFromRun(String(run._id), ids);
          imported = res?.rows ?? 0;
          resolved = res?.resolved ?? 0;
          if (imported) await SyncRun.updateOne({ _id: run._id }, { $set: { autoImported: imported } });
        } catch (err) {
          console.error("[sync] avtomatik qo'shish:", err);
        }
      }
    }

    // Eski natijalarni tozalash
    const old = await SyncRun.find({}, { _id: 1 }).sort({ startedAt: -1 }).skip(KEEP_RUNS).lean();
    if (old.length) await SyncRun.deleteMany({ _id: { $in: old.map((o) => o._id) } });

    return { id: String(run._id), ok: result.ok, error: result.error, mismatches: result.mismatches.length - resolved, imported };
  } finally {
    await releaseLock();
  }
}

/** Kunlik avtomatik tekshiruv vaqti (Toshkent bo'yicha soat). Standart: 06:00. */
export function syncHour(): number {
  const h = Number(process.env.SYNC_HOUR ?? 6);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 6;
}

/**
 * Agar bugungi rejalashtirilgan vaqtdan keyin hali muvaffaqiyatli tekshiruv bo'lmagan bo'lsa — ishga tushiradi.
 * Xato bo'lsa, 1 soatdan keyin qayta urinadi.
 */
export async function runSyncIfDue(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.sheetUrl) return false;
  const due = lastScheduledTime(syncHour());
  const [lastOk, lastAny] = await Promise.all([
    SyncRun.findOne({ ok: true }, { startedAt: 1 }).sort({ startedAt: -1 }).lean(),
    SyncRun.findOne({}, { startedAt: 1 }).sort({ startedAt: -1 }).lean(),
  ]);
  if (lastOk && lastOk.startedAt >= due) return false;
  if (lastAny && Date.now() - lastAny.startedAt.getTime() < 60 * 60_000) return false;
  const res = await runSync("auto");
  return res !== null;
}
