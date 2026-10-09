import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCSV } from "../lib/csv";
import { compareRecords, DEFAULT_COLUMNS, parseSheet } from "../lib/compare";
import { nameKey, parseAmount, parseDateCell, parseMonthCell, phoneKey } from "../lib/normalize";
import { lastScheduledTime, shiftMonth } from "../lib/time";

test("parseAmount", () => {
  assert.equal(parseAmount("500 000"), 500000);
  assert.equal(parseAmount("500,000 so'm"), 500000);
  assert.equal(parseAmount("500.000"), 500000);
  assert.equal(parseAmount("500000.00"), 500000);
  assert.equal(parseAmount("1 200 000,50"), 1200000);
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

test("parseCSV qo'shtirnoq va vergullar", () => {
  const rows = parseCSV('Ism,Summa\r\n"Aliyev, Vali","500,000"\n"Say ""Hi""",1\n');
  assert.deepEqual(rows, [["Ism", "Summa"], ["Aliyev, Vali", "500,000"], ['Say "Hi"', "1"]]);
});

const CSV = `To'lovlar jadvali,,,,
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

test("parseSheet: sarlavhani topadi, sinonimlar, bo'sh/xato qatorlar", () => {
  const parsed = parseSheet(parseCSV(CSV), DEFAULT_COLUMNS, 2026);
  assert.deepEqual(parsed.missingColumns, []);
  assert.equal(parsed.records.length, 5);
  assert.deepEqual(parsed.records[0], {
    row: 3,
    name: "Aliyev Vali",
    phone: "+998901234567",
    month: "2026-10",
    amount: 500000,
    date: "2026-10-01",
  });
  assert.deepEqual(parsed.skipped, [{ row: 9, reason: "summa tushunarsiz: «bilmayman»" }]);
});

test("compareRecords: barcha farq turlari", () => {
  const parsed = parseSheet(parseCSV(CSV), DEFAULT_COLUMNS, 2026);
  const students = [
    { id: "a", fullName: "Vali Aliyev", phone: "90 123 45 67", parentPhone: "" }, // telefon orqali
    { id: "k", fullName: "Karimova Nodira", phone: "", parentPhone: "" }, // ism orqali
    { id: "t", fullName: "Toshmatov Ali", phone: "+998931112233", parentPhone: "" },
    { id: "s", fullName: "Saidov Sardor", phone: "", parentPhone: "" },
  ];
  const site = [
    { studentId: "a", month: "2026-10", amount: 500000 }, // mos
    { studentId: "k", month: "2026-10", amount: 400000 }, // summa farqi (Sheets: 500 000)
    { studentId: "s", month: "2026-10", amount: 600000 }, // Sheets'da yo'q
    { studentId: "s", month: "2026-08", amount: 600000 }, // oraliqdan tashqarida — e'tiborsiz
    // t — saytda yo'q
  ];
  const res = compareRecords(parsed.records, students, site);
  assert.equal(res.matchedCount, 1);
  assert.equal(res.monthFrom, "2026-10");
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

test("parseSheet: ustun topilmasa xabar beradi", () => {
  const parsed = parseSheet([["A", "B"], ["1", "2"]], DEFAULT_COLUMNS, 2026);
  assert.ok(parsed.missingColumns.length > 0);
});
