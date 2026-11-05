// Sheets qatorlari bilan saytdagi to'lovlarni solishtirish (sof funksiyalar — bazaga murojaat yo'q).
import type { MismatchKind } from "./models";
import { nameKey, nameSimilarity, normalizeText, parseAmount, parseDateCell, parseMonthCell, phoneKey } from "./normalize";
import { compareMonths } from "./time";

export type ColumnNames = {
  name: string;
  phone: string;
  month: string;
  amount: string;
  date: string;
  cash: string;
  card: string;
  fee: string;
  course: string;
};

// O'quv markaz jadvalining sarlavhalari (Chortoq: № | Ism Familiya | Kurs nomi | O'qtuvchi | Kurs Narxi | Naqt |
// To'lov olingan sana | Plastik | Jami | Qoldiq). Boshqacha jadval bo'lsa — sozlamalardan o'zgartiriladi.
export const DEFAULT_COLUMNS: ColumnNames = {
  name: "Ism Familiya",
  phone: "Telefon",
  month: "Oy",
  amount: "Jami",
  date: "To'lov olingan sana",
  cash: "Naqt",
  card: "Plastik",
  fee: "Kurs Narxi",
  course: "Kurs nomi",
};

/** Standart: faqat shu kurs qatorlari solishtiriladi. */
export const DEFAULT_COURSE_FILTER = "Web dasturlash";

// Sozlamadagi nom topilmasa, shu sinonimlar bilan qidiriladi (to'liq mos kelishi kerak).
const SYNONYMS: Record<keyof ColumnNames, string[]> = {
  name: ["ism familiya", "familiya ism", "ism", "ismi", "f.i.sh", "f.i.sh.", "fish", "fio", "ф.и.о", "фио", "o'quvchi", "talaba", "name", "full name", "student"],
  phone: ["telefon", "tel", "telefon raqam", "telefon raqami", "raqam", "phone", "телефон"],
  month: ["oy", "to'lov oyi", "qaysi oy", "month", "месяц"],
  amount: ["jami", "jami summa", "jami to'lov", "summa", "miqdor", "to'lov", "to'lov summasi", "to'langan", "to'langan summa", "amount", "sum", "сумма", "итого"],
  date: ["to'lov olingan sana", "to'lov sanasi", "to'langan sana", "olingan sana", "sana", "vaqt", "date", "дата"],
  cash: ["naqt", "naqd", "naqd pul", "naqt pul", "cash", "наличные"],
  card: ["plastik", "plastik karta", "karta", "bank karta", "card", "пластик", "терминал"],
  fee: ["kurs narxi", "kurs narhi", "narxi", "narx", "oylik to'lov", "oylik narx", "price"],
  course: ["kurs nomi", "kurs", "yo'nalish", "fan", "guruh", "course"],
};

// Oxirgi chora: sarlavhada shu so'z qatnashsa (masalan «To'lov olingan sana» → sana).
const CONTAINS: Partial<Record<keyof ColumnNames, string[]>> = {
  date: ["sana", "date", "дата"],
  fee: ["narx"],
  course: ["kurs nomi", "yo'nalish"],
};

// Ustunlar shu tartibda qidiriladi; bir ustun ikki maydonga berilmaydi.
const FIELD_ORDER: (keyof ColumnNames)[] = ["name", "amount", "cash", "card", "date", "month", "fee", "course", "phone"];

type ColumnIndex = Record<keyof ColumnNames, number>;

function locateColumns(header: string[], columns: ColumnNames): ColumnIndex {
  const norm = header.map((h) => normalizeText(String(h ?? "")));
  const used = new Set<number>();
  const out = {} as ColumnIndex;
  for (const field of FIELD_ORDER) {
    const want = normalizeText(columns[field] ?? "");
    let found = -1;
    const tryFind = (pred: (h: string) => boolean) => {
      if (found !== -1) return;
      const i = norm.findIndex((h, j) => h !== "" && !used.has(j) && pred(h));
      if (i !== -1) found = i;
    };
    if (want) tryFind((h) => h === want);
    for (const s of SYNONYMS[field]) tryFind((h) => h === s);
    if (want) tryFind((h) => h.startsWith(want));
    for (const s of CONTAINS[field] ?? []) tryFind((h) => h.includes(s));
    out[field] = found;
    if (found !== -1) used.add(found);
  }
  return out;
}

// ---------- Kurs filtri ----------

