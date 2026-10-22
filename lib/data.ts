import "server-only";
import mongoose from "mongoose";
import { cache } from "react";
import { listMyActivity, type ActivityRow } from "./activity";
import { requireAuth, requireOwner, requireRole, type Session } from "./auth";
import { nameMatches } from "./compare";
import { courseFee, courseNames, courseTeacher, courseTeachers, sameCourse, teacherCourses } from "./courses";
import { connectDB } from "./db";
import { eskizConfigured } from "./eskiz";
import { changesAfter, type FeeChange } from "./fees";
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
import { cashierKassa, kassaState } from "./kassa";
import { Handover, Payment, Salary, SmsLog, Staff, Student, SyncRun, Task, type MismatchKind, type PaymentMethod } from "./models";
import { monthCollections, monthSalaries, staffPay, toSalaryRow, type SalaryRow, type StaffPay } from "./pay";
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
import type { Role } from "./session";
import { activeStaffRoles, getStaffById, listStaff, listTeachers, salaryHistoryOf, shareHistoryOf, teacherNames, toStaffView, type StaffView } from "./staff";
import type { StaffStatus } from "./staff-rules";
import { latestTasksByMonth, tasksFor, type TaskRow } from "./tasks";
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
  /** O'qituvchisi */
  teacherId: string | null;
  teacherName: string;
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
  /** Qachon kiritilgan (yangilari tepada) */
  createdAt: string;
  archivedAt: string | null;
  archivedBy: "owner" | "admin" | null;
};

export type StudentOption = {
  id: string;
  name: string;
  /** Kursi (to'lov formasida avval kurs tanlanadi) */
  group: string;
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
  /** «Saytda yo'q o'quvchi»: saytda ismi (yoki Sheets'dagi bog'langan ismi) aynan mos o'quvchilar */
  siteMatches?: StudentPick[];
  /** «Saytda yo'q o'quvchi»: ismi o'xshash yozilgan o'quvchilar (taklif) */
  similar?: StudentPick[];
};

/** Sheets yozuvini biriktirish uchun o'quvchi tanlovi. */
export type StudentPick = { id: string; seq: number | null; name: string; group: string; active: boolean };

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
  /** Kurslar bo'yicha statistika (eski tekshiruvlarda — bo'sh) */
  courseStats: { course: string; rows: number; matched: number; ignored: number }[];
  skipped: { row: number; reason: string }[];
  mismatches: MismatchRow[];
  /** Sheets'dan avtomatik qo'shilgan to'lov qatorlari */
  autoImported: number;
};

export type SyncState = "ok" | "warn" | "error" | "off";

export type NavCounts = {
  role: Role;
  students?: number;
  payments: number;
  sync?: SyncState;
  staff?: number;
  /** Rahbar: qabul qilinishi kutilayotgan kassa topshiruvlari; administrator: ochiq topshiriqlar */
  kassa?: number;
  tasks?: number;
};

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
  createdAt?: Date | null;
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
    createdAt: (p.createdAt ?? p.paidAt).toISOString(),
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
    archivedBy: p.archivedBy === "admin" || p.archivedBy === "owner" ? p.archivedBy : null,
  };
}

function findPayments(filter: Record<string, unknown>, sort: Record<string, 1 | -1>, limit = 5000) {
  return Payment.find(filter)
    .sort(sort)
    .limit(limit)
    .populate<{ student: PopulatedPayment["student"] }>("student", "fullName group")
    .lean<PopulatedPayment[]>();
}

function toUnpaid(r: StudentRow): UnpaidStudent {
  return { id: r.id, name: r.fullName, phone: r.phone, fee: r.monthlyFee, paid: r.paid, debt: r.debt, status: r.status, lessons: r.lessons };
}

// ---------- Kim ko'ryapti ----------

/** Joriy foydalanuvchi: o'qituvchi bo'lsa — faqat o'z o'quvchilari ko'rinadi (teacherId). */
const viewer = cache(async () => {
  const s = await requireAuth();
  return { ...s, teacherId: s.role === "teacher" ? s.staffId : null };
});
type Viewer = Awaited<ReturnType<typeof viewer>>;

/**
 * Ko'rinadigan o'quvchilar. O'qituvchi — faqat o'ziniki. Rahbar `teacher` filtri bilan
 * bitta o'qituvchinikini ("none" — o'qituvchi biriktirilmaganlarni) ko'radi.
 */
