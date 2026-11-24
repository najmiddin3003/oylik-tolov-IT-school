import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { endIsoOf, LIVE, studentFee, withDiscounts, type StudentLean } from "@/lib/ledger";
import { studentStatus } from "@/lib/enrollment";
import { Activity, Payment, Student, SyncRun } from "@/lib/models";
import { teacherNames } from "@/lib/staff";
import { searchScore } from "@/lib/normalize";
import { supportAuthorized, supportEnabled } from "@/lib/support";
import { currentMonth, dateToISO, monthOfDate, shiftMonth, todayISO } from "@/lib/time";

// Texnik yordam: o'quvchini ism bo'yicha qidirish (faqat o'qiydi — hech narsa o'zgartirmaydi, SMS yubormaydi).
//   curl -H "Authorization: Bearer $SUPPORT_TOKEN" "https://sayt.uz/api/support/lookup?q=Ism+Familiya"
// Qaytaradi: o'xshash o'quvchilar (holati, kursi, o'qituvchisi, oxirgi oylar to'lovi), oxirgi Sheets tekshiruvidagi
// shu ismli farqlar va o'chirilgan o'quvchilar tarixi.
const MIN_SCORE = 0.6;
const LIMIT = 10;
const MONTHS = 6;
const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  await connection();
  if (!supportEnabled()) return new Response("Not found", { status: 404 });
  if (!supportAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ error: "q (ism) kerak" }, { status: 400, headers: NO_STORE });

  await connectDB();
  const today = todayISO();
  const docs = await Student.find(
    {},
    { fullName: 1, group: 1, monthlyFee: 1, feeHistory: 1, discountHistory: 1, active: 1, startDate: 1, endDate: 1, seq: 1, teacher: 1, sheetNames: 1, createdAt: 1 },
  )
    .limit(5000)
    .lean();
  const scored = docs
    .map((d) => ({ d, score: Math.max(...[d.fullName, ...(d.sheetNames ?? [])].map((n) => searchScore(q, n ?? ""))) }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMIT);

  const ids = scored.map((x) => x.d._id);
  const to = currentMonth();
  const from = shiftMonth(to, -(MONTHS - 1));
  const [payments, teachers, runs, removed] = await Promise.all([
    ids.length ? Payment.find({ ...LIVE, student: { $in: ids }, month: { $gte: from } }, { student: 1, month: 1, amount: 1, paidAt: 1, method: 1, source: 1 }).lean() : [],
    teacherNames(),
    SyncRun.find({ ok: true }, { startedAt: 1, basis: 1, monthFrom: 1, monthTo: 1, dateFrom: 1, dateTo: 1, mismatches: 1 }).sort({ startedAt: -1 }).limit(1).lean(),
    Activity.find({ action: "student.delete" }, { text: 1, at: 1, role: 1 }).sort({ at: -1 }).limit(500).lean(),
  ]);
  const withDisc = await withDiscounts(scored.map((x) => x.d as unknown as StudentLean));

  const students = scored.map((x, i) => {
    const d = x.d;
    const s = withDisc[i];
    const endIso = endIsoOf(d);
    const startMonth = monthOfDate(d.startDate);
    const mine = payments.filter((p) => String(p.student) === String(d._id));
    const months = [];
    for (let m = from; m <= to; m = shiftMonth(m, 1)) {
      if (m < startMonth) continue;
      const fee = studentFee(s, m);
      const paid = mine.filter((p) => p.month === m).reduce((a, p) => a + p.amount, 0);
      months.push({ month: m, fee, paid, payments: mine.filter((p) => p.month === m).map((p) => ({ amount: p.amount, paidAt: dateToISO(p.paidAt), method: p.method, source: p.source })) });
    }
    return {
      id: String(d._id),
      seq: d.seq ?? null,
      fullName: d.fullName,
      sheetNames: d.sheetNames ?? [],
      score: Math.round(x.score * 100) / 100,
      group: d.group ?? "",
      teacher: d.teacher ? (teachers.get(String(d.teacher)) ?? String(d.teacher)) : null,
      status: studentStatus(d.active, endIso, today),
      startDate: dateToISO(d.startDate),
      endDate: endIso,
      months,
    };
  });

  const run = runs[0];
  const mismatches = (run?.mismatches ?? [])
    .map((m) => ({ m, score: searchScore(q, m.studentName ?? "") }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ m, score }) => ({
      score: Math.round(score * 100) / 100,
      kind: m.kind,
      studentName: m.studentName,
      studentId: m.studentId ? String(m.studentId) : null,
      group: m.group,
      month: m.month,
      siteAmount: m.siteAmount,
      sheetAmount: m.sheetAmount,
      sheetDate: m.sheetDate,
      sheetRows: m.sheetRows,
      resolved: m.resolved,
      ignored: m.ignored,
    }));

  const deleted = removed
    .map((a) => ({ a, score: searchScore(q, (a.text ?? "").replace(/^O‘chirildi:\s*/, "").replace(/\s*\(.*$/, "")) }))
    .filter((x) => x.score >= MIN_SCORE)
    .slice(0, 10)
    .map(({ a }) => ({ text: a.text, at: a.at.toISOString(), role: a.role }));

  return Response.json(
    {
      query: q,
      today,
      students,
      lastSync: run ? { startedAt: run.startedAt.toISOString(), basis: run.basis, monthFrom: run.monthFrom, monthTo: run.monthTo, dateFrom: run.dateFrom, dateTo: run.dateTo, mismatches } : null,
      deleted,
    },
    { headers: NO_STORE },
  );
}
