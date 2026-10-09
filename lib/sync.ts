// Google Sheets bilan saytdagi to'lovlarni solishtirish va natijani bazaga yozish.
import { connectDB } from "./db";
import {
  compareRecords,
  DEFAULT_COLUMNS,
  parseSheet,
  sheetMonthRange,
  type ColumnNames,
} from "./compare";
import { Payment, Setting, Student, SyncRun } from "./models";
import { fetchSheetRows, SheetError } from "./sheets";
import { lastScheduledTime, TZ_OFFSET_MINUTES } from "./time";

export type SyncTrigger = "auto" | "cron" | "manual";

const LOCK_MS = 5 * 60_000;
const KEEP_RUNS = 60;

export async function getSettings() {
  await connectDB();
  const doc = await Setting.findOneAndUpdate(
    { _id: "main" },
    { $setOnInsert: { _id: "main", sheetUrl: process.env.SHEET_URL ?? "", columns: DEFAULT_COLUMNS } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  const columns = { ...DEFAULT_COLUMNS, ...(doc?.columns ?? {}) } as ColumnNames;
  return { sheetUrl: doc?.sheetUrl || process.env.SHEET_URL || "", columns };
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
      monthFrom: string;
      monthTo: string;
      skipped: { row: number; reason: string }[];
      mismatches: ReturnType<typeof compareRecords>["mismatches"];
    };

    try {
      if (!settings.sheetUrl) throw new SheetError("Google Sheets havolasi kiritilmagan");
      const rows = await fetchSheetRows(settings.sheetUrl);
      const fallbackYear = new Date(Date.now() + TZ_OFFSET_MINUTES * 60_000).getUTCFullYear();
      const parsed = parseSheet(rows, settings.columns, fallbackYear);
      if (parsed.missingColumns.length) {
        throw new SheetError(
          `Jadvalda kerakli ustun topilmadi: ${parsed.missingColumns.join(", ")}. «Google Sheets» sahifasida ustun nomlarini tekshiring.`,
        );
      }

      const range = sheetMonthRange(parsed.records);
      const [students, payments] = await Promise.all([
        Student.find({}, { fullName: 1, phone: 1, parentPhone: 1 }).lean(),
        range
          ? Payment.aggregate<{ _id: { student: unknown; month: string }; amount: number }>([
              { $match: { month: { $gte: range.from, $lte: range.to } } },
              { $group: { _id: { student: "$student", month: "$month" }, amount: { $sum: "$amount" } } },
            ])
          : Promise.resolve([]),
      ]);

      const cmp = compareRecords(
        parsed.records,
        students.map((s) => ({
          id: String(s._id),
          fullName: s.fullName,
          phone: s.phone ?? "",
          parentPhone: s.parentPhone ?? "",
        })),
        payments.map((p) => ({ studentId: String(p._id.student), month: p._id.month, amount: p.amount })),
      );

      result = {
        ok: true,
        error: "",
        sheetRowCount: parsed.records.length,
        matchedCount: cmp.matchedCount,
        monthFrom: cmp.monthFrom,
        monthTo: cmp.monthTo,
        skipped: parsed.skipped.slice(0, 100),
        mismatches: cmp.mismatches,
      };
    } catch (err) {
      const message =
        err instanceof SheetError ? err.message : `Kutilmagan xato: ${(err as Error).message}`;
      if (!(err instanceof SheetError)) console.error("[sync]", err);
      result = {
        ok: false,
        error: message,
        sheetRowCount: 0,
        matchedCount: 0,
        monthFrom: "",
        monthTo: "",
        skipped: [],
        mismatches: [],
      };
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