async function visibleStudents(v: Viewer, teacher = ""): Promise<StudentLean[]> {
  const all = await loadStudents();
  const t = v.teacherId ?? teacher;
  if (!t) return all;
  if (t === "none") return all.filter((s) => !s.teacher);
  return all.filter((s) => String(s.teacher ?? "") === t);
}

// ---------- Umumiy ----------

export async function listGroups(): Promise<string[]> {
  const v = await requireRole(["owner", "teacher"]).then(() => viewer());
  await connectDB();
  const students = await visibleStudents(v);
  return [...new Set(students.map((s) => s.group ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Yon menyudagi son belgilari (rolga qarab). */
export const getNavCounts = cache(async (): Promise<NavCounts> => {
  const v = await viewer();
  const role = v.role;
  await connectDB();
  const month = currentMonth();
  if (role === "admin") {
    const [payments, tasks] = await Promise.all([Payment.countDocuments({ ...LIVE, month }), Task.countDocuments({ toRole: "admin", status: "open" })]);
    return { role, payments, tasks };
  }
  if (role === "teacher") {
    const mine = await visibleStudents(v);
    return {
      role,
      students: mine.filter((s) => s.active ?? true).length,
      payments: await Payment.countDocuments({ ...LIVE, month, student: { $in: mine.map((s) => s._id) } }),
    };
  }
  const [students, payments, settings, last, staff, kassa] = await Promise.all([
    Student.countDocuments({ active: true }),
    Payment.countDocuments({ ...LIVE, month }),
    getSettings(),
    SyncRun.findOne({}).select("ok mismatches.resolved").sort({ startedAt: -1 }).lean(),
    Staff.countDocuments({ status: { $ne: "disabled" } }),
    Handover.countDocuments({ status: "pending" }),
  ]);
  let sync: SyncState = "off";
  if (settings.sheetUrl && last) {
    if (!last.ok) sync = "error";
    else sync = (last.mismatches ?? []).some((m) => !m.resolved) ? "warn" : "ok";
  }
  return { role, students, payments, sync, staff, kassa };
});

// ---------- Oy bo'yicha umumiy holat (bosh sahifa va to'lovlar sahifasi) ----------

/**
 * Tanlangan oy bo'yicha faol o'quvchilarning to'lov holati va tushum. O'qituvchiga — faqat o'z o'quvchilari;
 * rahbar `teacher` bilan bitta o'qituvchi bo'yicha ko'radi.
 */
export const getMonthOverview = cache(async (month: string, group = "", teacher = "") => {
  const v = await viewer();
  await connectDB();
  const [students, agg] = await Promise.all([
    visibleStudents(v, teacher),
    Payment.aggregate<{ _id: { student: mongoose.Types.ObjectId; method: string }; total: number; count: number }>([
      { $match: { ...LIVE, month } },
      { $group: { _id: { student: "$student", method: "$method" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  const inGroup = new Set(students.filter((s) => !group || (s.group ?? "") === group).map((s) => String(s._id)));
  // O'qituvchiga boshqa o'quvchilarning to'lovlari umuman berilmaydi
  const own = v.teacherId ? new Set(students.map((s) => String(s._id))) : null;
  const restricted = Boolean(group || teacher || v.teacherId);

  const paidMap = new Map<string, number>();
  let collected = 0;
  let paymentCount = 0;
  let cash = 0;
  for (const a of agg) {
    const id = String(a._id.student);
    if (own && !own.has(id)) continue;
    paidMap.set(id, (paidMap.get(id) ?? 0) + a.total);
    // Filtr bo'lmasa — hamma to'lovlar (o'quvchisi topilmaganlari ham) tushumga kiradi
    if (restricted && !inGroup.has(id)) continue;
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

// ---------- Xodimlar oyligi ----------

export type PayView = StaffPay & { name: string; role: Role; status: StaffStatus; salaries: SalaryRow[] };

/** Xodimning shu oydagi oyligi: o'zi yoki rahbar ko'radi. */
export async function getStaffPay(staffId: string, month: string): Promise<PayView | null> {
  const v = await viewer();
  if (v.role !== "owner" && v.staffId !== staffId) return null;
  const staff = await getStaffById(staffId);
  if (!staff) return null;
  const [pay, salaries] = await Promise.all([staffPay(staff, month), monthSalaries(month)]);
  return { ...pay, name: staff.name, role: staff.role, status: staff.status, salaries: salaries.get(staffId) ?? [] };
}

export type TeamMember = StaffView & {
  pay: StaffPay;
  /** O'qituvchi: shu oyda to'lashi kerak bo'lgan o'quvchilari bo'yicha */
  students: number;
  paidCount: number;
  debtors: number;
  debt: number;
  expected: number;
};

/** Rahbar paneli: har bir xodim (o'quvchilari, tushumi, oyligi) va markaz bo'yicha jami. */
export async function getTeamOverview(month: string) {
  await requireOwner();
  await connectDB();
  const [{ rows, totals }, staffDocs, collections] = await Promise.all([getMonthOverview(month), listStaff(), monthCollections(month)]);
  const byTeacher = new Map<string, StudentRow[]>();
  for (const r of rows) {
    const key = r.teacherId ?? "";
    byTeacher.set(key, [...(byTeacher.get(key) ?? []), r]);
  }
  const stats = (list: StudentRow[]) => ({
    students: list.length,
    paidCount: list.filter((r) => r.status === "paid").length,
    debtors: list.filter((r) => r.status !== "paid").length,
    debt: list.reduce((s, r) => s + r.debt, 0),
    expected: list.reduce((s, r) => s + r.monthlyFee, 0),
  });
  const members: TeamMember[] = [];
  for (const d of staffDocs) {
    if (d.status === "disabled") continue;
    members.push({ ...toStaffView(d), pay: await staffPay(d, month), ...stats(byTeacher.get(String(d._id)) ?? []) });
  }
  const order: Record<Role, number> = { owner: 0, teacher: 1, admin: 2 };
  members.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  const staffShare = members.reduce((s, m) => s + m.pay.share, 0);
  const unassigned = { ...stats(byTeacher.get("") ?? []), collected: collections.unassigned };
  // Shu oy hisobidan berilgan avans va oyliklar (barcha xodimlar)
  const salaries = [...(await monthSalaries(month)).values()].flat();
  const given = {
    avans: salaries.filter((x) => x.kind === "avans").reduce((s, x) => s + x.amount, 0),
    oylik: salaries.filter((x) => x.kind === "oylik").reduce((s, x) => s + x.amount, 0),
    count: salaries.length,
  };
  return {
    members,
    unassigned,
    totals,
    finance: { collected: totals.collected, staffShare, centerLeft: totals.collected - staffShare, given },
  };
}

/**
 * Oy oxiri eslatmalari: joriy oy — oy tugashiga 10 kun qolganda; o'tgan oy — to'lamaganlar qolgan bo'lsa.
 */
export const getReminders = cache(async (): Promise<Reminder[]> => {
  const v = await viewer();
  await connectDB();
  const today = todayISO();
  const current = today.slice(0, 7);
  const months = monthEndReminderActive(today) ? [current, shiftMonth(current, -1)] : [shiftMonth(current, -1)];
  const students = await visibleStudents(v);
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

/** O'quvchilar bo'limlari: hammasi, qarzdorlar (to'lamagan + qisman), to'laganlar, to'lamaganlar, qisman to'laganlar */
export type StudentTab = "all" | "debt" | "paid" | "unpaid" | "partial";

/** URL dagi `tab` qiymati (noma'lum — "all"). */
export function parseStudentTab(v: string): StudentTab {
  return v === "debt" || v === "paid" || v === "unpaid" || v === "partial" ? v : "all";
}
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
  /** Rahbar uchun: o'qituvchi bo'yicha ("none" — biriktirilmaganlar) */
  teacher?: string;
}) {
  await requireRole(["owner", "teacher"]);
  const v = await viewer();
  await connectDB();
  const teacher = v.teacherId ? "" : (opts.teacher ?? "");
  const [{ debtors, rows: current, paid }, students] = await Promise.all([getMonthOverview(opts.month, "", teacher), visibleStudents(v, teacher)]);
  const paidMap = new Map(Object.entries(paid));
  const all = students.map((s) => toRow(s, paidMap, opts.month));

  const today = tashkentClock(nowMs()).weekday;
  // Yuqoridagi kartalar: filtrlardan qat'i nazar (pul summalarisiz)
  const activeRows = all.filter((r) => r.active);
  const stats = {
    total: all.length,
    activeThisMonth: current.length,
    courses: new Set(activeRows.map((r) => r.group.trim().toLowerCase()).filter(Boolean)).size,
    today: activeRows.filter((r) => lessonOn(r.lessons, today)).length,
    debtors: debtors.length,
  };

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
  const owing = (r: StudentRow) => r.active && r.started;
  const tabTest: Record<StudentTab, (r: StudentRow) => boolean> = {
    all: () => true,
    debt: (r) => owing(r) && r.status !== "paid",
    paid: (r) => owing(r) && r.status === "paid",
    unpaid: (r) => owing(r) && r.status === "unpaid",
    partial: (r) => owing(r) && r.status === "partial",
  };
  const counts = {
    all: filtered.length,
    debt: filtered.filter(tabTest.debt).length,
    paid: filtered.filter(tabTest.paid).length,
    unpaid: filtered.filter(tabTest.unpaid).length,
    partial: filtered.filter(tabTest.partial).length,
  };

  const tabRows = filtered.filter(tabTest[opts.tab] ?? tabTest.all);
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

/** Yuqoridagi tezkor qidiruv uchun (rahbar — hammasi, o'qituvchi — o'z o'quvchilari). */
export async function searchStudents(q: string, limit = 8) {
  await requireRole(["owner", "teacher"]);
  const v = await viewer();
  if (!q.trim()) return [];
  await connectDB();
  const students = await visibleStudents(v);
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
  const v = await viewer();
  if (v.role === "admin" || !mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const s = await Student.findById(id).lean<StudentLean & { parentPhone?: string | null; note?: string | null }>();
  if (!s) return null;
  // O'qituvchi — faqat o'z o'quvchisini
  if (v.teacherId && String(s.teacher ?? "") !== v.teacherId) return null;
  const teacherId = s.teacher ? String(s.teacher) : null;
  return {
    teacherId,
    teacherName: teacherId ? ((await teacherNames()).get(teacherId) ?? "") : "",
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
  await requireRole(["owner", "admin", "teacher"]);
  await connectDB();
  // O'qituvchiga — faqat o'z o'quvchilarining jadvallaridan
  const students = await visibleStudents(await viewer());
  return popularSchedules(students.filter((s) => s.active ?? true).map((s) => normalizeLessons(s.lessons))).map((t) => t.lessons);
}

/** O'quvchining barcha to'lovlari va boshlagan oyidan joriy oygacha har oy holati. */
export async function getStudentPayments(student: StudentDetail) {
  await requireRole(["owner", "teacher"]);
  const v = await viewer();
  if (v.teacherId && student.teacherId !== v.teacherId) return { payments: [], months: [], totalDebt: 0, totalPaid: 0 };
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

export type PaymentFilter = {
  q: string;
  method: string;
  day: string;
  /** true — barcha oylar to'lovlari (tanlangan oy emas) */
  all?: boolean;
};

/**
 * To'lovlar tarixi: tanlangan oy uchun to'lovlar. Kun tanlansa — o'sha kuni qabul qilingan
 * barcha to'lovlar (qaysi oy uchunligidan qat'i nazar).
 */
export async function listPayments(month: string, f: PaymentFilter) {
  const v = await viewer();
  await connectDB();
  const dayStart = f.day ? isoToDate(f.day) : null;
  // O'qituvchiga — faqat o'z o'quvchilarining to'lovlari
  const own = v.teacherId ? { student: { $in: (await visibleStudents(v)).map((s) => s._id) } } : {};
  const filter = dayStart
    ? { ...LIVE, ...own, paidAt: { $gte: dayStart, $lt: new Date(dayStart.getTime() + 24 * 3600_000) } }
    : f.all
      ? { ...LIVE, ...own }
      : { ...LIVE, ...own, month };
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

/** To'lov formasi uchun (rahbar va administrator): faol o'quvchilar va tanlangan oy atrofidagi to'lovlari. */
export async function listStudentOptions(month: string): Promise<StudentOption[]> {
  await requireRole(["owner", "admin"]);
  await connectDB();
  const [students, agg] = await Promise.all([
    Student.find({ active: true }, { fullName: 1, monthlyFee: 1, feeHistory: 1, group: 1 }).sort({ fullName: 1 }).lean<StudentLean[]>(),
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
    group: s.group ?? "",
    monthlyFee: s.monthlyFee,
    feeHistory: feeHistoryOf(s),
    paid: paid.get(String(s._id)) ?? {},
  }));
}

// ---------- Sozlamalar ----------

export async function getSettingsPageData(month: string) {
  const session = await requireOwner();
  await connectDB();
  const [settings, logs, students, roles, syncAlert, teachers, names] = await Promise.all([
    getSettings({ fresh: true }),
    SmsLog.find({}).sort({ createdAt: -1 }).limit(8).lean(),
    Student.find({}, { monthlyFee: 1, feeHistory: 1, group: 1, active: 1, teacher: 1 }).lean<StudentLean[]>(),
    activeStaffRoles(),
    syncAlertOn(session),
    listTeachers(),
    teacherNames(),
  ]);
  const active = students.filter((s) => s.active !== false);

  // Joriy oy narxlari: qaysi narxda nechta o'quvchi
  const now = currentMonth();
  const fees = new Map<number, number>();
  for (const s of active) {
    const fee = studentFee(s, now);
    fees.set(fee, (fees.get(fee) ?? 0) + 1);
  }
  const feeGroups = [...fees.entries()].map(([fee, count]) => ({ fee, count })).sort((a, b) => b.count - a.count || b.fee - a.fee);
  const courses = courseNames(settings.courses, active.map((s) => s.group ?? "")).map((name) => ({
    name,
    fee: courseFee(settings.courses, name),
    teachers: courseTeachers(settings.courses, name),
    inList: settings.courses.some((c) => sameCourse(c.name, name)),
    students: active.filter((s) => sameCourse(s.group, name)).length,
    /** Kursdagi o'qituvchisiz o'quvchilar (nofaollari bilan) — kursga yagona o'qituvchi tanlansa, ular unga o'tadi */
    unassigned: students.filter((s) => !s.teacher && sameCourse(s.group, name)).length,
  }));
  // Kurs o'qituvchisi tanlash ro'yxati: faol o'qituvchilar + kirishi o'chirilgan bo'lsa ham hozir kursga biriktirilganlar
  const teacherChoices = [
    ...teachers,
    ...[...new Set(settings.courses.flatMap((c) => c.teachers))]
      .filter((id) => !teachers.some((t) => t.id === id) && names.has(id))
      .map((id) => ({ id, name: names.get(id)!, status: "disabled" as StaffStatus })),
  ];

  return {
    centerName: settings.centerName,
    courses,
    teachers: teacherChoices,
    features: settings.features,
    autoImport: settings.autoImport,
    syncAlert,
    /** Yangi o'quvchilar uchun standart narx: hozirgi va rejalashtirilgan o'zgarishlar */
    standardNow: standardFee(settings, now),
    standardNext: changesAfter(settings.feeSchedule, now),
    feeGroups,
    feeChanges: [...settings.feeChanges].reverse().slice(0, 10),
    ownerPasswordInDb: Boolean(settings.ownerPasswordHash),
    /** Eski umumiy parollar hali ishlaydimi (shu roldagi faol xodim profili yo'q) */
    legacy: { owner: !roles.has("owner"), admin: !roles.has("admin") },
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
    courseStats: (r.courseStats ?? []).map((c) => ({ course: c.course ?? "", rows: c.rows ?? 0, matched: c.matched ?? 0, ignored: c.ignored ?? 0 })),
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
  const views = runs.map(toRunView);
  // Oxirgi tekshiruvdagi «saytda yo'q o'quvchi»lar: saytda hozir shu ismli yoki o'xshash ismli o'quvchi bormi
  // (ism tekshiruvdan keyin to'g'rilangan bo'lishi yoki Sheets'da boshqacha yozilgan bo'lishi mumkin)
  const unknown = (views[0]?.mismatches ?? []).filter((m) => m.kind === "unknown_student" && !m.resolved);
  let students: StudentPick[] = [];
  if (unknown.length) {
    const docs = await Student.find({}, { fullName: 1, group: 1, sheetNames: 1, active: 1, seq: 1 }).sort({ fullName: 1, seq: 1 }).lean();
    const candidates = docs.map((d) => ({
      id: String(d._id),
      seq: d.seq ?? null,
      fullName: d.fullName,
      group: d.group ?? "",
      aliases: d.sheetNames ?? [],
      active: d.active !== false,
    }));
    const pick = (c: (typeof candidates)[number]): StudentPick => ({ id: c.id, seq: c.seq, name: c.fullName, group: c.group, active: c.active });
    for (const m of unknown) {
      const { exact, similar } = nameMatches(m.studentName, candidates);
      m.siteMatches = exact.map(pick);
      m.similar = similar.map(pick);
    }
    students = candidates.map(pick);
  }
  return {
    settings: {
      sheetUrl: settings.sheetUrl,
      columns: settings.columns,
      courseFilter: settings.courseFilter,
      autoImport: settings.autoImport,
      courses: settings.courses.map((c) => c.name),
    },
    runs: views,
    /** Biriktirish tanlovi uchun (faqat «saytda yo'q o'quvchi» bo'lsa) */
    students,
  };
}

/** Ogohlantirish uchun: oxirgi tekshiruvdagi hal qilinmagan farqlar soni yoki xato (faqat rahbar ko'radi). */
export const getSyncAlert = cache(async (): Promise<{ unresolved: number; error: string; at: string } | null> => {
  const session = await requireAuth();
  if (session.role !== "owner") return null;
  if (!(await syncAlertOn(session))) return null;
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

// ---------- Xodimlar ----------

export type StaffRowView = StaffView & {
  students: number;
  /** O'qituvchi biriktirilgan kurslar (Sozlamalar → Kurslar) */
  courses: string[];
};

/** «Xodimlar» sahifasi (rahbar): ro'yxat, o'qituvchilarning o'quvchilari soni, eski ulush yozuvlari. */
export async function getStaffPageData() {
  await requireOwner();
  await connectDB();
  const [docs, students, settings, legacySalaries] = await Promise.all([
    listStaff(),
    loadStudents(),
    getSettings({ fresh: true }),
    Salary.countDocuments({ staff: null }),
  ]);
  const counts = new Map<string, number>();
  let unassigned = 0;
  for (const st of students) {
    if (st.active === false) continue;
    if (st.teacher) counts.set(String(st.teacher), (counts.get(String(st.teacher)) ?? 0) + 1);
    else unassigned++;
  }
  const order: Record<Role, number> = { owner: 0, teacher: 1, admin: 2 };
  const staff: StaffRowView[] = docs
    .map((d) => ({
      ...toStaffView(d),
      students: counts.get(String(d._id)) ?? 0,
      courses: settings.courses.filter((c) => c.teachers.includes(String(d._id))).map((c) => c.name),
    }))
    .sort((a, b) => Number(a.status === "disabled") - Number(b.status === "disabled") || order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  return {
    staff,
    /** Yangi o'qituvchi formasidagi «Kursi» tanlovi: kurslar va hozirgi o'qituvchilari */
    courses: settings.courses.map((c) => ({ name: c.name, teacherNames: c.teachers.flatMap((t) => (nameOf.has(t) ? [nameOf.get(t)!] : [])) })),
    unassignedStudents: unassigned,
    /** Eski (bitta o'qituvchi uchun) ulush foizi va xodimga biriktirilmagan oylik/avans yozuvlari */
    legacy:
      !settings.legacyPayStaff && (legacySalaries > 0 || settings.shareHistory.length > 0)
        ? { salaries: legacySalaries, shareHistory: settings.shareHistory }
        : null,
  };
}

/** Bitta xodim (rahbar uchun): ma'lumotlari, shu oydagi oyligi va olgan oylik/avanslari. */
export async function getStaffDetail(id: string, month: string) {
  await requireOwner();
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const doc = await getStaffById(id);
  if (!doc) return null;
  const [pay, salaries, students] = await Promise.all([staffPay(doc, month), monthSalaries(month), loadStudents()]);
  const mine = students.filter((st) => String(st.teacher ?? "") === id && st.active !== false);
  return {
    staff: toStaffView(doc),
    pay,
    salaries: salaries.get(id) ?? [],
    students: mine.length,
    shareHistory: [...shareHistoryOf(doc)].sort((a, b) => compareMonths(b.from, a.from)),
    /** Belgilangan oylik tarixi (administrator) — eng yangisi tepada */
    salaryHistory: [...salaryHistoryOf(doc)].sort((a, b) => compareMonths(b.from, a.from)),
  };
}

/** «Profilim» (xodim): o'z ma'lumotlari, oyligi va olgan oylik/avanslari. */
export async function getMyProfile(month: string) {
  const v = await viewer();
  if (!v.staffId) return null;
  await connectDB();
  const doc = await getStaffById(v.staffId);
  if (!doc) return null;
  const [pay, salaries, students] = await Promise.all([staffPay(doc, month), monthSalaries(month), loadStudents()]);
  return {
    staff: toStaffView(doc),
    pay,
    salaries: salaries.get(v.staffId) ?? [],
    students: students.filter((st) => String(st.teacher ?? "") === v.staffId && st.active !== false).length,
  };
}

/** Tezkor o'quvchi qo'shish oynasi uchun o'qituvchilar (rahbar va administrator). */
export async function listTeacherChoices(): Promise<{ id: string; name: string; status: StaffStatus }[]> {
  await requireRole(["owner", "admin"]);
  return listTeachers();
}

/** O'quvchi formasi va ro'yxat filtri uchun o'qituvchilar (rahbar). */
export async function listTeacherOptions(): Promise<{ id: string; name: string; status: StaffStatus }[]> {
  await requireOwner();
  return listTeachers();
}

// ---------- Shaxsiy sozlamalar ----------

/** Google Sheets ogohlantiruvi shu foydalanuvchi uchun yoqilganmi (standart — ha). */
export async function syncAlertOn(session: Session): Promise<boolean> {
  if (session.staffId) {
    const staff = await getStaffById(session.staffId);
    return staff?.prefs?.syncAlert !== false;
  }
  return (await getSettings()).legacyPrefs.syncAlert;
}

// ---------- Kurslar ----------

export type CourseOption = {
  name: string;
  fee: number | null;
  students: number;
  /** Sozlamalar → Kurslar ro'yxatida bormi (yo'q — faqat o'quvchilarda uchraydigan eski nom) */
  inList: boolean;
  /** Kursning yagona o'qituvchisi (o'quvchi formasida o'zi tanlanadi); o'qituvchi yo'q yoki bir nechta bo'lsa — null */
  teacher: string | null;
  /** Kursning barcha o'qituvchilari (rahbar va administratorga; kirishi o'chirilganlar bundan mustasno) */
  teachers: string[];
};

/** Kurslar (tanlash ro'yxatlari uchun): sozlamalardagilar + o'quvchilarda uchraydiganlar, faol o'quvchilar soni bilan. */
export async function listCourses(): Promise<CourseOption[]> {
  const session = await requireRole(["owner", "admin", "teacher"]);
  await connectDB();
  const [settings, students, teachers] = await Promise.all([getSettings(), loadStudents(), session.role === "teacher" ? [] : listTeachers()]);
  const active = students.filter((s) => s.active !== false);
  const usable = new Set(teachers.map((t) => t.id));
  return courseNames(settings.courses, active.map((s) => s.group ?? "")).map((name) => {
    const teacher = courseTeacher(settings.courses, name);
    return {
      name,
      fee: courseFee(settings.courses, name),
      students: active.filter((s) => sameCourse(s.group, name)).length,
      inList: settings.courses.some((c) => sameCourse(c.name, name)),
      teacher: teacher && usable.has(teacher) ? teacher : null,
      teachers: courseTeachers(settings.courses, name).filter((t) => usable.has(t)),
    };
  });
}

/** O'qituvchining o'z kurslari (nomi va rahbar belgilagan narxi) — «O'quvchilarim» sahifasidagi «Yangi o'quvchi» oynasi uchun. */
export async function listMyCourses(): Promise<{ name: string; fee: number | null }[]> {
  const session = await requireRole(["teacher"]);
  const settings = await getSettings();
  return teacherCourses(settings.courses, session.staffId).map((c) => ({ name: c.name, fee: c.fee }));
}

// ---------- To'lov formasi sozlamasi ----------

/** «To'langan sana» maydoni shu rolda ko'rsatiladimi (rahbar Sozlamalar → Funksiyalar bo'limida o'zgartiradi). */
export async function canPickPaymentDate(role: Role): Promise<boolean> {
  const { features } = await getSettings();
  return role === "owner" ? features.paymentDate.owner : role === "admin" ? features.paymentDate.admin : false;
}

// ---------- Topshiriqlar ----------

/** Administrator: rahbardan kelgan topshiriqlar (ochiqlari va yaqinda bajarilganlari). */
export async function getMyTasks(): Promise<TaskRow[]> {
  const s = await requireAuth();
  if (s.role !== "admin") return [];
  return tasksFor("admin");
}

/** Rahbar: eslatma bannerida — har oy uchun yuborilgan topshiriq holati. */
export async function getTaskStatus(months: string[]): Promise<Record<string, TaskRow>> {
  const s = await requireAuth();
  if (s.role !== "owner") return {};
  return latestTasksByMonth(months);
}

// ---------- Kassa ----------

/** «Kassa» sahifasi: administrator — o'z kassasi; rahbar — barcha kassalar va qabul qilinishi kutilayotganlar. */
export async function getKassaPageData() {
  const s = await requireRole(["owner", "admin"]);
  if (s.role === "admin") return { role: "admin" as const, ...(await cashierKassa(s.staffId)) };
  return { role: "owner" as const, ...(await kassaState()) };
}

/** Administratorning kassasi (To'lovlar sahifasidagi ixcham karta uchun). */
export async function getMyKassa() {
  const s = await requireRole(["admin"]);
  return cashierKassa(s.staffId);
}

/** Rahbar paneli: qabul qilinishi kutilayotgan topshiruvlar va kassa holati. */
export async function getOwnerKassa() {
  await requireOwner();
  return kassaState();
}

// ---------- Olingan avans/oylik (xodimning o'zi) ----------

/** «Olingan avans/oylik»: barcha olgan pullari oylar bo'yicha va har oy oyligi (o'qituvchi, administrator). */
export async function getMySalaryHistory() {
  const v = await viewer();
  if (!v.staffId || v.role === "owner") return null;
  await connectDB();
  const doc = await getStaffById(v.staffId);
  if (!doc) return null;
  const docs = await Salary.find({ staff: v.staffId }).sort({ date: -1, createdAt: -1 }).lean();
  const rows = docs.map(toSalaryRow);
  const months = [...new Set([currentMonth(), ...rows.map((r) => r.month)])].sort((a, b) => compareMonths(b, a)).slice(0, 24);
  const byMonth = await Promise.all(
    months.map(async (month) => ({
      month,
      pay: await staffPay(doc, month),
      salaries: rows.filter((r) => r.month === month),
    })),
  );
  return {
    staff: toStaffView(doc),
    months: byMonth,
    total: { avans: rows.filter((r) => r.kind === "avans").reduce((s, r) => s + r.amount, 0), oylik: rows.filter((r) => r.kind === "oylik").reduce((s, r) => s + r.amount, 0) },
  };
}

// ---------- Faoliyat jurnali ----------

/** Joriy foydalanuvchining amallari (faqat o'ziniki). */
export async function getMyActivity(opts: { group?: string; before?: string; limit?: number } = {}): Promise<ActivityRow[]> {
  const s = await requireAuth();
  const before = opts.before ? new Date(opts.before) : undefined;
  return listMyActivity(s, { group: opts.group, before: before && !Number.isNaN(before.getTime()) ? before : undefined, limit: opts.limit });
}

// ---------- Qo'ng'iroqcha ----------

export type BellHandover = { id: string; fromName: string; cash: number; card: number; createdAt: string };

/** Qo'ng'iroqcha uchun: administratorga — ochiq topshiriqlar; rahbarga — qabul qilinishi kutilayotgan kassa topshiruvlari. */
export const getBellExtras = cache(async (): Promise<{ tasks: TaskRow[]; handovers: BellHandover[] }> => {
  const s = await requireAuth();
  if (s.role === "admin") return { tasks: (await tasksFor("admin")).filter((t) => t.status === "open"), handovers: [] };
  if (s.role !== "owner") return { tasks: [], handovers: [] };
  await connectDB();
  const docs = await Handover.find({ status: "pending" }).sort({ createdAt: -1 }).limit(10).lean();
  return {
    tasks: [],
    handovers: docs.map((h) => ({
      id: String(h._id),
      fromName: h.fromName || "Administrator",
      cash: h.cash ?? 0,
      card: h.card ?? 0,
      createdAt: (h.createdAt ?? new Date()).toISOString(),
    })),
  };
});
