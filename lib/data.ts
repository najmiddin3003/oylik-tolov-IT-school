import "server-only";
import mongoose from "mongoose";
import { cache } from "react";
import { requireAuth, requireOwner } from "./auth";
import { connectDB } from "./db";
import { eskizConfigured } from "./eskiz";
import { changesAfter, percentFor, shareOf, type FeeChange, type PercentChange } from "./fees";
import {
  feeHistoryOf,
  LIVE,
  loadStudents,
  monthRows,
  sortDebtors,
  statusOf,
  studentFee,
  toRow,
  type PayStatus,
  type StudentLean,
  type StudentRow,
} from "./ledger";
import { Payment, Salary, SmsLog, Student, SyncRun, type MismatchKind, type PaymentMethod } from "./models";
import { normalizeText } from "./normalize";
import { daysLeftInMonth, monthEndReminderActive } from "./reminders";
import {
  filterWeekday,
  lessonOn,
  matchesDayFilter,
  normalizeLessons,
  popularSchedules,
  tashkentClock,
  toMinutes,
  type DayFilter,
  type Lesson,
} from "./schedule";
import { getSettings, standardFee } from "./settings";
import { sharePercent } from "./share";
import type { Role } from "./session";
import { compareMonths, currentMonth, isoToDate, monthOfDate, nowMs, shiftMonth, todayISO } from "./time";

export type { PayStatus, StudentRow } from "./ledger";

// ---------- Turlar (client komponentlarga uzatiladigan oddiy obyektlar) ----------

export type StudentDetail = {
  id: string;
  seq: number | null;
  fullName: string;
  phone: string;
  parentPhone: string;
  group: string;
  /** Asosiy (birinchi) narx; keyingi o'zgarishlar feeHistory da */
  monthlyFee: number;
  feeHistory: FeeChange[];
  /** Joriy oy uchun narx */
  currentFee: number;
  startDate: string; // ISO
  active: boolean;
  note: string;
  /** Dars jadvali (kunlar va vaqt) */
  lessons: Lesson[];
};

export type PaymentRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentGroup: string;
  month: string;
  amount: number;
  paidAt: string; // ISO
  method: PaymentMethod;
  note: string;
  source: "site" | "sheets";
  createdBy: "owner" | "admin" | "system";
  archivedAt: string | null;
  archivedBy: "owner" | "admin" | null;
};

export type StudentOption = {
  id: string;
  name: string;
  monthlyFee: number;
  feeHistory: FeeChange[];
  /** oy -> shu oy uchun to'langan summa (tanlangan oy atrofidagi oylar) */
  paid: Record<string, number>;
};

export type UnpaidStudent = {
  id: string;
  name: string;
  phone: string;
  fee: number;
  paid: number;
  debt: number;
  status: PayStatus;
  /** Dars jadvali — to'lovni o'quvchi kelgan vaqtda yig'ish uchun */
  lessons: Lesson[];
};

export type Reminder = {
  month: string;
  /** Joriy oy bo'lsa — oy tugashiga necha kun qolgani; o'tgan oy uchun null */
  daysLeft: number | null;
  total: number;
  students: UnpaidStudent[];
};

export type MismatchRow = {
  id: string;
  kind: MismatchKind;
  studentId: string | null;
  studentName: string;
  phone: string;
  group: string;
  fee: number;
  parts: { row: number; date: string; amount: number; cash: number; card: number }[];
  month: string;
  siteAmount: number;
  sheetAmount: number;
  sheetRows: number[];
  sheetDate: string;
  note: string;
  resolved: boolean;
};

export type SyncRunView = {
  id: string;
  trigger: "auto" | "cron" | "manual";
  startedAt: string;
  finishedAt: string | null;
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
  mismatches: MismatchRow[];
  /** Sheets'dan avtomatik qo'shilgan to'lov qatorlari */
  autoImported: number;
};

export type SyncState = "ok" | "warn" | "error" | "off";

export type NavCounts = { role: Role; students?: number; payments: number; sync?: SyncState };

// ---------- Yordamchilar ----------

/** Qidiruv: ism / guruh (apostrof va katta-kichik harf farqisiz), telefon raqamlari, #raqam. */
function matchesQuery(r: { fullName: string; group: string; phone: string; seq: number | null }, q: string): boolean {
  const nq = normalizeText(q);
  if (!nq) return true;
  if (normalizeText(r.fullName).includes(nq) || normalizeText(r.group).includes(nq)) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && r.phone.replace(/\D/g, "").includes(digits)) return true;
  const code = q.trim().replace(/^#/, "");
  return /^\d+$/.test(code) && r.seq === Number(code);
}