/** "Web dasturlash, Grafik dizayn" -> ["web dasturlash", "grafik dizayn"] */
export function courseFilterTokens(filter: string | undefined | null): string[] {
  return String(filter ?? "")
    .split(/[,;]/)
    .map((t) => normalizeText(t))
    .filter(Boolean);
}

/** Kurs nomi filtrga mosmi (katta-kichik harf, bo'shliq va apostrof farqi hisobga olinmaydi). */
export function matchesCourse(value: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const v = normalizeText(value);
  if (!v) return false;
  return tokens.some((t) => v.includes(t) || (v.length >= 4 && t.includes(v)));
}

// ---------- Jadvalni o'qish ----------

/** Sheets'dagi bitta to'lov qatori (import uchun ham kerak). */
export type SheetPart = { row: number; date: string; amount: number; cash: number; card: number };

export type SheetRecord = {
  row: number; // jadvaldagi qator raqami (1 dan)
  name: string;
  phone: string;
  course: string;
  /** Solishtirish oyi: "oy" ustuni bo'lsa — o'sha, bo'lmasa to'lov sanasining oyi */
  month: string;
  date: string; // "YYYY-MM-DD" yoki ""
  amount: number; // jami (naqd + plastik)
  cash: number;
  card: number;
  fee: number | null; // kurs narxi (oylik)
};

/**
 * - `month`: jadvalda «Oy» ustuni bor — to'lov qaysi oy uchunligi bo'yicha solishtiriladi.
 * - `date`: oy ustuni yo'q (kassa daftari) — to'lov olingan sana bo'yicha solishtiriladi.
 */
export type SheetBasis = "month" | "date";

/** Saytdagi qaysi to'lovlar solishtiriladi: jadval qamragan davr. */
export type SheetWindow = {
  basis: SheetBasis;
  monthFrom: string;
  monthTo: string;
  dateFrom: string; // faqat basis = "date"
  dateTo: string; // jadvaldagi eng oxirgi sana (bugundan oshmaydi)
};

export type ParsedSheet = {
  records: SheetRecord[];
  skipped: { row: number; reason: string }[];
  missingColumns: string[];
  basis: SheetBasis;
  window: SheetWindow | null;
  /** Kurs filtriga mos kelmagani uchun e'tiborsiz qoldirilgan qatorlar */
  filteredOut: number;
  /** Kurslar bo'yicha: solishtirilgan qatorlar va filtr tufayli e'tiborsiz qolganlari (kurs nomi -> son) */
  rowsByCourse: Record<string, number>;
  filteredByCourse: Record<string, number>;
};

