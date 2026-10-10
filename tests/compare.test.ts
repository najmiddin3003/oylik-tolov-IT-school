import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateAmount, importFromMonth } from "../lib/allocate";
import { parseCSV } from "../lib/csv";
import { compareRecords, courseFilterTokens, DEFAULT_COLUMNS, matchesCourse, parseSheet } from "../lib/compare";
import { nameKey, parseAmount, parseDateCell, parseMonthCell, phoneKey } from "../lib/normalize";
import { parseSheetUrl } from "../lib/sheets";
import { lastScheduledTime, shiftMonth } from "../lib/time";

test("parseAmount", () => {
  assert.equal(parseAmount("500 000"), 500000);
  assert.equal(parseAmount("500,000 so'm"), 500000);
  assert.equal(parseAmount("500.000"), 500000);
  assert.equal(parseAmount("500000.00"), 500000);
  assert.equal(parseAmount("1 200 000,50"), 1200000);
  assert.equal(parseAmount("-400,000"), -400000);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("yo'q"), null);
});

test("parseMonthCell / parseDateCell", () => {
  assert.equal(parseMonthCell("2026-10", 2026), "2026-10");
  assert.equal(parseMonthCell("10.2026", 2026), "2026-10");
  assert.equal(parseMonthCell("Oktabr 2026", 2025), "2026-10");
  assert.equal(parseMonthCell("oktyabr", 2026), "2026-10");
  assert.equal(parseMonthCell("Sentyabr", 2026), "2026-09");
  assert.equal(parseMonthCell("Октябрь 2026", 2026), "2026-10");
  assert.equal(parseMonthCell("May", 2026), "2026-05");
  assert.equal(parseMonthCell("09.10.2026", 2020), "2026-10");
  assert.equal(parseMonthCell("abc", 2026), null);
  assert.equal(parseDateCell("09.10.2026"), "2026-10-09");
  assert.equal(parseDateCell("10/9/2026"), "2026-10-09"); // AQSh formati
  assert.equal(parseDateCell("25/10/2026"), "2026-10-25");
  assert.equal(parseDateCell("2026-10-09 14:30"), "2026-10-09");
});

test("nameKey / phoneKey", () => {
  assert.equal(nameKey("Aliyev  Vali"), nameKey("vali aliyev"));
  assert.equal(nameKey("Go‘zal O'rinova"), nameKey("go'zal oʻrinova"));
  assert.equal(phoneKey("+998 (90) 123-45-67"), "901234567");
  assert.equal(phoneKey("90 123 45 67"), "901234567");
  assert.equal(phoneKey("12"), "");
});

test("time helpers", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  // 06:00 Toshkent = 01:00 UTC
  assert.equal(lastScheduledTime(6, new Date("2026-10-09T00:30:00Z")).toISOString(), "2026-10-08T01:00:00.000Z");
  assert.equal(lastScheduledTime(6, new Date("2026-10-09T01:30:00Z")).toISOString(), "2026-10-09T01:00:00.000Z");
});

test("parseCSV qo'shtirnoq, vergul va katak ichidagi qator ko'chishi", () => {
  const rows = parseCSV('Ism,Summa\r\n"Aliyev, Vali","500,000"\n"Say ""Hi""",1\n"Qaysi \noy",1\n');
  assert.deepEqual(rows, [["Ism", "Summa"], ["Aliyev, Vali", "500,000"], ['Say "Hi"', "1"], ["Qaysi \noy", "1"]]);
});

test("parseSheetUrl: #gid (ochiq varaq) ?gid dan ustun", () => {
  assert.deepEqual(parseSheetUrl("https://docs.google.com/spreadsheets/d/abc_123/edit?gid=0#gid=987"), {
    kind: "gsheet",
    id: "abc_123",
    gid: "987",
  });
  assert.equal((parseSheetUrl("https://docs.google.com/spreadsheets/d/abc/edit?gid=5") as { gid: string }).gid, "5");
  assert.equal((parseSheetUrl("https://docs.google.com/spreadsheets/d/abc/edit") as { gid: string | null }).gid, null);
});

test("kurs filtri", () => {
  const t = courseFilterTokens("Web dasturlash");
  assert.ok(matchesCourse("Web dasturlash", t));
  assert.ok(matchesCourse("  web  DASTURLASH ", t));
  assert.ok(matchesCourse("Web dasturlash (ertalab)", t));
  assert.ok(!matchesCourse("Kompyuter S", t));
  assert.ok(!matchesCourse("", t));
  assert.ok(!matchesCourse("S", t)); // juda qisqa nom filtrga "kirib" qolmasin
  assert.ok(matchesCourse("Grafik Dizayn", courseFilterTokens("web dasturlash, grafik dizayn")));
  assert.ok(matchesCourse("istalgan", courseFilterTokens(""))); // filtr yo'q — hammasi
});

