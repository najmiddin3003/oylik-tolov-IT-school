// Sheets farqlaridan saytga o'quvchi va to'lovlarni import qilish.
import mongoose from "mongoose";
import { allocateAmount, importFromMonth } from "./allocate";
import { courseTeacherResolver } from "./course-teacher";
import { connectDB } from "./db";
import { LIVE, studentFee, type StudentLean } from "./ledger";
import { Payment, Student, SyncRun, type PaymentMethod } from "./models";
import { nameKey } from "./normalize";
import { nameMatches, studentNameKeys } from "./compare";
import { nextStudentSeq } from "./seq";
import { isoToDate, monthOfDate, shiftMonth } from "./time";

/**
 * rows — saytga qo'shilgan Sheets qatorlari (bitta qator naqd+plastik bo'lsa ham bitta);
 * linkedTo — `studentId` bilan chaqirilganda: to'lovlar qo'shilgan o'quvchi ismi;
 * alreadyPaid — saytdagi o'quvchining shu oydagi to'lovi allaqachon bor edi: to'lov qayta yozilmadi, faqat yozuv yopildi.
 */
export type ImportResult = {
  students: number;
  payments: number;
  resolved: number;
  rows: number;
  skipped: string[];
  linkedTo?: string;
  alreadyPaid: number;
};

/** O'quvchining shu oyga tegishli (oy maydoni yoki to'langan sanasi bo'yicha) hisobdagi to'lovi bormi. */
export async function hasPaymentInMonth(studentId: string, month: string): Promise<boolean> {
  const from = isoToDate(`${month}-01`);
  const to = isoToDate(`${shiftMonth(month, 1)}-01`);
  if (!from || !to) return false;
  const found = await Payment.exists({ ...LIVE, student: studentId, $or: [{ month }, { paidAt: { $gte: from, $lt: to } }] });
  return Boolean(found);
}

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
 * `opts.studentId` — noma'lum o'quvchi saytdagi shu o'quvchi (ismi Sheets'da boshqacha yozilgan): to'lovlar unga
 * qo'shiladi va Sheets'dagi ismi unga bog'lanadi — keyingi tekshiruvlarda o'zi topiladi.
 */