type PopulatedPayment = {
  _id: mongoose.Types.ObjectId;
  student: { _id: mongoose.Types.ObjectId; fullName: string; group?: string | null } | null;
  month: string;
  amount: number;
  paidAt: Date;
  method?: string | null;
  note?: string | null;
  source?: string | null;
  createdBy?: string | null;
  archivedAt?: Date | null;
  archivedBy?: string | null;
};

function toPaymentRow(p: PopulatedPayment): PaymentRow {
  return {
    id: String(p._id),
    studentId: p.student ? String(p.student._id) : "",
    studentName: p.student?.fullName ?? "(o‘chirilgan o‘quvchi)",
    studentGroup: p.student?.group ?? "",
    month: p.month,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    method: (p.method ?? "naqd") as PaymentMethod,
    note: p.note ?? "",
    source: p.source === "sheets" ? "sheets" : "site",
    // Eski yozuvlarda maydon yo'q: Sheets'dan kelgani — tizim, qolgani — rahbar
    createdBy: p.createdBy === "admin" || p.createdBy === "system" ? p.createdBy : !p.createdBy && p.source === "sheets" ? "system" : "owner",
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
    archivedBy: p.archivedBy === "admin" || p.archivedBy === "owner" ? p.archivedBy : null,
  };
}

function findPayments(filter: Record<string, unknown>, sort: Record<string, 1 | -1>, limit = 3000) {
  return Payment.find(filter)
    .sort(sort)
    .limit(limit)
    .populate<{ student: PopulatedPayment["student"] }>("student", "fullName group")
    .lean<PopulatedPayment[]>();
}

function toUnpaid(r: StudentRow): UnpaidStudent {
  return { id: r.id, name: r.fullName, phone: r.phone, fee: r.monthlyFee, paid: r.paid, debt: r.debt, status: r.status, lessons: r.lessons };
}

// ---------- Umumiy ----------

