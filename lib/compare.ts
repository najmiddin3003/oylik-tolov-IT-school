// Sheets qatorlari bilan saytdagi to'lovlarni solishtirish (sof funksiyalar — bazaga murojaat yo'q).
import type { MismatchKind } from "./models";
import { nameKey, normalizeText, parseAmount, parseDateCell, parseMonthCell, phoneKey } from "./normalize";
import { compareMonths } from "./time";

export type ColumnNames = { name: string; phone: string; month: string; amount: string; date: string };

export const DEFAULT_COLUMNS: ColumnNames = {
  name: "Ism",
  phone: "Telefon",
  month: "Oy",
  amount: "Summa",
  date: "Sana",
};

// Sozlamadagi nom topilmasa, shu sinonimlar bilan qidiriladi.
const SYNONYMS: Record<keyof ColumnNames, string[]> = {
  name: ["ism", "ismi", "ism familiya", "familiya ism", "f.i.sh", "f.i.sh.", "fish", "fio", "ф.и.о", "фио", "o'quvchi", "talaba", "name", "full name", "student"],
  phone: ["telefon", "tel", "telefon raqam", "telefon raqami", "raqam", "phone", "телефон"],
  month: ["oy", "to'lov oyi", "qaysi oy", "month", "месяц"],
  amount: ["summa", "miqdor", "to'lov", "to'lov summasi", "to'langan", "amount", "sum", "сумма"],
  date: ["sana", "to'lov sanasi", "to'langan sana", "vaqt", "date", "дата"],
};

export type SheetRecord = {
  row: number; // jadvaldagi qator raqami (1 dan)
  name: string;
  phone: string;
  month: string;
  amount: number;
  date: string; // "YYYY-MM-DD" yoki ""
};

export type ParsedSheet = {
  records: SheetRecord[];
  skipped: { row: number; reason: string }[];
  missingColumns: string[];
};

function findColumn(headers: string[], configured: string, synonyms: string[]): number {
  const norm = headers.map((h) => normalizeText(h));
  const want = normalizeText(configured);
  if (want) {
    const exact = norm.indexOf(want);
    if (exact !== -1) return exact;
  }
  for (const s of synonyms) {
    const i = norm.indexOf(s);
    if (i !== -1) return i;
  }
  if (want) {
    const partial = norm.findIndex((h) => h.startsWith(want));
    if (partial !== -1) return partial;
  }
  return -1;
}

export function parseSheet(rows: string[][], columns: ColumnNames, fallbackYear: number): ParsedSheet {
  const skipped: ParsedSheet["skipped"] = [];

  // Sarlavha qatori: birinchi 10 qatordan ism va summa ustuni topilgan birinchisi
  let headerIdx = -1;
  let idx = { name: -1, phone: -1, month: -1, amount: -1, date: -1 };
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const h = rows[r] ?? [];
    const candidate = {
      name: findColumn(h, columns.name, SYNONYMS.name),
      phone: findColumn(h, columns.phone, SYNONYMS.phone),
      month: findColumn(h, columns.month, SYNONYMS.month),
      amount: findColumn(h, columns.amount, SYNONYMS.amount),
      date: findColumn(h, columns.date, SYNONYMS.date),
    };
    if (candidate.name !== -1 && candidate.amount !== -1) {
      headerIdx = r;
      idx = candidate;
      break;
    }
  }

  const missingColumns: string[] = [];
  if (headerIdx === -1) {
    if (idx.name === -1) missingColumns.push(`ism («${columns.name}»)`);
    missingColumns.push(`summa («${columns.amount}»)`);
    return { records: [], skipped, missingColumns };
  }
  if (idx.month === -1 && idx.date === -1) {
    missingColumns.push(`oy («${columns.month}») yoki sana («${columns.date}»)`);
    return { records: [], skipped, missingColumns };
  }

  const records: SheetRecord[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cell = (i: number) => (i === -1 ? "" : String(row[i] ?? "").trim());
    const rowNo = r + 1;
    if (row.every((c) => !String(c ?? "").trim())) continue; // bo'sh qator

    const name = cell(idx.name);
    const amountRaw = cell(idx.amount);
    if (!name) {
      if (amountRaw) skipped.push({ row: rowNo, reason: "ism bo'sh" });
      continue;
    }
    // "Jami" kabi yakuniy qatorlar
    if (/^(jami|itogo|итого|total|всего)\b/i.test(name)) continue;

    const amount = parseAmount(amountRaw);
    if (amount === null || amount === 0) {
      // Summa yozilmagan qator = to'lov qilinmagan, solishtirishga kirmaydi
      if (amountRaw) skipped.push({ row: rowNo, reason: `summa tushunarsiz: «${amountRaw}»` });
      continue;
    }

    const date = parseDateCell(cell(idx.date)) ?? "";
    const yearHint = date ? Number(date.slice(0, 4)) : fallbackYear;
    const month = parseMonthCell(cell(idx.month), yearHint) ?? (date ? date.slice(0, 7) : null);
    if (!month) {
      skipped.push({ row: rowNo, reason: "oy aniqlanmadi" });
      continue;
    }

    records.push({ row: rowNo, name, phone: cell(idx.phone), month, amount, date });
  }
  return { records, skipped, missingColumns };
}

// ---------- Solishtirish ----------