/** Kurs nomi (kurslar bo'yicha statistika uchun): bo'sh bo'lsa — "Kursi yozilmagan". */
export function courseLabel(raw: string): string {
  const v = raw.replace(/\s+/g, " ").trim();
  return v || "Kursi yozilmagan";
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export type ParseOptions = {
  fallbackYear: number;
  /** Bugungi sana "YYYY-MM-DD" (Toshkent) — davr bundan keyinga cho'zilmaydi */
  today: string;
  courseFilter?: string;
};

export function parseSheet(rows: string[][], columns: ColumnNames, opts: ParseOptions): ParsedSheet {
  const skipped: ParsedSheet["skipped"] = [];
  const empty = (basis: SheetBasis, missingColumns: string[]): ParsedSheet => ({
    records: [],
    skipped,
    missingColumns,
    basis,
    window: null,
    filteredOut: 0,
    rowsByCourse: {},
    filteredByCourse: {},
  });

  // Sarlavha qatori: birinchi 10 qatordan ism va summa (yoki naqd/plastik) ustuni topilgan birinchisi
  let headerIdx = -1;
  let idx = {} as ColumnIndex;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const candidate = locateColumns(rows[r] ?? [], columns);
    if (candidate.name !== -1 && (candidate.amount !== -1 || candidate.cash !== -1 || candidate.card !== -1)) {
      headerIdx = r;
      idx = candidate;
      break;
    }
  }
  if (headerIdx === -1) {
    return empty("date", [`ism («${columns.name}»)`, `summa («${columns.amount}»)`]);
  }

  const basis: SheetBasis = idx.month !== -1 ? "month" : "date";
  const missingColumns: string[] = [];
  if (basis === "date" && idx.date === -1) {
    missingColumns.push(`oy («${columns.month}») yoki sana («${columns.date}»)`);
  }
  const tokens = courseFilterTokens(opts.courseFilter);
  if (tokens.length && idx.course === -1) {
    missingColumns.push(`kurs («${columns.course}») — filtr «${opts.courseFilter}» uchun kerak`);
  }
  if (missingColumns.length) return empty(basis, missingColumns);

  const records: SheetRecord[] = [];
  let filteredOut = 0;
  const rowsByCourse: Record<string, number> = {};
  const filteredByCourse: Record<string, number> = {};
  let minKey = ""; // davr: basis=date — sana, basis=month — oy
  let maxKey = "";

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cell = (i: number) => (i === -1 ? "" : String(row[i] ?? "").trim());
    const rowNo = r + 1;
    if (row.every((c) => !String(c ?? "").trim())) continue; // bo'sh qator

    const date = parseDateCell(cell(idx.date)) ?? "";
    const yearHint = date ? Number(date.slice(0, 4)) : opts.fallbackYear;
    const month =
      basis === "month"
        ? parseMonthCell(cell(idx.month), yearHint) ?? (date ? date.slice(0, 7) : "")
        : date.slice(0, 7);

    // Davr butun jadval bo'yicha (filtrdan oldin): jadval qaysi sanagacha yuritilganini bildiradi
    const key = basis === "date" ? date : month;
    if (key) {
      if (!minKey || key < minKey) minKey = key;
      if (!maxKey || key > maxKey) maxKey = key;
    }

    const name = cell(idx.name);
    if (tokens.length && !matchesCourse(cell(idx.course), tokens)) {
      if (name) {
        filteredOut++;
        bump(filteredByCourse, courseLabel(cell(idx.course)));
      }
      continue;
    }

    const amountRaw = cell(idx.amount);
    const cashRaw = cell(idx.cash);
    const cardRaw = cell(idx.card);
    if (!name) {
      if (amountRaw || cashRaw || cardRaw) skipped.push({ row: rowNo, reason: "ism bo'sh" });
      continue;
    }
    // "Jami" kabi yakuniy qatorlar
    if (/^(jami|itogo|итого|total|всего)\b/i.test(name)) continue;

    const total = parseAmount(amountRaw);
    const cash = parseAmount(cashRaw) ?? 0;
    const card = parseAmount(cardRaw) ?? 0;
    const amount = total ?? (cash + card || null);
    if (amount === null || amount === 0) {
      // Summa yozilmagan qator = to'lov qilinmagan, solishtirishga kirmaydi
      const raw = amountRaw || cashRaw || cardRaw;
      if (raw && parseAmount(raw) === null) skipped.push({ row: rowNo, reason: `summa tushunarsiz: «${raw}»` });
      continue;
    }
    if (amount < 0) {
      skipped.push({ row: rowNo, reason: `manfiy summa: «${amountRaw}»` });
      continue;
    }
    if (!month) {
      skipped.push({ row: rowNo, reason: basis === "date" ? "to'lov sanasi aniqlanmadi" : "oy aniqlanmadi" });
      continue;
    }

    const fee = parseAmount(cell(idx.fee));
    bump(rowsByCourse, courseLabel(cell(idx.course)));
    records.push({
      row: rowNo,
      name,
      phone: cell(idx.phone),
      course: cell(idx.course),
      month,
      date,
      amount,
      cash,
      card,
      fee: fee !== null && fee > 0 ? fee : null,
    });
  }

  let window: SheetWindow | null = null;
  if (minKey) {
    if (basis === "date") {
      const dateFrom = `${minKey.slice(0, 7)}-01`;
      const dateTo = maxKey > opts.today ? opts.today : maxKey;
      window = { basis, dateFrom, dateTo, monthFrom: dateFrom.slice(0, 7), monthTo: dateTo.slice(0, 7) };
    } else {
      window = { basis, monthFrom: minKey, monthTo: maxKey, dateFrom: "", dateTo: "" };
    }
  }

  return { records, skipped, missingColumns, basis, window, filteredOut, rowsByCourse, filteredByCourse };
}

// ---------- Solishtirish ----------

export type SiteStudent = {
  id: string;
  fullName: string;
  phone: string;
  parentPhone: string;
  group: string;
  /** Sheets'da boshqacha yozilgan ismlari (o'quvchiga qo'lda bog'langan) — shu ism bilan ham topiladi */
  aliases?: string[];
};

/** Ism kalitlari: asosiy ism va Sheets'dagi boshqa yozilishlari (takrorsiz). */
export function studentNameKeys(s: { fullName: string; aliases?: string[] | null }): string[] {
  return [...new Set([s.fullName, ...(s.aliases ?? [])].map(nameKey).filter(Boolean))];
}

