// Sheets farqlaridan saytga o'quvchi va to'lovlarni import qilish.
import mongoose from "mongoose";
import { allocateAmount, importFromMonth } from "./allocate";
import { connectDB } from "./db";
import { LIVE, studentFee, type StudentLean } from "./ledger";
import { Payment, Student, SyncRun, type PaymentMethod } from "./models";
import { nameKey } from "./normalize";
import { nextStudentSeq } from "./seq";
import { isoToDate, monthOfDate } from "./time";

export type ImportResult = { students: number; payments: number; resolved: number; skipped: string[] };

type Part = { row: number; date: string; amount: number; cash: number; card: number };

/** Naqd va plastik alohida yozilgan bo'lsa — ikki to'lov, aks holda bitta. */
function splitByMethod(p: Part): { amount: number; method: PaymentMethod }[] {
  if (p.cash > 0 && p.card > 0 && p.cash + p.card === p.amount) {
    return [
      { amount: p.cash, method: "naqd" },
      { amount: p.card, method: "karta" },
    ];
  }
  if (p.card > 0 && !(p.cash > 0) && p.card === p.amount) return [{ amount: p.amount, method: "karta" }];
  return [{ amount: p.amount, method: "naqd" }];
}

/**
 * Tekshiruv natijasidagi «Saytda yo'q» va «Noma'lum o'quvchi» farqlarini saytga qo'shadi:
 * - noma'lum o'quvchi bo'lsa — yangi o'quvchi yaratiladi (ism, kurs → guruh, kurs narxi → oylik to'lov);
 * - har bir Sheets qatori alohida to'lov bo'ladi (to'lov sanasi bilan), summa oylarga taqsimlanadi.
 * `ids` = "all" bo'lsa — hammasi.
 */