export type SiteStudent = { id: string; fullName: string; phone: string; parentPhone: string };
export type SitePaymentAgg = { studentId: string; month: string; amount: number };

export type MismatchResult = {
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
};

export type CompareResult = {
  mismatches: MismatchResult[];
  matchedCount: number;
  monthFrom: string;
  monthTo: string;
};

/** Oylar oralig'i: Sheets'dagi eng kichik va eng katta oy. Saytdagi shu oraliqdagi to'lovlargina solishtiriladi. */
export function sheetMonthRange(records: SheetRecord[]): { from: string; to: string } | null {
  if (records.length === 0) return null;
  let from = records[0].month;
  let to = records[0].month;
  for (const r of records) {
    if (compareMonths(r.month, from) < 0) from = r.month;
    if (compareMonths(r.month, to) > 0) to = r.month;
  }
  return { from, to };
}

export function compareRecords(
  records: SheetRecord[],
  students: SiteStudent[],
  sitePayments: SitePaymentAgg[],
): CompareResult {
  const range = sheetMonthRange(records);
  if (!range) return { mismatches: [], matchedCount: 0, monthFrom: "", monthTo: "" };

  // O'quvchini topish indekslari
  const byPhone = new Map<string, SiteStudent>();
  const byName = new Map<string, SiteStudent[]>();
  for (const s of students) {
    for (const p of [s.phone, s.parentPhone]) {
      const k = phoneKey(p);
      if (k && !byPhone.has(k)) byPhone.set(k, s);
    }
    const nk = nameKey(s.fullName);
    byName.set(nk, [...(byName.get(nk) ?? []), s]);
  }
  const studentById = new Map(students.map((s) => [s.id, s]));

  type SheetAgg = {
    student: SiteStudent | null;
    note: string;
    name: string;
    phone: string;
    month: string;
    amount: number;
    rows: number[];
    date: string;
  };
  const sheetAgg = new Map<string, SheetAgg>();

  for (const rec of records) {
    let student: SiteStudent | null = null;
    let note = "";
    const pk = phoneKey(rec.phone);
    if (pk && byPhone.has(pk)) {
      student = byPhone.get(pk)!;
    } else {
      const candidates = byName.get(nameKey(rec.name)) ?? [];
      if (candidates.length === 1) student = candidates[0];
      else if (candidates.length > 1) note = `Saytda «${rec.name}» ismli ${candidates.length} ta o'quvchi bor — telefon raqami bilan ajrating`;
    }
    const key = `${student ? student.id : `name:${nameKey(rec.name)}`}|${rec.month}`;
    const prev = sheetAgg.get(key);
    if (prev) {
      prev.amount += rec.amount;
      prev.rows.push(rec.row);
      if (!prev.date && rec.date) prev.date = rec.date;
    } else {
      sheetAgg.set(key, {
        student,
        note,
        name: rec.name,
        phone: rec.phone,
        month: rec.month,
        amount: rec.amount,
        rows: [rec.row],
        date: rec.date,
      });
    }
  }

  const siteAgg = new Map<string, number>();
  for (const p of sitePayments) {
    if (compareMonths(p.month, range.from) < 0 || compareMonths(p.month, range.to) > 0) continue;
    const key = `${p.studentId}|${p.month}`;
    siteAgg.set(key, (siteAgg.get(key) ?? 0) + p.amount);
  }

  const mismatches: MismatchResult[] = [];
  let matchedCount = 0;

  for (const [key, s] of sheetAgg) {
    if (!s.student) {
      mismatches.push({
        kind: "unknown_student",
        studentId: null,
        studentName: s.name,
        phone: s.phone,
        month: s.month,
        siteAmount: 0,
        sheetAmount: s.amount,
        sheetRows: s.rows,
        sheetDate: s.date,
        note: s.note || "Bu o'quvchi saytda topilmadi (ism yoki telefon mos kelmadi)",
      });
      continue;
    }
    const siteAmount = siteAgg.get(key);
    if (siteAmount === undefined) {
      mismatches.push({
        kind: "missing_on_site",
        studentId: s.student.id,
        studentName: s.student.fullName,
        phone: s.student.phone,
        month: s.month,
        siteAmount: 0,
        sheetAmount: s.amount,
        sheetRows: s.rows,
        sheetDate: s.date,
        note: "",
      });
    } else if (siteAmount !== s.amount) {
      mismatches.push({
        kind: "amount_diff",
        studentId: s.student.id,
        studentName: s.student.fullName,
        phone: s.student.phone,
        month: s.month,
        siteAmount,
        sheetAmount: s.amount,
        sheetRows: s.rows,
        sheetDate: s.date,
        note: "",
      });
    } else {
      matchedCount++;
    }
    siteAgg.delete(key);
  }

  for (const [key, amount] of siteAgg) {
    const [studentId, month] = key.split("|");
    const st = studentById.get(studentId);
    mismatches.push({
      kind: "missing_in_sheet",
      studentId,
      studentName: st?.fullName ?? "(o'chirilgan o'quvchi)",
      phone: st?.phone ?? "",
      month,
      siteAmount: amount,
      sheetAmount: 0,
      sheetRows: [],
      sheetDate: "",
      note: "",
    });
  }

  mismatches.sort(
    (a, b) => compareMonths(b.month, a.month) || a.studentName.localeCompare(b.studentName),
  );
  return { mismatches, matchedCount, monthFrom: range.from, monthTo: range.to };
}