test("allocateAmount: oldindan to'lov keyingi oylarga o'tadi", () => {
  assert.deepEqual(allocateAmount(700000, 300000, "2026-09", new Map()), [
    { month: "2026-09", amount: 300000 },
    { month: "2026-10", amount: 300000 },
    { month: "2026-11", amount: 100000 },
  ]);
  // sentabrga 50 ming to'langan — 200 ming ham sentabrga
  assert.deepEqual(allocateAmount(200000, 300000, "2026-09", new Map([["2026-09", 50000]])), [
    { month: "2026-09", amount: 200000 },
  ]);
  // sentabr to'liq — oktabrga
  assert.deepEqual(allocateAmount(300000, 300000, "2026-09", new Map([["2026-09", 300000]])), [
    { month: "2026-10", amount: 300000 },
  ]);
  // oylik to'lov noma'lum — hammasi bir oyga
  assert.deepEqual(allocateAmount(500000, 0, "2026-09", new Map()), [{ month: "2026-09", amount: 500000 }]);
  // paid xaritasi yangilanadi
  const paid = new Map<string, number>();
  allocateAmount(400000, 300000, "2026-09", paid);
  assert.deepEqual([...paid], [["2026-09", 300000], ["2026-10", 100000]]);
});

test("importFromMonth: bir oy oldingi qarzni yopadi, boshlanishdan oldinga o'tmaydi", () => {
  assert.equal(importFromMonth("2026-10", "2026-09"), "2026-09");
  assert.equal(importFromMonth("2026-10", "2026-10"), "2026-10");
  assert.equal(importFromMonth("2026-10", "2026-01"), "2026-09");
  assert.equal(importFromMonth("2026-09", "2026-11"), "2026-11");
});

// ---------- Oddiy jadval: Ism | Telefon | Oy | Summa | Sana (oy ustuni bor) ----------

const SIMPLE_CSV = `To'lovlar jadvali,,,,
F.I.SH,Telefon,Oy,Summa,Sana
Aliyev Vali,+998901234567,Oktabr 2026,500 000,01.10.2026
Karimova Nodira,,2026-10,300000,
Karimova Nodira,,2026-10,200000,
Toshmatov Ali,93 111 22 33,Oktabr 2026,450000,
Noma'lum Odam,,Oktabr 2026,100000,
Bo'sh qator,,Oktabr 2026,,
Xato summa,,Oktabr 2026,bilmayman,
Jami,,,1 550 000,
`;
const SIMPLE_OPTS = { fallbackYear: 2026, today: "2026-10-10", courseFilter: "" };

test("oddiy jadval: sarlavha, sinonimlar, bo'sh/xato qatorlar, oy bo'yicha davr", () => {
  const parsed = parseSheet(parseCSV(SIMPLE_CSV), DEFAULT_COLUMNS, SIMPLE_OPTS);
  assert.deepEqual(parsed.missingColumns, []);
  assert.equal(parsed.basis, "month");
  assert.equal(parsed.records.length, 5);
  assert.deepEqual(parsed.records[0], {
    row: 3,
    name: "Aliyev Vali",
    phone: "+998901234567",
    course: "",
    month: "2026-10",
    date: "2026-10-01",
    amount: 500000,
    cash: 0,
    card: 0,
    fee: null,
  });
  assert.deepEqual(parsed.skipped, [{ row: 9, reason: "summa tushunarsiz: «bilmayman»" }]);
  assert.deepEqual(parsed.window, { basis: "month", monthFrom: "2026-10", monthTo: "2026-10", dateFrom: "", dateTo: "" });
});

