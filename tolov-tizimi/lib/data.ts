import "server-only";
import mongoose from "mongoose";
import { requireAuth } from "./auth";
import { connectDB } from "./db";
import { Payment, Student, SyncRun, type MismatchKind, type PaymentMethod } from "./models";
import { getSettings } from "./sync";
import { compareMonths, currentMonth, monthOfDate, shiftMonth } from "./time";

// ---------- Turlar (client komponentlarga uzatiladigan oddiy obyektlar) ----------

export type PayStatus = "paid" | "partial" | "unpaid";

export type StudentRow = {
  id: string;
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
  month: string;
  amount: number;
  paidAt: string; // ISO
  method: PaymentMethod;
  note: string;
  source: "site" | "sheets";
};

export type MismatchRow = {
  id: string;
  kind: MismatchKind;
  studentId: string | null;
  studentName: string;
  phone: string;
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
  monthFrom: string;
  monthTo: string;
  skipped: { row: number; reason: string }[];
  mismatches: MismatchRow[];
};

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

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- So'rovlar ----------

export async function listGroups(): Promise<string[]> {
  await requireAuth();
  await connectDB();
  const groups = (await Student.distinct("group")) as string[];
  return groups.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Bosh sahifa: tanlangan oy bo'yicha faol o'quvchilarning to'lov holati. */
export async function getMonthOverview(month: string, group: string) {
  await requireAuth();
  await connectDB();
  const filter: Record<string, unknown> = { active: true };
  if (group) filter.group = group;
  const [students, paidMap, collectedAgg] = await Promise.all([
    Student.find(filter).sort({ fullName: 1 }).lean(),
    paidByStudent(month),
    Payment.aggregate<{ total: number; count: number }>([
      { $match: { month } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const rows: StudentRow[] = [];
  for (const s of students) {
    if (compareMonths(monthOfDate(s.startDate), month) > 0) continue; // hali boshlamagan
    const paid = paidMap.get(String(s._id)) ?? 0;
    rows.push({
      id: String(s._id),
      fullName: s.fullName,
      phone: s.phone ?? "",
      group: s.group ?? "",
      monthlyFee: s.monthlyFee,
      active: s.active ?? true,
      paid,
      debt: Math.max(0, s.monthlyFee - paid),
      status: statusOf(s.monthlyFee, paid),
      started: true,
    });
  }

  const expected = rows.reduce((sum, r) => sum + r.monthlyFee, 0);
  const debt = rows.reduce((sum, r) => sum + r.debt, 0);
  return {
    rows,
    totals: {
      students: rows.length,
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

export async function listStudents(opts: { q: string; group: string; status: string }) {
  await requireAuth();
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.status === "active") filter.active = true;
  else if (opts.status === "inactive") filter.active = false;
  if (opts.group) filter.group = opts.group;
  if (opts.q) {
    const re = new RegExp(escapeRegex(opts.q.trim()), "i");
    const digits = opts.q.replace(/\D/g, "");
    filter.$or = [
      { fullName: re },
      { group: re },
      ...(digits.length >= 3 ? [{ phone: new RegExp(digits.split("").join("\\D*")) }] : []),
    ];
  }
  const month = currentMonth();
  const [students, paidMap] = await Promise.all([
    Student.find(filter).sort({ active: -1, fullName: 1 }).limit(1000).lean(),
    paidByStudent(month),
  ]);
  const rows: StudentRow[] = students.map((s) => {
    const paid = paidMap.get(String(s._id)) ?? 0;
    return {
      id: String(s._id),
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
  });
  return { rows, month };
}

export async function getStudent(id: string): Promise<StudentDetail | null> {
  await requireAuth();
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const s = await Student.findById(id).lean();
  if (!s) return null;
  return {
    id: String(s._id),
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
  const payments = await Payment.find({ student: student.id }).sort({ month: -1, paidAt: -1 }).lean();
  const rows: PaymentRow[] = payments.map((p) => ({
    id: String(p._id),
    studentId: student.id,
    studentName: student.fullName,
    month: p.month,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    method: (p.method ?? "naqd") as PaymentMethod,
    note: p.note ?? "",
    source: (p.source ?? "site") as "site" | "sheets",
  }));

  const byMonth = new Map<string, number>();
  for (const p of rows) byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);

  const months: { month: string; paid: number; status: PayStatus }[] = [];
  const start = monthOfDate(new Date(student.startDate));
  const now = currentMonth();
  // boshlanish oyidan joriy oygacha (ko'pi bilan 36 oy) + oldindan to'langan oylar
  const all = new Set(byMonth.keys());
  for (let i = 0, m = now; i < 36 && compareMonths(m, start) >= 0; i++, m = shiftMonth(m, -1)) {
    all.add(m);
  }
  for (const month of [...all].sort((a, b) => compareMonths(b, a))) {
    const paid = byMonth.get(month) ?? 0;
    months.push({ month, paid, status: statusOf(student.monthlyFee, paid) });
  }

  const totalDebt = months
    .filter((x) => compareMonths(x.month, now) <= 0 && compareMonths(x.month, start) >= 0)
    .reduce((sum, x) => sum + Math.max(0, student.monthlyFee - x.paid), 0);

  return { payments: rows, months, totalDebt };
}

export async function listPaymentsForMonth(month: string) {
  await requireAuth();
  await connectDB();
  const payments = await Payment.find({ month })
    .sort({ paidAt: -1, createdAt: -1 })
    .populate<{ student: { _id: mongoose.Types.ObjectId; fullName: string } | null }>("student", "fullName")
    .lean();
  const rows: PaymentRow[] = payments.map((p) => ({
    id: String(p._id),
    studentId: p.student ? String(p.student._id) : "",
    studentName: p.student?.fullName ?? "(o'chirilgan)",
    month: p.month,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    method: (p.method ?? "naqd") as PaymentMethod,
    note: p.note ?? "",
    source: (p.source ?? "site") as "site" | "sheets",
  }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return { rows, total };
}

export async function listStudentOptions() {
  await requireAuth();
  await connectDB();
  const students = await Student.find({ active: true }, { fullName: 1, group: 1, monthlyFee: 1 })
    .sort({ fullName: 1 })
    .lean();
  return students.map((s) => ({
    id: String(s._id),
    label: s.group ? `${s.fullName} — ${s.group}` : s.fullName,
    monthlyFee: s.monthlyFee,
  }));
}

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
    monthFrom: r.monthFrom ?? "",
    monthTo: r.monthTo ?? "",
    skipped: (r.skipped ?? []).map((s) => ({ row: s.row ?? 0, reason: s.reason ?? "" })),
    mismatches: (r.mismatches ?? []).map((m) => ({
      id: String(m._id),
      kind: m.kind as MismatchKind,
      studentId: m.studentId ? String(m.studentId) : null,
      studentName: m.studentName ?? "",
      phone: m.phone ?? "",
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
