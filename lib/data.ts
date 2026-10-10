import "server-only";
import mongoose from "mongoose";
import { requireAuth } from "./auth";
import { connectDB } from "./db";
import { Payment, Student, SyncRun, type MismatchKind, type PaymentMethod } from "./models";
import { normalizeText } from "./normalize";
import { ensureStudentSeqs } from "./seq";
import { getSettings } from "./sync";
import { compareMonths, currentMonth, monthOfDate, shiftMonth } from "./time";

// ---------- Turlar (client komponentlarga uzatiladigan oddiy obyektlar) ----------

export type PayStatus = "paid" | "partial" | "unpaid";

export type StudentRow = {
  id: string;
  seq: number | null;
  fullName: string;
  phone: string;
  group: string;
  monthlyFee: number;
  active: boolean;
  paid: number;
  debt: number;
  status: PayStatus;
  started: boolean; // tanlangan oyda o'qishni boshlaganmi
};

export type StudentDetail = {
  id: string;
  seq: number | null;
  fullName: string;
  phone: string;
  parentPhone: string;
  group: string;
  monthlyFee: number;
  startDate: string; // ISO
  active: boolean;
  note: string;
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
};

export type StudentOption = {
  id: string;
  name: string;
  group: string;
  fee: number;
  /** oy -> shu oy uchun to'langan summa (tanlangan oy atrofidagi oylar) */
  paid: Record<string, number>;
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
};

export type SyncState = "ok" | "warn" | "error" | "off";

// ---------- Yordamchilar ----------

function statusOf(fee: number, paid: number): PayStatus {
  if (paid >= fee) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}

async function paidByStudent(month: string): Promise<Map<string, number>> {
  const agg = await Payment.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
    { $match: { month } },
    { $group: { _id: "$student", total: { $sum: "$amount" } } },
  ]);
  return new Map(agg.map((a) => [String(a._id), a.total]));
}

type StudentLean = {
  _id: mongoose.Types.ObjectId;
  seq?: number | null;
  fullName: string;
  phone?: string | null;
  group?: string | null;
  monthlyFee: number;
  active?: boolean | null;
  startDate: Date;
};

function toRow(s: StudentLean, paidMap: Map<string, number>, month: string): StudentRow {
  const paid = paidMap.get(String(s._id)) ?? 0;
  return {
    id: String(s._id),
    seq: s.seq ?? null,
    fullName: s.fullName,
    phone: s.phone ?? "",
    group: s.group ?? "",
    monthlyFee: s.monthlyFee,
    active: s.active ?? true,
    paid,
    debt: Math.max(0, s.monthlyFee - paid),
    status: statusOf(s.monthlyFee, paid),
    started: compareMonths(monthOfDate(s.startDate), month) <= 0,
  };
}

async function loadStudents(): Promise<StudentLean[]> {
  await ensureStudentSeqs();
  return Student.find({}, { fullName: 1, phone: 1, group: 1, monthlyFee: 1, active: 1, startDate: 1, seq: 1 })
    .sort({ fullName: 1 })
    .limit(5000)
    .lean();
}

/** Qidiruv: ism / guruh (apostrof va katta-kichik harf farqisiz), telefon raqamlari. */
function matchesQuery(r: StudentRow, q: string): boolean {
  const nq = normalizeText(q);
  if (!nq) return true;
  if (normalizeText(r.fullName).includes(nq) || normalizeText(r.group).includes(nq)) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && r.phone.replace(/\D/g, "").includes(digits)) return true;
  const code = q.replace(/^#/, "");
  return /^\d+$/.test(code) && r.seq === Number(code);
}

const byStatus: Record<PayStatus, number> = { unpaid: 0, partial: 1, paid: 2 };

// ---------- Umumiy ----------

