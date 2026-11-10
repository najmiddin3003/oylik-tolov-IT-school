import "server-only";
// Google Sheets arxivi: oylik olingach, shu oy jadvalining to'liq nusxasi bazaga yoziladi (havola, barcha qiymatlar,
// Google'ning o'zi chizgan ko'rinishi va asl .xlsx fayli) va havola sozlamalardan bo'shatiladi — yangi oy jadvali
// qo'yilguncha. Jadval keyin o'chirilsa yoki o'zgartirilsa ham, arxivda isbot sifatida qoladi.
import type { Types } from "mongoose";
import { courseLabel, parseSheet } from "./compare";
import { connectDB } from "./db";
import { Salary, SheetArchive, SheetRow, Staff } from "./models";
import { SALARY_CYCLE_FROM } from "./salary-cycle";
import { pickArchiveMonth, rowKeys, trimSheetRows } from "./sheet-archive-rules";
import { getSettings, updateSettings, type AppSettings } from "./settings";
import { fetchSheetSnapshot, SheetError, sheetSourceKey, type SheetSnapshot } from "./sheets";
import { acquireSyncLock, releaseSyncLock } from "./sync-lock";
import { currentMonth, shiftMonth, todayISO } from "./time";

export type ArchiveTrigger = "salary" | "auto" | "manual";

export type ArchiveResult = {
  id: string;
  month: string;
  title: string;
  /** To'lov qatorlari va jami summa */
  records: number;
  total: number;
  /** Havola bo'shatildimi */
  cleared: boolean;
  warnings: string[];
};

/** Arxivlashda ko'rib chiqiladigan avtomatik turlar: shu jadval bir marta avtomatik arxivlangan bo'lsa — qayta emas. */
const AUTO_TRIGGERS = ["salary", "auto"] as const;

/**
 * Qatorlar kuzatuvi: jadvaldagi har bir to'ldirilgan qator birinchi va oxirgi marta qachon ko'rilgani. Har tekshiruvda
 * chaqiriladi — shunda arxivda «qaysi qator qachon paydo bo'ldi» va o'chirilgan / o'zgartirilgan qatorlar ko'rinadi.
 */