export async function importFromRun(runId: string, ids: string[] | "all", opts: { studentId?: string } = {}): Promise<ImportResult | null> {
  if (!mongoose.isValidObjectId(runId)) return null;
  if (opts.studentId !== undefined && !mongoose.isValidObjectId(opts.studentId)) return null;
  await connectDB();
  const run = await SyncRun.findById(runId);
  if (!run) return null;
  const linkTo = opts.studentId ? await Student.findById(opts.studentId, { fullName: 1, sheetNames: 1 }).lean() : null;
  if (opts.studentId && !linkTo) return null;
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
  const result: ImportResult = { students: 0, payments: 0, resolved: 0, rows: 0, skipped: [], alreadyPaid: 0 };
  if (!targets.length) return result;

  // 1) Har bir farq uchun saytdagi o'quvchini aniqlash (yo'q bo'lsa — yaratish). Ism yoki Sheets'dagi bog'langan ismi bo'yicha
  const existing = await Student.find({}, { fullName: 1, sheetNames: 1, group: 1 }).lean();
  const byName = new Map<string, string[]>();
  for (const s of existing) {
    for (const k of studentNameKeys({ fullName: s.fullName, aliases: s.sheetNames })) byName.set(k, [...(byName.get(k) ?? []), String(s._id)]);
  }
  const candidates = existing.map((s) => ({ id: String(s._id), fullName: s.fullName, group: s.group ?? "", aliases: s.sheetNames }));

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
    // Saytdagi tanlangan o'quvchiga biriktirish
    if (linkTo) {
      studentFor.set(m, String(linkTo._id));
      continue;
    }
    const k = nameKey(m.studentName);
    const found = byName.get(k) ?? [];
    if (found.length === 1) studentFor.set(m, found[0]);
    else if (found.length > 1) result.skipped.push(`${m.studentName}: saytda bir xil ismli ${found.length} ta o'quvchi bor`);
    // Ommaviy qo'shishda: saytda o'xshash ismli o'quvchi bo'lsa — yangi o'quvchi yaratilmaydi (dublikat bo'lmasin), alohida tanlanadi
    else if (ids === "all" && nameMatches(m.studentName, candidates).similar.length) {
      result.skipped.push(`${m.studentName}: saytda o'xshash ismli o'quvchi bor — alohida tanlang`);
    } else toCreate.set(k, [...(toCreate.get(k) ?? []), m]);
  }

  // Yangi o'quvchi kursining o'qituvchisi bo'lsa — darhol unga biriktiriladi
  const teacherOf = toCreate.size ? await courseTeacherResolver() : () => null;
  const createdIds = new Set<string>();
  for (const group of toCreate.values()) {
    const first = group[0];
    const months = group.flatMap((m) => partsOf(m).map((p) => partMonth(m, p))).sort();
    const fee = Math.max(0, ...group.map((m) => m.fee ?? 0));
    const created = await Student.create({
      seq: await nextStudentSeq(),
      fullName: first.studentName.replace(/\s+/g, " ").trim(),
      phone: first.phone ?? "",
      group: first.group ?? "",
      teacher: teacherOf(first.group),
      monthlyFee: fee,
      startDate: isoToDate(`${months[0]}-01`)!,
      active: true,
      note: fee ? "Google Sheets'dan import qilindi" : "Google Sheets'dan import qilindi — oylik to'lovni kiriting",
    });
    result.students++;
    createdIds.add(String(created._id));
    for (const m of group) studentFor.set(m, String(created._id));
  }

  // «Noma'lum o'quvchi» saytdagi mavjud o'quvchi bo'lib chiqsa (ismi Sheets'da boshqacha yozilgan yoki keyin to'g'rilangan):
  // uning shu oydagi to'lovi saytda allaqachon bo'lsa — Sheets yozuvi o'sha to'lovning o'zi, qayta yozilmaydi (ikki marta
  // hisoblanmasin); yozuv yopiladi, ism bog'lanadi — keyingi tekshiruvda mos keladi.
  const alreadyPaid = new Set<(typeof targets)[number]>();
  for (const [m, studentId] of studentFor) {
    if (m.kind === "unknown_student" && !createdIds.has(studentId) && (await hasPaymentInMonth(studentId, m.month))) alreadyPaid.add(m);
  }
  result.alreadyPaid = alreadyPaid.size;

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
  const items = [...studentFor.entries()]
    .filter(([m]) => !alreadyPaid.has(m))
    .flatMap(([m, studentId]) => partsOf(m).map((p) => ({ m, studentId, p })));
  items.sort(
    (a, b) =>
      (a.p.date || `${a.m.month}-01`).localeCompare(b.p.date || `${b.m.month}-01`) || a.p.row - b.p.row,
  );

  const docs: Record<string, unknown>[] = [];
  for (const { m, studentId, p } of items) {
    const st = info.get(studentId);
    if (!st) continue;
    result.rows++;
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
  // Saytdagi o'sha to'lov uchun shu tekshiruvdagi «Sheets'da yo'q» yozuvi ham (summasi bir xil bo'lsa) — o'sha to'lovning o'zi
  for (const m of alreadyPaid) {
    const studentId = studentFor.get(m);
    for (const x of run.mismatches) {
      if (!x.resolved && x.kind === "missing_in_sheet" && String(x.studentId) === studentId && x.month === m.month && x.siteAmount === m.sheetAmount) {
        x.resolved = true;
      }
    }
  }
  await run.save();

  // Sheets'dagi boshqacha yozilgan ism o'quvchiga bog'lanadi (keyingi tekshiruvlarda shu o'quvchi deb topiladi)
  if (linkTo) {
    const known = new Set(studentNameKeys({ fullName: linkTo.fullName, aliases: linkTo.sheetNames }));
    const names = [...new Set(targets.filter((m) => m.kind === "unknown_student").map((m) => m.studentName.replace(/\s+/g, " ").trim()))].filter(
      (n) => n && !known.has(nameKey(n)),
    );
    if (names.length) await Student.updateOne({ _id: linkTo._id }, { $addToSet: { sheetNames: { $each: names } } });
    result.linkedTo = linkTo.fullName;
  }
  return result;
}