export async function listGroups(): Promise<string[]> {
  await requireAuth();
  await connectDB();
  const groups = (await Student.distinct("group")) as string[];
  return groups.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Yon menyudagi son belgilari va Sheets holati. */
export async function getNavCounts(): Promise<{ students: number; payments: number; sync: SyncState }> {
  await requireAuth();
  await connectDB();
  const [students, payments, settings, last] = await Promise.all([
    Student.countDocuments({ active: true }),
    Payment.countDocuments({ month: currentMonth() }),
    getSettings(),
    SyncRun.findOne({}).select("ok mismatches.resolved").sort({ startedAt: -1 }).lean(),
  ]);
  let sync: SyncState = "off";
  if (settings.sheetUrl && last) {
    if (!last.ok) sync = "error";
    else sync = (last.mismatches ?? []).some((m) => !m.resolved) ? "warn" : "ok";
  }
  return { students, payments, sync };
}

// ---------- Bosh sahifa ----------

/** Tanlangan oy bo'yicha faol o'quvchilarning to'lov holati. */
export async function getMonthOverview(month: string, group: string) {
  await requireAuth();
  await connectDB();
  const [students, paidMap, collectedAgg] = await Promise.all([
    loadStudents(),
    paidByStudent(month),
    Payment.aggregate<{ total: number; count: number }>([
      { $match: { month } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const rows = students
    .map((s) => toRow(s, paidMap, month))
    .filter((r) => r.active && r.started && (!group || r.group === group));

  const expected = rows.reduce((sum, r) => sum + r.monthlyFee, 0);
  const debt = rows.reduce((sum, r) => sum + r.debt, 0);
  const debtors = rows
    .filter((r) => r.status !== "paid")
    .sort((a, b) => byStatus[a.status] - byStatus[b.status] || a.fullName.localeCompare(b.fullName));

  return {
    rows,
    debtors,
    totals: {
      students: rows.length,
      groups: new Set(rows.map((r) => r.group).filter(Boolean)).size,
      paid: rows.filter((r) => r.status === "paid").length,
      partial: rows.filter((r) => r.status === "partial").length,
      unpaid: rows.filter((r) => r.status === "unpaid").length,
      expected,
      debt,
      collected: collectedAgg[0]?.total ?? 0,
      paymentCount: collectedAgg[0]?.count ?? 0,
    },
  };
}

// ---------- O'quvchilar ----------

export type StudentTab = "all" | "debt" | "paid";
export type StudentSort = "name" | "-name" | "debt";

export async function listStudents(opts: {
  q: string;
  group: string;
  status: "active" | "inactive" | "all";
  month: string;
  tab: StudentTab;
  sort: StudentSort;
  page: number;
  pageSize: number;
}) {
  await requireAuth();
  await connectDB();
  const [students, paidMap] = await Promise.all([loadStudents(), paidByStudent(opts.month)]);
  const all = students.map((s) => toRow(s, paidMap, opts.month));

  // Yuqoridagi kartalar: filtrlardan qat'i nazar
  const current = all.filter((r) => r.active && r.started);
  const stats = {
    total: all.length,
    activeThisMonth: current.length,
    fullyPaid: current.filter((r) => r.status === "paid").length,
    totalDebt: current.reduce((s, r) => s + r.debt, 0),
  };

  const filtered = all.filter(
    (r) =>
      (opts.status === "all" || (opts.status === "active" ? r.active : !r.active)) &&
      (!opts.group || r.group === opts.group) &&
      matchesQuery(r, opts.q),
  );
  const isDebtor = (r: StudentRow) => r.active && r.started && r.status !== "paid";
  const isPaid = (r: StudentRow) => r.started && r.status === "paid";
  const counts = { all: filtered.length, debt: filtered.filter(isDebtor).length, paid: filtered.filter(isPaid).length };

  const tabRows = opts.tab === "debt" ? filtered.filter(isDebtor) : opts.tab === "paid" ? filtered.filter(isPaid) : filtered;
  const sorted = [...tabRows].sort((a, b) => {
    if (opts.sort === "debt") return b.debt - a.debt || a.fullName.localeCompare(b.fullName);
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

export async function getStudent(id: string): Promise<StudentDetail | null> {
  await requireAuth();
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const s = await Student.findById(id).lean();
  if (!s) return null;
  return {
    id: String(s._id),
    seq: s.seq ?? null,
    fullName: s.fullName,
    phone: s.phone ?? "",
    parentPhone: s.parentPhone ?? "",
    group: s.group ?? "",
    monthlyFee: s.monthlyFee,
    startDate: s.startDate.toISOString(),
    active: s.active ?? true,
    note: s.note ?? "",
  };
}

/** O'quvchining barcha to'lovlari va boshlagan oyidan joriy oygacha har oy holati. */
export async function getStudentPayments(student: StudentDetail) {
  await requireAuth();
  await connectDB();
  const payments = await Payment.find({ student: student.id }).sort({ paidAt: -1, month: -1 }).lean();
  const rows: PaymentRow[] = payments.map((p) => ({
    id: String(p._id),
    studentId: student.id,
    studentName: student.fullName,
    studentGroup: student.group,
    month: p.month,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    method: (p.method ?? "naqd") as PaymentMethod,
    note: p.note ?? "",
    source: (p.source ?? "site") as "site" | "sheets",
  }));

  const byMonth = new Map<string, number>();
  for (const p of rows) byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);

  const start = monthOfDate(new Date(student.startDate));
  const now = currentMonth();
  // boshlanish oyidan joriy oygacha (ko'pi bilan 36 oy) + oldindan to'langan oylar
  const all = new Set(byMonth.keys());
  for (let i = 0, m = now; i < 36 && compareMonths(m, start) >= 0; i++, m = shiftMonth(m, -1)) all.add(m);
  const months = [...all]
    .sort((a, b) => compareMonths(b, a))
    .map((month) => {
      const paid = byMonth.get(month) ?? 0;
      return { month, paid, status: statusOf(student.monthlyFee, paid) };
    });

  const totalDebt = months
    .filter((x) => compareMonths(x.month, now) <= 0 && compareMonths(x.month, start) >= 0)
    .reduce((sum, x) => sum + Math.max(0, student.monthlyFee - x.paid), 0);
  const totalPaid = rows.reduce((s, r) => s + r.amount, 0);

  return { payments: rows, months, totalDebt, totalPaid };
}

// ---------- To'lovlar ----------

export async function listPayments(month: string, opts: { q: string; method: string }) {
  await requireAuth();
  await connectDB();
  const payments = await Payment.find({ month })
    .sort({ paidAt: -1, createdAt: -1 })
    .populate<{ student: { _id: mongoose.Types.ObjectId; fullName: string; group?: string } | null }>("student", "fullName group")
    .lean();
  const all: PaymentRow[] = payments.map((p) => ({
    id: String(p._id),
    studentId: p.student ? String(p.student._id) : "",
    studentName: p.student?.fullName ?? "(o‘chirilgan)",
    studentGroup: p.student?.group ?? "",
    month: p.month,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    method: (p.method ?? "naqd") as PaymentMethod,
    note: p.note ?? "",
    source: (p.source ?? "site") as "site" | "sheets",
  }));

  const totals = {
    total: all.reduce((s, r) => s + r.amount, 0),
    count: all.length,
    cash: all.filter((r) => r.method === "naqd").reduce((s, r) => s + r.amount, 0),
    nonCash: all.filter((r) => r.method !== "naqd").reduce((s, r) => s + r.amount, 0),
  };
  const nq = normalizeText(opts.q);
  const rows = all.filter(
    (r) =>
      (!opts.method || r.method === opts.method) &&
      (!nq || normalizeText(`${r.studentName} ${r.note} ${r.studentGroup}`).includes(nq)),
  );
  return { rows, totals };
}

/** To'lov formasi uchun: faol o'quvchilar va tanlangan oy atrofidagi to'lovlari. */
export async function listStudentOptions(month: string): Promise<StudentOption[]> {
  await requireAuth();
  await connectDB();
  const [students, agg] = await Promise.all([
    Student.find({ active: true }, { fullName: 1, group: 1, monthlyFee: 1 }).sort({ fullName: 1 }).lean(),
    Payment.aggregate<{ _id: { student: mongoose.Types.ObjectId; month: string }; total: number }>([
      { $match: { month: { $gte: shiftMonth(month, -12), $lte: shiftMonth(month, 12) } } },
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
    group: s.group ?? "",
    fee: s.monthlyFee,
    paid: paid.get(String(s._id)) ?? {},
  }));
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
  await requireAuth();
  await connectDB();
  const [settings, runs] = await Promise.all([getSettings(), findRuns(10)]);
  return { settings, runs: runs.map(toRunView) };
}

/** Yuqoridagi ogohlantirish uchun: oxirgi tekshiruvdagi hal qilinmagan farqlar soni yoki xato. */
export async function getSyncAlert(): Promise<{ unresolved: number; error: string; at: string } | null> {
  await requireAuth();
  await connectDB();
  const last = await SyncRun.findOne({})
    .select("ok error startedAt mismatches.resolved")
    .sort({ startedAt: -1 })
    .lean();
  if (!last) return null;
  const unresolved = (last.mismatches ?? []).filter((m) => !m.resolved).length;
  if (last.ok && unresolved === 0) return null;
  return { unresolved, error: last.ok ? "" : last.error ?? "", at: last.startedAt.toISOString() };
}