/** O'xshash ism taklif qilinadigan eng kichik o'xshashlik. */
export const SIMILAR_MIN = 0.8;

export type NameCandidate = { id: string; fullName: string; group: string; aliases?: string[] | null };

/**
 * Sheets'dagi ism uchun saytdagi o'quvchilar: `exact` — ismi (yoki bog'langan Sheets ismi) aynan mos,
 * `similar` — yozilishi o'xshash (x/h, qo'sh harf, qo'shimcha: "Shaxlo" ≈ "Shaxloxon"), eng o'xshashi birinchi.
 */
export function nameMatches<T extends NameCandidate>(name: string, students: T[], limit = 3): { exact: T[]; similar: (T & { score: number })[] } {
  const k = nameKey(name);
  if (!k) return { exact: [], similar: [] };
  const exact = students.filter((s) => studentNameKeys(s).includes(k));
  const exactIds = new Set(exact.map((s) => s.id));
  const similar = students
    .filter((s) => !exactIds.has(s.id))
    .map((s) => ({ ...s, score: Math.max(...[s.fullName, ...(s.aliases ?? [])].map((n) => nameSimilarity(name, n))) }))
    .filter((s) => s.score >= SIMILAR_MIN)
    .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName))
    .slice(0, limit);
  return { exact, similar };
}
/** Saytdagi to'lov: `month` — qaysi oy uchun, `paidDate` — to'langan sana ("YYYY-MM-DD", Toshkent) */
export type SitePayment = { studentId: string; month: string; paidDate: string; amount: number };

export type MismatchResult = {
  kind: MismatchKind;
  studentId: string | null;
  studentName: string;
  phone: string;
  group: string;
  month: string;
  siteAmount: number;
  sheetAmount: number;
  sheetRows: number[];
  sheetDate: string;
  fee: number;
  parts: SheetPart[];
  note: string;
};

export type CompareResult = {
  mismatches: MismatchResult[];
  matchedCount: number;
  /** Mos kelganlar kurslar bo'yicha (Sheets'dagi kurs nomi) */
  matchedByCourse: Record<string, number>;
};

