// Google Sheets bilan saytdagi to'lovlarni solishtirish va natijani bazaga yozish.
import { connectDB } from "./db";
import {
  compareRecords,
  DEFAULT_COLUMNS,
  DEFAULT_COURSE_FILTER,
  parseSheet,
  type ColumnNames,
  type MismatchResult,
  type SheetWindow,
} from "./compare";
import { Payment, Setting, Student, SyncRun } from "./models";
import { fetchSheetRows, SheetError } from "./sheets";
import { dateToISO, isoToDate, lastScheduledTime, todayISO } from "./time";

export type SyncTrigger = "auto" | "cron" | "manual";

const LOCK_MS = 5 * 60_000;
const KEEP_RUNS = 60;
const DAY_MS = 24 * 3600_000;

export type SyncSettings = { sheetUrl: string; columns: ColumnNames; courseFilter: string };

export async function getSettings(): Promise<SyncSettings> {
  await connectDB();
  const doc = await Setting.findOneAndUpdate(
    { _id: "main" },
    {
      $setOnInsert: {
        _id: "main",
        sheetUrl: process.env.SHEET_URL ?? "",
        columns: DEFAULT_COLUMNS,
        courseFilter: DEFAULT_COURSE_FILTER,
      },
    },
    { upsert: true, returnDocument: "after", lean: true },
  );
  // Bo'sh qoldirilgan ustun nomlari o'rniga standart nomlar
  const saved = (doc?.columns ?? {}) as Partial<Record<keyof ColumnNames, string | null>>;
  const columns = { ...DEFAULT_COLUMNS };
  for (const k of Object.keys(DEFAULT_COLUMNS) as (keyof ColumnNames)[]) {
    if (saved[k]) columns[k] = saved[k]!;
  }
  return {
    sheetUrl: doc?.sheetUrl || process.env.SHEET_URL || "",
    columns,
    // Eski hujjatlarda maydon yo'q bo'lsa — standart; ataylab bo'sh qoldirilgan bo'lsa — filtrsiz
    courseFilter: typeof doc?.courseFilter === "string" ? doc.courseFilter : DEFAULT_COURSE_FILTER,
  };
}

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
  const filter =
    window.basis === "month"
      ? { month: { $gte: window.monthFrom, $lte: window.monthTo } }
      : {
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

/** Tekshiruvni hozir ishga tushiradi. Boshqa tekshiruv ketayotgan bo'lsa — null qaytaradi. */
export async function runSync(trigger: SyncTrigger): Promise<{ id: string; ok: boolean; error: string; mismatches: number } | null> {
  const settings = await getSettings();
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
        Student.find({}, { fullName: 1, phone: 1, parentPhone: 1, group: 1 }).lean(),
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
        skipped: parsed.skipped.slice(0, 100),
        mismatches: cmp.mismatches,
      };
    } catch (err) {
      if (!(err instanceof SheetError)) console.error("[sync]", err);
      result = failed(err instanceof SheetError ? err.message : `Kutilmagan xato: ${(err as Error).message}`);
    }

    const run = await SyncRun.create({ trigger, startedAt, finishedAt: new Date(), ...result });

    // Eski natijalarni tozalash
    const old = await SyncRun.find({}, { _id: 1 }).sort({ startedAt: -1 }).skip(KEEP_RUNS).lean();
    if (old.length) await SyncRun.deleteMany({ _id: { $in: old.map((o) => o._id) } });

    return { id: String(run._id), ok: result.ok, error: result.error, mismatches: result.mismatches.length };
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