test("oddiy jadval: barcha farq turlari (oy bo'yicha)", () => {
  const parsed = parseSheet(parseCSV(SIMPLE_CSV), DEFAULT_COLUMNS, SIMPLE_OPTS);
  const students = [
    { id: "a", fullName: "Vali Aliyev", phone: "90 123 45 67", parentPhone: "", group: "" }, // telefon orqali
    { id: "k", fullName: "Karimova Nodira", phone: "", parentPhone: "", group: "" }, // ism orqali
    { id: "t", fullName: "Toshmatov Ali", phone: "+998931112233", parentPhone: "", group: "" },
    { id: "s", fullName: "Saidov Sardor", phone: "", parentPhone: "", group: "" },
  ];
  const site = [
    { studentId: "a", month: "2026-10", paidDate: "2026-10-01", amount: 500000 }, // mos
    { studentId: "k", month: "2026-10", paidDate: "2026-10-02", amount: 400000 }, // summa farqi (Sheets: 500 000)
    { studentId: "s", month: "2026-10", paidDate: "2026-10-03", amount: 600000 }, // Sheets'da yo'q
    { studentId: "s", month: "2026-08", paidDate: "2026-10-03", amount: 600000 }, // oraliqdan tashqarida
    // t — saytda yo'q
  ];
  const res = compareRecords(parsed.records, students, site, { window: parsed.window });
  assert.equal(res.matchedCount, 1);
  const byKind = Object.fromEntries(res.mismatches.map((m) => [m.kind, m]));
  assert.equal(res.mismatches.length, 4);
  assert.equal(byKind.amount_diff.studentId, "k");
  assert.equal(byKind.amount_diff.sheetAmount, 500000);
  assert.equal(byKind.amount_diff.siteAmount, 400000);
  assert.deepEqual(byKind.amount_diff.sheetRows, [4, 5]);
  assert.equal(byKind.missing_on_site.studentId, "t");
  assert.equal(byKind.missing_in_sheet.studentId, "s");
  assert.equal(byKind.unknown_student.studentName, "Noma'lum Odam");
});

test("ustun topilmasa xabar beradi", () => {
  const parsed = parseSheet([["A", "B"], ["1", "2"]], DEFAULT_COLUMNS, SIMPLE_OPTS);
  assert.ok(parsed.missingColumns.length > 0);
});

// ---------- O'quv markaz jadvali (kassa daftari): sarlavha 2-qatorda, oy ustuni yo'q ----------
// № | Ism Familiya | Kurs nomi | O'qtuvchi | Kurs Narxi | Naqt | To'lov olingan sana | Plastik | Jami | Qoldiq

const CENTER_CSV = `"Qaysi
oy",1,,,,,,,,
№,Ism Familiya,Kurs nomi,O'qtuvchi,Kurs Narxi,Naqt ,"To'lov olingan
sana",Plastik,Jami,Qoldiq
1,Aliyev Vali,Kompyuter S,Sardorbek,"250,000","250,000",07.09.2026,,"250,000",0
2,Karimov Bobur,Web dasturlash,Najmiddin,"300,000","50,000",07.09.2026,,"50,000","250,000"
3,Sobirov Jasur,Web dasturlash,Najmiddin,"300,000","300,000",11.09.2026,,"300,000",0
4,Asqarov Jamshid,Web dasturlash,Najmiddin,"300,000","700,000",18.09.2026,,"700,000","-400,000"
5,Karimov Bobur,Web dasturlash,Najmiddin,"300,000","200,000",29.09.2026,,"200,000","100,000"
6,Toshmatova Dilnoza,Web dasturlash,Najmiddin,"300,000",,03.10.2026,"300,000","300,000",0
7,Sobirov Jasur,Web dasturlash,Najmiddin,"300,000","300,000",05.10.2026,,"300,000",0
8,Ergashev Anvar,Grafik Dizayn,Sardorbek,"300,000","300,000",08.10.2026,,"300,000",0
,,,,,,,,,0
,,,,,,,,,0
`;
const CENTER_OPTS = { fallbackYear: 2026, today: "2026-10-10", courseFilter: "Web dasturlash" };

test("markaz jadvali: 2-qatordagi sarlavha, kurs filtri, naqd/plastik, sana bo'yicha davr", () => {
  const parsed = parseSheet(parseCSV(CENTER_CSV), DEFAULT_COLUMNS, CENTER_OPTS);
  assert.deepEqual(parsed.missingColumns, []);
  assert.equal(parsed.basis, "date");
  assert.equal(parsed.records.length, 6); // faqat Web dasturlash
  assert.equal(parsed.filteredOut, 2); // Kompyuter S + Grafik Dizayn
  assert.deepEqual(parsed.skipped, []); // pastdagi bo'sh "0" qatorlar shovqin qilmaydi
  // davr butun jadval bo'yicha: 07.09 dan (oy boshi) 08.10 gacha (Grafik Dizayn qatori)
  assert.deepEqual(parsed.window, {
    basis: "date",
    dateFrom: "2026-09-01",
    dateTo: "2026-10-08",
    monthFrom: "2026-09",
    monthTo: "2026-10",
  });
  assert.deepEqual(parsed.records[0], {
    row: 4,
    name: "Karimov Bobur",
    phone: "",
    course: "Web dasturlash",
    month: "2026-09",
    date: "2026-09-07",
    amount: 50000,
    cash: 50000,
    card: 0,
    fee: 300000,
  });
  const plastik = parsed.records.find((r) => r.name === "Toshmatova Dilnoza")!;
  assert.deepEqual([plastik.cash, plastik.card, plastik.amount], [0, 300000, 300000]);
});