export function compareRecords(
  records: SheetRecord[],
  students: SiteStudent[],
  sitePayments: SitePayment[],
  opts: { window: SheetWindow | null; courseFilter?: string },
): CompareResult {
  const { window } = opts;
  if (!window) return { mismatches: [], matchedCount: 0, matchedByCourse: {} };
  const tokens = courseFilterTokens(opts.courseFilter);

  // O'quvchini topish indekslari
  const byPhone = new Map<string, SiteStudent>();
  const byName = new Map<string, SiteStudent[]>();
  for (const s of students) {
    for (const p of [s.phone, s.parentPhone]) {
      const k = phoneKey(p);
      if (k && !byPhone.has(k)) byPhone.set(k, s);
    }
    // Asosiy ism va Sheets'dagi bog'langan ismlari bo'yicha
    for (const nk of studentNameKeys(s)) byName.set(nk, [...(byName.get(nk) ?? []), s]);
  }
  const studentById = new Map(students.map((s) => [s.id, s]));

  type SheetAgg = {
    student: SiteStudent | null;
    note: string;
    name: string;
    phone: string;
    group: string;
    month: string;
    amount: number;
    fee: number;
    parts: SheetPart[];
  };
  const sheetAgg = new Map<string, SheetAgg>();
  const matchedIds = new Set<string>();

  for (const rec of records) {
    let student: SiteStudent | null = null;
    let note = "";
    const pk = phoneKey(rec.phone);
    if (pk && byPhone.has(pk)) {
      student = byPhone.get(pk)!;
    } else {
      const candidates = byName.get(nameKey(rec.name)) ?? [];
      if (candidates.length === 1) student = candidates[0];
      else if (candidates.length > 1) note = `Saytda «${rec.name}» ismli ${candidates.length} ta o'quvchi bor — ismini farqlang`;
    }
    if (student) matchedIds.add(student.id);

    const key = `${student ? student.id : `name:${nameKey(rec.name)}`}|${rec.month}`;
    const part: SheetPart = { row: rec.row, date: rec.date, amount: rec.amount, cash: rec.cash, card: rec.card };
    const prev = sheetAgg.get(key);
    if (prev) {
      prev.amount += rec.amount;
      prev.parts.push(part);
      if (rec.fee && rec.fee > prev.fee) prev.fee = rec.fee;
    } else {
      sheetAgg.set(key, {
        student,
        note,
        name: rec.name,
        phone: rec.phone,
        group: rec.course,
        month: rec.month,
        amount: rec.amount,
        fee: rec.fee ?? 0,
        parts: [part],
      });
    }
  }

  // Saytdagi to'lovlar: faqat jadval qamragan davr va (filtr bo'lsa) shu kursdagi o'quvchilar
  const inWindow = (p: SitePayment) =>
    window.basis === "month"
      ? compareMonths(p.month, window.monthFrom) >= 0 && compareMonths(p.month, window.monthTo) <= 0
      : p.paidDate >= window.dateFrom && p.paidDate <= window.dateTo;
  const inScope = (studentId: string) => {
    if (!tokens.length || matchedIds.has(studentId)) return true;
    const st = studentById.get(studentId);
    return !st || !st.group || matchesCourse(st.group, tokens);
  };

  const siteAgg = new Map<string, number>();
  for (const p of sitePayments) {
    if (!inWindow(p) || !inScope(p.studentId)) continue;
    const month = window.basis === "month" ? p.month : p.paidDate.slice(0, 7);
    const key = `${p.studentId}|${month}`;
    siteAgg.set(key, (siteAgg.get(key) ?? 0) + p.amount);
  }

  const mismatches: MismatchResult[] = [];
  let matchedCount = 0;
  const matchedByCourse: Record<string, number> = {};
  const fromSheet = (kind: MismatchKind, s: SheetAgg, siteAmount: number, note = ""): MismatchResult => ({
    kind,
    studentId: s.student?.id ?? null,
    studentName: s.student?.fullName ?? s.name,
    phone: s.student?.phone || s.phone,
    group: s.group,
    month: s.month,
    siteAmount,
    sheetAmount: s.amount,
    sheetRows: s.parts.map((p) => p.row),
    sheetDate: s.parts.find((p) => p.date)?.date ?? "",
    fee: s.fee,
    parts: s.parts,
    note,
  });

  for (const [key, s] of sheetAgg) {
    if (!s.student) {
      mismatches.push(fromSheet("unknown_student", s, 0, s.note));
      continue;
    }
    const siteAmount = siteAgg.get(key);
    if (siteAmount === undefined) mismatches.push(fromSheet("missing_on_site", s, 0));
    else if (siteAmount !== s.amount) mismatches.push(fromSheet("amount_diff", s, siteAmount));
    else {
      matchedCount++;
      bump(matchedByCourse, courseLabel(s.group));
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
      group: st?.group ?? "",
      month,
      siteAmount: amount,
      sheetAmount: 0,
      sheetRows: [],
      sheetDate: "",
      fee: 0,
      parts: [],
      note: "",
    });
  }

  mismatches.sort(
    (a, b) => compareMonths(b.month, a.month) || a.studentName.localeCompare(b.studentName),
  );
  return { mismatches, matchedCount, matchedByCourse };
}

/** Farq kaliti uchun kerakli maydonlar: tekshiruv natijasi ham, bazadagi yozuv ham (ObjectId — `String()` bilan). */
export type MismatchKeySource = {
  kind: string;
  studentId?: unknown;
  studentName?: string | null;
  month: string;
  siteAmount?: number | null;
  sheetAmount?: number | null;
  parts?: { row?: number | null; date?: string | null; amount?: number | null }[] | null;
};

/**
 * Farqning barqaror kaliti — «e'tiborsiz qoldirilgan» farqni keyingi tekshiruvlarda (qo'lda va avtomatik) tanish uchun.
 * Kalitga farq turi, o'quvchi (saytda yo'q bo'lsa — Sheets'dagi ismi), oy, ikkala summa va Sheets qatorlarining sanasi
 * bilan summasi kiradi; qator raqami kirmaydi (jadvalga yuqoridan qator qo'shilsa ham kalit o'zgarmaydi).
 * Shu farqqa tegishli narsa o'zgarsa (summa, sana, yangi to'lov) — kalit ham o'zgaradi va farq yana ko'rinadi.
 */
export function mismatchKey(m: MismatchKeySource, basis: "month" | "date"): string {
  const who = m.studentId ? String(m.studentId) : `name:${nameKey(m.studentName ?? "")}`;
  const sheet = (m.parts ?? [])
    .map((p) => `${p.date || `#${p.row ?? 0}`}=${p.amount ?? 0}`)
    .sort()
    .join(",");
  return [basis, m.kind, who, m.month, m.siteAmount ?? 0, m.sheetAmount ?? 0, sheet].join("|");
}