export async function listGroups(): Promise<string[]> {
  await requireOwner();
  await connectDB();
  const groups = (await Student.distinct("group")) as string[];
  return groups.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Yon menyudagi son belgilari (rolga qarab). */
export const getNavCounts = cache(async (): Promise<NavCounts> => {
  const { role } = await requireAuth();
  await connectDB();
  const month = currentMonth();
  if (role === "admin") {
    return { role, payments: await Payment.countDocuments({ ...LIVE, month }) };
  }
  const [students, payments, settings, last] = await Promise.all([
    Student.countDocuments({ active: true }),
    Payment.countDocuments({ ...LIVE, month }),
    getSettings(),
    SyncRun.findOne({}).select("ok mismatches.resolved").sort({ startedAt: -1 }).lean(),
  ]);
  let sync: SyncState = "off";
  if (settings.sheetUrl && last) {
    if (!last.ok) sync = "error";
    else sync = (last.mismatches ?? []).some((m) => !m.resolved) ? "warn" : "ok";
  }
  return { role, students, payments, sync };
});

// ---------- Oy bo'yicha umumiy holat (bosh sahifa va to'lovlar sahifasi) ----------

/** Tanlangan oy bo'yicha faol o'quvchilarning to'lov holati va tushum. */
export const getMonthOverview = cache(async (month: string, group = "") => {
  await requireAuth();
  await connectDB();
  const [students, agg] = await Promise.all([
    loadStudents(),
    Payment.aggregate<{ _id: { student: mongoose.Types.ObjectId; method: string }; total: number; count: number }>([
      { $match: { ...LIVE, month } },
      { $group: { _id: { student: "$student", method: "$method" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  const inGroup = new Set(students.filter((s) => !group || (s.group ?? "") === group).map((s) => String(s._id)));

  const paidMap = new Map<string, number>();
  let collected = 0;
  let paymentCount = 0;
  let cash = 0;
  for (const a of agg) {
    const id = String(a._id.student);
    paidMap.set(id, (paidMap.get(id) ?? 0) + a.total);
    // Guruh tanlanmagan bo'lsa — hamma to'lovlar (o'quvchisi topilmaganlari ham) tushumga kiradi
    if (group && !inGroup.has(id)) continue;
    collected += a.total;
    paymentCount += a.count;
    if ((a._id.method ?? "naqd") === "naqd") cash += a.total;
  }

  const rows = students
    .filter((s) => inGroup.has(String(s._id)))
    .map((s) => toRow(s, paidMap, month))
    .filter((r) => r.active && r.started);
  const debtors = sortDebtors(rows);

  return {
    rows,
    debtors,
    /** O'quvchi id -> shu oy uchun to'langan (barcha o'quvchilar, guruhdan qat'i nazar) */
    paid: Object.fromEntries(paidMap) as Record<string, number>,
    totals: {
      students: rows.length,
      groups: new Set(rows.map((r) => r.group).filter(Boolean)).size,
      paid: rows.filter((r) => r.status === "paid").length,
      partial: rows.filter((r) => r.status === "partial").length,
      unpaid: rows.filter((r) => r.status === "unpaid").length,
      expected: rows.reduce((sum, r) => sum + r.monthlyFee, 0),
      debt: rows.reduce((sum, r) => sum + r.debt, 0),
      collected,
      paymentCount,
      cash,
      nonCash: collected - cash,
    },
  };
});

/** Tushum ulushi (masalan 40%) va shu oy uchun olingan oylik/avanslar — faqat rahbar uchun. */
export async function getShareSummary(month: string, collected: number) {
  await requireOwner();
  await connectDB();
  const [settings, salaries] = await Promise.all([
    getSettings(),
    Salary.find({ month }).sort({ date: -1, createdAt: -1 }).lean(),
  ]);
  const percent = percentFor(settings.shareHistory, month, sharePercent());
  const share = shareOf(collected, percent);
  const taken = salaries.reduce((s, x) => s + x.amount, 0);
  return {
    percent,
    share,
    taken,
    left: share - taken,
    salaries: salaries.map((x) => ({
      id: String(x._id),
      kind: x.kind as "oylik" | "avans",
      amount: x.amount,
      date: x.date.toISOString(),
      month: x.month,
      note: x.note ?? "",
    })),
  };
}

export type ShareSummary = Awaited<ReturnType<typeof getShareSummary>>;

/**
 * Oy oxiri eslatmalari: joriy oy — oy tugashiga 10 kun qolganda; o'tgan oy — to'lamaganlar qolgan bo'lsa.
 */
export const getReminders = cache(async (): Promise<Reminder[]> => {
  await requireAuth();
  await connectDB();
  const today = todayISO();
  const current = today.slice(0, 7);
  const months = monthEndReminderActive(today) ? [current, shiftMonth(current, -1)] : [shiftMonth(current, -1)];
  const students = await loadStudents();
  const lists = await Promise.all(months.map((m) => monthRows(m, students)));
  return months
    .map((month, i) => {
      const debtors = sortDebtors(lists[i]);
      return {
        month,
        daysLeft: month === current ? daysLeftInMonth(today) : null,
        total: debtors.reduce((s, r) => s + r.debt, 0),
        students: debtors.map(toUnpaid),
      };
    })
    .filter((r) => r.students.length > 0);
});

/** Bitta oy uchun to'lamaganlar ro'yxati (to'lovlar sahifasidagi «Qolgan qarz» kartasi). */
export async function listUnpaid(month: string, group = ""): Promise<UnpaidStudent[]> {
  const { debtors } = await getMonthOverview(month, group);
  return debtors.map(toUnpaid);
}

// ---------- O'quvchilar ----------

export type StudentTab = "all" | "debt" | "paid";
export type StudentSort = "name" | "-name" | "debt";

export async function listStudents(opts: {
  q: string;
  group: string;
  /** Dars kuni: bugun / hafta kuni / jadvalsiz */
  day: DayFilter;
  status: "active" | "inactive" | "all";
  month: string;
  tab: StudentTab;
  sort: StudentSort;
  page: number;
  pageSize: number;
}) {
  await requireOwner();
  await connectDB();
  const [{ debtors, rows: current, paid }, students] = await Promise.all([getMonthOverview(opts.month), loadStudents()]);
  const paidMap = new Map(Object.entries(paid));
  const all = students.map((s) => toRow(s, paidMap, opts.month));

  // Yuqoridagi kartalar: filtrlardan qat'i nazar
  const stats = {
    total: all.length,
    activeThisMonth: current.length,
    fullyPaid: current.length - debtors.length,
    totalDebt: current.reduce((s, r) => s + r.debt, 0),
  };

  const today = tashkentClock(nowMs()).weekday;
  const filtered = all.filter(
    (r) =>
      (opts.status === "all" || (opts.status === "active" ? r.active : !r.active)) &&
      (!opts.group || r.group === opts.group) &&
      matchesDayFilter(r.lessons, opts.day, today) &&
      matchesQuery(r, opts.q),
  );
  // Kun tanlansa — o'sha kungi dars vaqti bo'yicha (ism bo'yicha saralashda)
  const weekday = filterWeekday(opts.day, today);
  const startOf = (r: StudentRow) => {
    const l = weekday ? lessonOn(r.lessons, weekday) : undefined;
    return l ? toMinutes(l.start) : Number.POSITIVE_INFINITY;
  };
  const isDebtor = (r: StudentRow) => r.active && r.started && r.status !== "paid";
  const isPaid = (r: StudentRow) => r.active && r.started && r.status === "paid";
  const counts = { all: filtered.length, debt: filtered.filter(isDebtor).length, paid: filtered.filter(isPaid).length };

  const tabRows = opts.tab === "debt" ? filtered.filter(isDebtor) : opts.tab === "paid" ? filtered.filter(isPaid) : filtered;
  const sorted = [...tabRows].sort((a, b) => {
    if (opts.sort === "debt") return b.debt - a.debt || a.fullName.localeCompare(b.fullName);
    if (weekday && opts.sort === "name") return startOf(a) - startOf(b) || a.fullName.localeCompare(b.fullName);
    const cmp = a.fullName.localeCompare(b.fullName);
    return opts.sort === "-name" ? -cmp : cmp;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / opts.pageSize));
  const page = Math.min(Math.max(1, opts.page), pages);
  return {
    rows: sorted.slice((page - 1) * opts.pageSize, page * opts.pageSize),
    shown: sorted.length,
    counts,
    stats,
    page,
    pages,
  };
}

/** Yuqoridagi tezkor qidiruv uchun (rahbar). */
export async function searchStudents(q: string, limit = 8) {
  await requireOwner();
  if (!q.trim()) return [];
  await connectDB();
  const students = await loadStudents();
  return students
    .map((s) => ({
      id: String(s._id),
      fullName: s.fullName,
      phone: s.phone ?? "",
      group: s.group ?? "",
      seq: s.seq ?? null,
      active: s.active ?? true,
    }))
    .filter((s) => matchesQuery(s, q))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.fullName.localeCompare(b.fullName))
    .slice(0, limit);
}

export async function getStudent(id: string): Promise<StudentDetail | null> {
  await requireOwner();
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const s = await Student.findById(id).lean<StudentLean & { parentPhone?: string | null; note?: string | null }>();
  if (!s) return null;
  return {
    id: String(s._id),
    seq: s.seq ?? null,
    fullName: s.fullName,
    phone: s.phone ?? "",
    parentPhone: s.parentPhone ?? "",
    group: s.group ?? "",
    monthlyFee: s.monthlyFee,
    feeHistory: feeHistoryOf(s),
    currentFee: studentFee(s, currentMonth()),
    startDate: s.startDate.toISOString(),
    active: s.active ?? true,
    note: s.note ?? "",
    lessons: normalizeLessons(s.lessons),
  };
}

/** Faol o'quvchilarda ko'p uchraydigan dars jadvallari (formada bir bosishda qo'yish uchun). */
export async function listScheduleTemplates(): Promise<Lesson[][]> {
  await requireOwner();
  await connectDB();
  const students = await loadStudents();
  return popularSchedules(students.filter((s) => s.active ?? true).map((s) => normalizeLessons(s.lessons))).map((t) => t.lessons);
}

/** O'quvchining barcha to'lovlari va boshlagan oyidan joriy oygacha har oy holati. */
export async function getStudentPayments(student: StudentDetail) {
  await requireOwner();
  await connectDB();
  const payments = await findPayments({ ...LIVE, student: student.id }, { paidAt: -1, month: -1 });
  const rows = payments.map(toPaymentRow);

  const byMonth = new Map<string, number>();
  for (const p of rows) byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);

  const start = monthOfDate(new Date(student.startDate));
  const now = currentMonth();
  const feeOf = (m: string) => studentFee({ monthlyFee: student.monthlyFee, feeHistory: student.feeHistory }, m);
  // boshlanish oyidan joriy oygacha (ko'pi bilan 36 oy) + oldindan to'langan oylar
  const all = new Set(byMonth.keys());
  for (let i = 0, m = now; i < 36 && compareMonths(m, start) >= 0; i++, m = shiftMonth(m, -1)) all.add(m);
  const months = [...all]
    .sort((a, b) => compareMonths(b, a))
    .map((month) => {
      const paid = byMonth.get(month) ?? 0;
      const fee = feeOf(month);
      return { month, fee, paid, status: statusOf(fee, paid) };
    });

  const totalDebt = months
    .filter((x) => compareMonths(x.month, now) <= 0 && compareMonths(x.month, start) >= 0)
    .reduce((sum, x) => sum + Math.max(0, x.fee - x.paid), 0);
  const totalPaid = rows.reduce((s, r) => s + r.amount, 0);

  return { payments: rows, months, totalDebt, totalPaid };
}

// ---------- To'lovlar ----------

export type PaymentFilter = { q: string; method: string; day: string };

/**
 * To'lovlar tarixi: tanlangan oy uchun to'lovlar. Kun tanlansa — o'sha kuni qabul qilingan
 * barcha to'lovlar (qaysi oy uchunligidan qat'i nazar).
 */
export async function listPayments(month: string, f: PaymentFilter) {
  await requireAuth();
  await connectDB();
  const dayStart = f.day ? isoToDate(f.day) : null;
  const filter = dayStart
    ? { ...LIVE, paidAt: { $gte: dayStart, $lt: new Date(dayStart.getTime() + 24 * 3600_000) } }
    : { ...LIVE, month };
  const payments = await findPayments(filter, { paidAt: -1, createdAt: -1 });
  const nq = normalizeText(f.q);
  const rows = payments
    .map(toPaymentRow)
    .filter(
      (r) =>
        (!f.method || r.method === f.method) &&
        (!nq || normalizeText(`${r.studentName} ${r.note} ${r.studentGroup}`).includes(nq)),
    );
  return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

export async function listArchivedPayments(): Promise<PaymentRow[]> {
  await requireOwner();
  await connectDB();
  const payments = await findPayments({ archivedAt: { $ne: null } }, { archivedAt: -1 }, 500);
  return payments.map(toPaymentRow);
}

export async function countArchivedPayments(): Promise<number> {
  await requireOwner();
  await connectDB();
  return Payment.countDocuments({ archivedAt: { $ne: null } });
}

/** To'lov formasi uchun: faol o'quvchilar va tanlangan oy atrofidagi to'lovlari. */
export async function listStudentOptions(month: string): Promise<StudentOption[]> {
  await requireAuth();
  await connectDB();
  const [students, agg] = await Promise.all([
    Student.find({ active: true }, { fullName: 1, monthlyFee: 1, feeHistory: 1 }).sort({ fullName: 1 }).lean<StudentLean[]>(),
    Payment.aggregate<{ _id: { student: mongoose.Types.ObjectId; month: string }; total: number }>([
      { $match: { ...LIVE, month: { $gte: shiftMonth(month, -12), $lte: shiftMonth(month, 12) } } },
      { $group: { _id: { student: "$student", month: "$month" }, total: { $sum: "$amount" } } },
    ]),
  ]);
  const paid = new Map<string, Record<string, number>>();
  for (const a of agg) {
    const id = String(a._id.student);
    paid.set(id, { ...(paid.get(id) ?? {}), [a._id.month]: a.total });
  }
  return students.map((s) => ({
    id: String(s._id),
    name: s.fullName,
    monthlyFee: s.monthlyFee,
    feeHistory: feeHistoryOf(s),
    paid: paid.get(String(s._id)) ?? {},
  }));
}

// ---------- Sozlamalar ----------

export async function getSettingsPageData(month: string) {
  await requireOwner();
  await connectDB();
  const overview = await getMonthOverview(month);
  const [settings, share, logs, active] = await Promise.all([
    getSettings({ fresh: true }),
    getShareSummary(month, overview.totals.collected),
    SmsLog.find({}).sort({ createdAt: -1 }).limit(8).lean(),
    Student.find({ active: true }, { monthlyFee: 1, feeHistory: 1 }).lean<StudentLean[]>(),
  ]);

  // Joriy oy narxlari: qaysi narxda nechta o'quvchi
  const now = currentMonth();
  const fees = new Map<number, number>();
  for (const s of active) {
    const fee = studentFee(s, now);
    fees.set(fee, (fees.get(fee) ?? 0) + 1);
  }
  const feeGroups = [...fees.entries()].map(([fee, count]) => ({ fee, count })).sort((a, b) => b.count - a.count || b.fee - a.fee);

  return {
    centerName: settings.centerName,
    /** Yangi o'quvchilar uchun standart narx: hozirgi va rejalashtirilgan o'zgarishlar */
    standardNow: standardFee(settings, now),
    standardNext: changesAfter(settings.feeSchedule, now),
    feeGroups,
    feeChanges: [...settings.feeChanges].reverse().slice(0, 10),
    percentNow: percentFor(settings.shareHistory, now, sharePercent()),
    shareHistory: [...settings.shareHistory].sort((a, b) => compareMonths(b.from, a.from)) as PercentChange[],
    ownerPasswordInDb: Boolean(settings.ownerPasswordHash),
    adminEnabled: Boolean(settings.adminPasswordHash),
    sms: settings.sms,
    eskizReady: eskizConfigured(),
    smsLogs: logs.map((l) => ({
      id: String(l._id),
      day: l.day,
      trigger: l.trigger as "cron" | "auto" | "test",
      status: l.status as "sent" | "skipped" | "failed",
      count: l.count ?? 0,
      text: l.text ?? "",
      error: l.error ?? "",
      at: (l as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    })),
    month,
    collected: overview.totals.collected,
    share,
  };
}

// ---------- Google Sheets ----------

function toRunView(r: Awaited<ReturnType<typeof findRuns>>[number]): SyncRunView {
  return {
    id: String(r._id),
    trigger: r.trigger as SyncRunView["trigger"],
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    ok: r.ok ?? false,
    error: r.error ?? "",
    sheetRowCount: r.sheetRowCount ?? 0,
    matchedCount: r.matchedCount ?? 0,
    basis: r.basis === "date" ? "date" : "month",
    monthFrom: r.monthFrom ?? "",
    monthTo: r.monthTo ?? "",
    dateFrom: r.dateFrom ?? "",
    dateTo: r.dateTo ?? "",
    courseFilter: r.courseFilter ?? "",
    filteredOut: r.filteredOut ?? 0,
    skipped: (r.skipped ?? []).map((s) => ({ row: s.row ?? 0, reason: s.reason ?? "" })),
    autoImported: r.autoImported ?? 0,
    mismatches: (r.mismatches ?? []).map((m) => ({
      id: String(m._id),
      kind: m.kind as MismatchKind,
      studentId: m.studentId ? String(m.studentId) : null,
      studentName: m.studentName ?? "",
      phone: m.phone ?? "",
      group: m.group ?? "",
      fee: m.fee ?? 0,
      parts: (m.parts ?? []).map((p) => ({
        row: p.row ?? 0,
        date: p.date ?? "",
        amount: p.amount ?? 0,
        cash: p.cash ?? 0,
        card: p.card ?? 0,
      })),
      month: m.month,
      siteAmount: m.siteAmount ?? 0,
      sheetAmount: m.sheetAmount ?? 0,
      sheetRows: m.sheetRows ?? [],
      sheetDate: m.sheetDate ?? "",
      note: m.note ?? "",
      resolved: m.resolved ?? false,
    })),
  };
}

function findRuns(limit: number) {
  return SyncRun.find({}).sort({ startedAt: -1 }).limit(limit).lean();
}

export async function getSyncPageData() {
  await requireOwner();
  await connectDB();
  const [settings, runs] = await Promise.all([getSettings({ fresh: true }), findRuns(10)]);
  return {
    settings: { sheetUrl: settings.sheetUrl, columns: settings.columns, courseFilter: settings.courseFilter, autoImport: settings.autoImport },
    runs: runs.map(toRunView),
  };
}

/** Ogohlantirish uchun: oxirgi tekshiruvdagi hal qilinmagan farqlar soni yoki xato (faqat rahbar ko'radi). */
export const getSyncAlert = cache(async (): Promise<{ unresolved: number; error: string; at: string } | null> => {
  const { role } = await requireAuth();
  if (role !== "owner") return null;
  await connectDB();
  const last = await SyncRun.findOne({})
    .select("ok error startedAt mismatches.resolved")
    .sort({ startedAt: -1 })
    .lean();
  if (!last) return null;
  const unresolved = (last.mismatches ?? []).filter((m) => !m.resolved).length;
  if (last.ok && unresolved === 0) return null;
  return { unresolved, error: last.ok ? "" : last.error ?? "", at: last.startedAt.toISOString() };
});