test("markaz jadvali: davr bugundan oshmaydi, filtrsiz hamma qator", () => {
  const capped = parseSheet(parseCSV(CENTER_CSV), DEFAULT_COLUMNS, { ...CENTER_OPTS, today: "2026-10-06" });
  assert.equal(capped.window?.dateTo, "2026-10-06");
  const all = parseSheet(parseCSV(CENTER_CSV), DEFAULT_COLUMNS, { ...CENTER_OPTS, courseFilter: "" });
  assert.equal(all.records.length, 8);
  assert.equal(all.filteredOut, 0);
});

test("markaz jadvali: to'lov sanasi bo'yicha solishtirish", () => {
  const parsed = parseSheet(parseCSV(CENTER_CSV), DEFAULT_COLUMNS, CENTER_OPTS);
  const students = [
    { id: "kb", fullName: "Karimov Bobur", phone: "", parentPhone: "", group: "Web dasturlash" },
    { id: "sj", fullName: "Jasur Sobirov", phone: "", parentPhone: "", group: "" },
    { id: "aj", fullName: "Asqarov Jamshid", phone: "", parentPhone: "", group: "Web dasturlash" },
    { id: "rh", fullName: "Rahimov Husan", phone: "", parentPhone: "", group: "Web dasturlash" },
    { id: "hk", fullName: "Hasanov Kamol", phone: "", parentPhone: "", group: "Kompyuter S" },
  ];
  const site = [
    // Karimov: ikki to'lov, ikkalasi sentabr uchun — Sheets'da ham sentabrda 50+200
    { studentId: "kb", month: "2026-09", paidDate: "2026-09-07", amount: 50000 },
    { studentId: "kb", month: "2026-09", paidDate: "2026-09-29", amount: 200000 },
    // Sobirov: 11.09 — sentabr, 05.10 — oktabr
    { studentId: "sj", month: "2026-09", paidDate: "2026-09-11", amount: 300000 },
    { studentId: "sj", month: "2026-10", paidDate: "2026-10-05", amount: 300000 },
    // Asqarov: 700 ming 18.09 da, saytda 3 oyga taqsimlangan — sana bo'yicha baribir 700 ming
    { studentId: "aj", month: "2026-09", paidDate: "2026-09-18", amount: 300000 },
    { studentId: "aj", month: "2026-10", paidDate: "2026-09-18", amount: 300000 },
    { studentId: "aj", month: "2026-11", paidDate: "2026-09-18", amount: 100000 },
    // Rahimov: 01.10 — jadvalda yo'q (farq); 09.10 — jadval hali bu sanagacha yuritilmagan (e'tiborsiz)
    { studentId: "rh", month: "2026-10", paidDate: "2026-10-01", amount: 300000 },
    { studentId: "rh", month: "2026-11", paidDate: "2026-10-09", amount: 300000 },
    // Hasanov: boshqa kurs — solishtirilmaydi
    { studentId: "hk", month: "2026-09", paidDate: "2026-09-10", amount: 250000 },
  ];
  const res = compareRecords(parsed.records, students, site, { window: parsed.window, courseFilter: "Web dasturlash" });
  assert.equal(res.matchedCount, 4); // Karimov-sen, Sobirov-sen, Sobirov-okt, Asqarov-sen
  assert.equal(res.mismatches.length, 2);
  const unknown = res.mismatches.find((m) => m.kind === "unknown_student")!;
  assert.equal(unknown.studentName, "Toshmatova Dilnoza");
  assert.equal(unknown.group, "Web dasturlash");
  assert.equal(unknown.fee, 300000);
  assert.deepEqual(unknown.parts, [{ row: 8, date: "2026-10-03", amount: 300000, cash: 0, card: 300000 }]);
  const missing = res.mismatches.find((m) => m.kind === "missing_in_sheet")!;
  assert.deepEqual([missing.studentId, missing.month, missing.siteAmount], ["rh", "2026-10", 300000]);
});

test("markaz jadvali: bir o'quvchining bir oydagi ikki qatori bitta farq bo'lib qo'shiladi", () => {
  const parsed = parseSheet(parseCSV(CENTER_CSV), DEFAULT_COLUMNS, CENTER_OPTS);
  const res = compareRecords(parsed.records, [], [], { window: parsed.window, courseFilter: "Web dasturlash" });
  const karimov = res.mismatches.filter((m) => m.studentName === "Karimov Bobur");
  assert.equal(karimov.length, 1);
  assert.equal(karimov[0].sheetAmount, 250000);
  assert.deepEqual(karimov[0].sheetRows, [4, 7]);
  // Sobirov: sentabr va oktabr — ikki alohida farq
  assert.equal(res.mismatches.filter((m) => m.studentName === "Sobirov Jasur").length, 2);
});