export async function importFromRun(runId: string, ids: string[] | "all"): Promise<ImportResult | null> {
  if (!mongoose.isValidObjectId(runId)) return null;
  await connectDB();
  const run = await SyncRun.findById(runId);
  if (!run) return null;
  const basis = run.basis === "date" ? "date" : "month";

  const importable = run.mismatches.filter(
    (m) => !m.resolved && (m.kind === "missing_on_site" || m.kind === "unknown_student"),
  );
  // Bitta noma'lum o'quvchi tanlansa — uning boshqa oylardagi yozuvlari ham birga qo'shiladi
  // (o'quvchi to'liq tarixi bilan yaratiladi, oylar to'g'ri taqsimlanadi).
  const chosenNames = new Set(
    importable
      .filter((m) => ids !== "all" && ids.includes(String(m._id)) && m.kind === "unknown_student")
      .map((m) => nameKey(m.studentName)),
  );
  const targets = importable.filter(
    (m) =>
      ids === "all" ||
      ids.includes(String(m._id)) ||
      (m.kind === "unknown_student" && chosenNames.has(nameKey(m.studentName))),
  );
  const result: ImportResult = { students: 0, payments: 0, resolved: 0, skipped: [] };
  if (!targets.length) return result;

  // 1) Har bir farq uchun saytdagi o'quvchini aniqlash (yo'q bo'lsa — yaratish)
  const existing = await Student.find({}, { fullName: 1 }).lean();
  const byName = new Map<string, string[]>();
  for (const s of existing) {
    const k = nameKey(s.fullName);
    byName.set(k, [...(byName.get(k) ?? []), String(s._id)]);
  }

  const partsOf = (m: (typeof targets)[number]): Part[] =>
    m.parts?.length
      ? m.parts.map((p) => ({ row: p.row ?? 0, date: p.date ?? "", amount: p.amount ?? 0, cash: p.cash ?? 0, card: p.card ?? 0 }))
      : [{ row: m.sheetRows[0] ?? 0, date: m.sheetDate ?? "", amount: m.sheetAmount, cash: m.sheetAmount, card: 0 }];
  const partMonth = (m: (typeof targets)[number], p: Part) => (p.date ? p.date.slice(0, 7) : m.month);

  const studentFor = new Map<(typeof targets)[number], string>();
  const toCreate = new Map<string, (typeof targets)[number][]>(); // nameKey -> farqlar
  for (const m of targets) {
    if (m.studentId) {
      studentFor.set(m, String(m.studentId));
      continue;
    }
    const k = nameKey(m.studentName);
    const found = byName.get(k) ?? [];
    if (found.length === 1) studentFor.set(m, found[0]);
    else if (found.length > 1) result.skipped.push(`${m.studentName}: saytda bir xil ismli ${found.length} ta o'quvchi bor`);
    else toCreate.set(k, [...(toCreate.get(k) ?? []), m]);
  }

  for (const group of toCreate.values()) {
    const first = group[0];
    const months = group.flatMap((m) => partsOf(m).map((p) => partMonth(m, p))).sort();
    const fee = Math.max(0, ...group.map((m) => m.fee ?? 0));
    const created = await Student.create({
      seq: await nextStudentSeq(),
      fullName: first.studentName.replace(/\s+/g, " ").trim(),
      phone: first.phone ?? "",
      group: first.group ?? "",
      monthlyFee: fee,
      startDate: isoToDate(`${months[0]}-01`)!,
      active: true,
      note: fee ? "Google Sheets'dan import qilindi" : "Google Sheets'dan import qilindi — oylik to'lovni kiriting",
    });
    result.students++;
    for (const m of group) studentFor.set(m, String(created._id));
  }

  // 2) O'quvchilarning oylik to'lovi, boshlanish oyi va hozirgacha to'langan summalari
  const studentIds = [...new Set(studentFor.values())];
  const [infos, paidAgg] = await Promise.all([
    Student.find({ _id: { $in: studentIds } }, { monthlyFee: 1, feeHistory: 1, startDate: 1 }).lean<StudentLean[]>(),
    Payment.aggregate<{ _id: { student: mongoose.Types.ObjectId; month: string }; total: number }>([
      { $match: { ...LIVE, student: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: { student: "$student", month: "$month" }, total: { $sum: "$amount" } } },
    ]),
  ]);
  const info = new Map(
    infos.map((s) => [
      String(s._id),
      { feeOf: (m: string) => studentFee(s, m), startMonth: monthOfDate(s.startDate), paid: new Map<string, number>() },
    ]),
  );
  for (const a of paidAgg) info.get(String(a._id.student))?.paid.set(a._id.month, a.total);

  // 3) Barcha to'lov qatorlari sana tartibida — oldingi to'lov oldingi oyni yopadi
  const items = [...studentFor.entries()].flatMap(([m, studentId]) =>
    partsOf(m).map((p) => ({ m, studentId, p })),
  );
  items.sort(
    (a, b) =>
      (a.p.date || `${a.m.month}-01`).localeCompare(b.p.date || `${b.m.month}-01`) || a.p.row - b.p.row,
  );

  const docs: Record<string, unknown>[] = [];
  for (const { m, studentId, p } of items) {
    const st = info.get(studentId);
    if (!st) continue;
    const payMonth = partMonth(m, p);
    const from = basis === "date" ? importFromMonth(payMonth, st.startMonth) : m.month;
    for (const chunk of splitByMethod(p)) {
      for (const a of allocateAmount(chunk.amount, st.feeOf, from, st.paid)) {
        docs.push({
          student: studentId,
          month: a.month,
          amount: a.amount,
          paidAt: (p.date && isoToDate(p.date)) || new Date(),
          method: chunk.method,
          note: p.row ? `Google Sheets, ${p.row}-qator` : "Google Sheets",
          source: "sheets",
          createdBy: "system",
        });
      }
    }
  }
  if (docs.length) await Payment.insertMany(docs);
  result.payments = docs.length;

  for (const m of studentFor.keys()) {
    m.resolved = true;
    result.resolved++;
  }
  await run.save();
  return result;
}