export async function trackSheetRows(source: string, rows: string[][], at: Date): Promise<void> {
  const keys = rowKeys(rows);
  if (!keys.length) return;
  await connectDB();
  await SheetRow.bulkWrite(
    keys.map((k) => ({
      updateOne: {
        filter: { source, key: k.key },
        update: {
          $setOnInsert: { firstSeenAt: at },
          $set: { lastSeenAt: at, row: k.index + 1, cells: rows[k.index].map((c) => String(c ?? "")) },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

/** Nusxani bazaga yozish (qatorlar kuzatuvi, xulosa) va kerak bo'lsa havolani bo'shatish. */
async function saveArchive(
  settings: AppSettings,
  source: string,
  snap: SheetSnapshot,
  opts: { month: string; trigger: ArchiveTrigger; byName: string; clear: boolean },
): Promise<ArchiveResult> {
  const at = new Date();
  const rows = trimSheetRows(snap.rows);
  await trackSheetRows(source, rows, at);
  const seen = await SheetRow.find({ source }).lean();
  const byKey = new Map(seen.map((r) => [r.key, r]));
  const rowSeen: (Date | null)[] = rows.map(() => null);
  for (const k of rowKeys(rows)) rowSeen[k.index] = byKey.get(k.key)?.firstSeenAt ?? at;
  // Ilgari ko'rilgan, hozir yo'q qatorlar — o'chirilgan yoki o'zgartirilgan (o'zgargan qatorning yangi holati jadvalda)
  const removed = seen
    .filter((r) => r.lastSeenAt.getTime() < at.getTime())
    .sort((a, b) => a.row - b.row || a.firstSeenAt.getTime() - b.firstSeenAt.getTime())
    .slice(0, 2000)
    .map((r) => ({ row: r.row, cells: r.cells, firstSeenAt: r.firstSeenAt, lastSeenAt: r.lastSeenAt }));

  const today = todayISO();
  const parsed = parseSheet(rows, settings.columns, { fallbackYear: Number(today.slice(0, 4)), today, courseFilter: "" });
  const dates = parsed.records.map((r) => r.date).filter(Boolean).sort();
  const courses = new Map<string, { rows: number; total: number }>();
  for (const r of parsed.records) {
    const c = courseLabel(r.course);
    const cur = courses.get(c) ?? { rows: 0, total: 0 };
    cur.rows++;
    cur.total += r.amount;
    courses.set(c, cur);
  }
  const total = parsed.records.reduce((s, r) => s + r.amount, 0);

  const doc = await SheetArchive.create({
    month: opts.month,
    url: settings.sheetUrl,
    sourceKey: source,
    title: snap.title,
    tab: snap.tab,
    capturedAt: at,
    trigger: opts.trigger,
    capturedByName: opts.byName,
    rows,
    rowCount: rows.length,
    rowSeen,
    removedRows: removed,
    summary: {
      records: parsed.records.length,
      total,
      dateFrom: dates[0] ?? "",
      dateTo: dates.at(-1) ?? "",
      courses: [...courses].map(([course, v]) => ({ course, ...v })).sort((a, b) => b.total - a.total),
    },
    css: snap.css,
    tabs: snap.tabs,
    xlsx: snap.xlsx,
    warnings: snap.warnings,
    cleared: opts.clear,
  });
  if (opts.clear) await updateSettings({ $set: { sheetUrl: "", sheetArchived: true } });
  return {
    id: String(doc._id),
    month: opts.month,
    title: snap.title || snap.tab,
    records: parsed.records.length,
    total,
    cleared: opts.clear,
    warnings: snap.warnings,
  };
}

/**
 * «Oylik» olingan, hali jadvali arxivlanmagan oylar (foizli oylik — o'qituvchi va rahbar; administratorning belgilangan
 * oyligi oyni yopmaydi). Oylik davri yuritiladigan oydan (SALARY_CYCLE_FROM) boshlab.
 */
async function closedMonthsWithoutArchive(): Promise<string[]> {
  const percentStaff = (await Staff.distinct("_id", { role: { $ne: "admin" } })) as Types.ObjectId[];
  const [closed, archived] = await Promise.all([
    Salary.distinct("month", { kind: "oylik", staff: { $in: percentStaff }, month: { $gte: SALARY_CYCLE_FROM } }),
    SheetArchive.distinct("month", { trigger: { $in: AUTO_TRIGGERS } }),
  ]);
  const now = currentMonth();
  return (closed as string[]).filter((m) => m <= now && !(archived as string[]).includes(m)).sort();
}

/**
 * Qoida bo'yicha arxivlash (qulf allaqachon olingan bo'lsa): joriy jadval oyining oyligi olingan bo'lsa — jadval
 * arxivlanadi va havola bo'shatiladi. Jadval nomida boshqa oy yozilgan bo'lsa (masalan, yangi oy jadvali allaqachon
 * qo'yilgan) — arxivlanmaydi. Bir jadval avtomatik faqat bir marta arxivlanadi.
 */
export async function archiveIfDueLocked(opts: { trigger: "salary" | "auto"; byName?: string }): Promise<ArchiveResult | null> {
  const settings = await getSettings({ fresh: true });
  if (!settings.sheetUrl) return null;
  const source = sheetSourceKey(settings.sheetUrl);
  if (!source) return null;
  await connectDB();
  if (await SheetArchive.exists({ sourceKey: source, trigger: { $in: AUTO_TRIGGERS } })) return null;
  const candidates = await closedMonthsWithoutArchive();
  if (!candidates.length) return null;
  const snap = await fetchSheetSnapshot(settings.sheetUrl);
  const month = pickArchiveMonth(candidates, `${snap.title} ${snap.tab}`);
  if (!month) return null;
  return saveArchive(settings, source, snap, { month, trigger: opts.trigger, byName: opts.byName ?? "", clear: true });
}

/** Qoida bo'yicha arxivlash (oylik yozilganda): boshqa tekshiruv ketayotgan bo'lsa — o'sha tekshiruv o'zi bajaradi. */
export async function archiveIfDue(opts: { trigger: "salary" | "auto"; byName?: string }): Promise<ArchiveResult | null> {
  await connectDB();
  if (!(await acquireSyncLock())) return null;
  try {
    return await archiveIfDueLocked(opts);
  } finally {
    await releaseSyncLock();
  }
}

/** Rahbar tugmasi: joriy jadvalni tanlangan oy uchun hozir arxivlash (havolani bo'shatish — ixtiyoriy). */
export async function archiveSheetNow(opts: { month: string; clear: boolean; byName: string }): Promise<ArchiveResult | { error: string }> {
  const settings = await getSettings({ fresh: true });
  if (!settings.sheetUrl) return { error: "Google Sheets havolasi kiritilmagan" };
  const source = sheetSourceKey(settings.sheetUrl);
  if (!source) return { error: "Google Sheets havolasi noto‘g‘ri" };
  await connectDB();
  if (!(await acquireSyncLock())) return { error: "Hozir Sheets tekshiruvi ketmoqda — birozdan keyin urinib ko‘ring" };
  try {
    const snap = await fetchSheetSnapshot(settings.sheetUrl);
    return await saveArchive(settings, source, snap, { month: opts.month, trigger: "manual", byName: opts.byName, clear: opts.clear });
  } catch (err) {
    if (err instanceof SheetError) return { error: err.message };
    throw err;
  } finally {
    await releaseSyncLock();
  }
}

/** Arxivlash formasi uchun taklif: oyligi olingan, hali arxivlanmagan oxirgi oy (bo'lmasa — o'tgan oy). */
export async function suggestedArchiveMonth(): Promise<string> {
  await connectDB();
  const list = await closedMonthsWithoutArchive();
  if (list.length) return list.at(-1)!;
  return shiftMonth(currentMonth(), -1);
}
