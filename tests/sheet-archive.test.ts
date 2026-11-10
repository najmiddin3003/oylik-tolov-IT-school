import assert from "node:assert/strict";
import { test } from "node:test";
import {
  columnLetter,
  filenameFromDisposition,
  isBlankRow,
  monthFromTitle,
  pickArchiveMonth,
  rowKeys,
  sanitizeSheetHtml,
  sheetDocument,
  toCSV,
  trimSheetRows,
} from "../lib/sheet-archive-rules";
import { sheetSourceKey } from "../lib/sheets";
import { readZip } from "../lib/zip";

test("sheets arxivi: fayl nomi Content-Disposition dan", () => {
  // Google CSV eksportining haqiqiy sarlavhasi
  const h = `attachment; filename="Chortoqtumanioktabr-Oquvchilar.csv"; filename*=UTF-8''Chortoq%20tumani%20oktabr%20-%20O%27quvchilar.csv`;
  assert.equal(filenameFromDisposition(h), "Chortoq tumani oktabr - O'quvchilar.csv");
  assert.equal(filenameFromDisposition('attachment; filename="Jadval.xlsx"'), "Jadval.xlsx");
  assert.equal(filenameFromDisposition(null), "");
});

test("sheets arxivi: jadval nomidagi oy va arxivlanadigan oy", () => {
  assert.deepEqual(monthFromTitle("Chortoq tumani oktabr"), { month: 10, year: null });
  assert.deepEqual(monthFromTitle("Chortoq tumani Oktyabr 2026 - O'quvchilar"), { month: 10, year: 2026 });
  assert.deepEqual(monthFromTitle("Ноябрь отчёт"), { month: 11, year: null });
  assert.deepEqual(monthFromTitle("Noyabrdagi to'lovlar"), { month: 11, year: null });
  assert.equal(monthFromTitle("O'quv markaz to'lovlari"), null);
  // Qisqa so'zlar faqat to'liq: «martaba», «mayda» — oy emas
  assert.equal(monthFromTitle("Martaba jadvali mayda"), null);
  assert.deepEqual(monthFromTitle("May 2027"), { month: 5, year: 2027 });

  // Oylik olingan, arxivlanmagan oylar ichidan: nomdagi oy — faqat o'sha
  assert.equal(pickArchiveMonth(["2026-10"], "Chortoq tumani oktabr"), "2026-10");
  // Noyabr jadvali qo'yilgan, oktabr oyligi kech yozildi — noyabr jadvali oktabr deb arxivlanmaydi
  assert.equal(pickArchiveMonth(["2026-10"], "Chortoq tumani noyabr"), null);
  assert.equal(pickArchiveMonth(["2026-11", "2026-10"], "Chortoq tumani oktabr"), "2026-10");
  // Nomda oy yo'q — eng oxirgi oy
  assert.equal(pickArchiveMonth(["2026-10", "2026-11"], "To'lovlar"), "2026-11");
  assert.equal(pickArchiveMonth([], "To'lovlar"), null);
  // Yil yozilgan bo'lsa — yil ham mos kelishi kerak
  assert.equal(pickArchiveMonth(["2026-10"], "Oktabr 2025"), null);
});

test("sheets arxivi: bo'sh qatorlar va qator kalitlari", () => {
  assert.equal(isBlankRow(["", " ", "0"]), true);
  assert.equal(isBlankRow(["", "Aliyev Vali", "0"]), false);
  const rows = [["№", "Ism"], ["1", "Aliyev Vali"], ["", "0"], ["", ""]];
  assert.deepEqual(trimSheetRows(rows), [["№", "Ism"], ["1", "Aliyev Vali"]]);

  const a = rowKeys([["1", "Aliyev", "300,000"], ["2", "Valiyev", "200,000"]]);
  assert.equal(a.length, 2);
  // Ustiga qator qo'shilsa — mavjud qatorlarning kaliti o'zgarmaydi (faqat raqami)
  const b = rowKeys([["0", "Yangi", "100"], ["1", "Aliyev", "300,000"], ["", "", "0"], ["2", "Valiyev", "200,000"]]);
  assert.deepEqual(b.map((k) => k.index), [0, 1, 3]);
  assert.equal(b[1].key, a[0].key);
  assert.equal(b[2].key, a[1].key);
  // Bir xil qatorlar ajratiladi; bo'shliq farqi — bir xil qator
  const dup = rowKeys([["x", "1"], ["x ", " 1"], ["x", "1"]]);
  assert.equal(new Set(dup.map((k) => k.key)).size, 3);
  assert.equal(rowKeys([["x", "1"]])[0].key, rowKeys([[" x", "1 "]])[0].key);
  // Qator o'zgartirilsa — yangi kalit
  assert.notEqual(rowKeys([["1", "Aliyev", "300,000"]])[0].key, rowKeys([["1", "Aliyev", "200,000"]])[0].key);
});

test("sheets arxivi: HTML tozalash, CSV, ustun harflari, jadval kaliti", () => {
  const dirty = `<link rel="stylesheet" href="x.css"><script>alert(1)</script><table onclick="steal()"><tr><td class="s1" onmouseover='x()'>A</td><td><a href="javascript:alert(2)">b</a></td></tr></table><iframe src="//evil"></iframe>`;
  const clean = sanitizeSheetHtml(dirty);
  assert.doesNotMatch(clean, /<script|<link|onclick|onmouseover|javascript:|<iframe/i);
  assert.match(clean, /<td class="s1">A<\/td>/);
  const doc = sheetDocument(".a{background:url(https://x/y.png)}@import url(z.css);", "<table></table>");
  assert.doesNotMatch(doc, /url\(|@import/);
  assert.match(doc, /^<!doctype html>/);

  assert.equal(toCSV([["Ism", "Summa"], ['Ali "Vali"', "300,000"], ["Qaysi\noy", ""]]), 'Ism,Summa\r\n"Ali ""Vali""","300,000"\r\n"Qaysi\noy",');
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(columnLetter), ["A", "Z", "AA", "AB", "ZZ", "AAA"]);

  const id = "1j04dvYflY7cEstYKF7JWyYwHSdh20fpLv9wZi_F7-pI";
  assert.equal(sheetSourceKey(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=5#gid=1751731878`), `gsheet:${id}:1751731878`);
  assert.equal(sheetSourceKey(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`), `gsheet:${id}:`);
  assert.equal(sheetSourceKey("salom"), null);
});

test("zip: Google HTML eksportini ochish (deflate va siqilmagan)", () => {
  const b64 =
    "UEsDBBQAAAAAAAAAIQAAAAAAAAAAAAAAAAAKAAAAcmVzb3VyY2VzL1BLAwQUAAAACACwTmpdWdjwRBkAAABoAQAAEwAAAHJlc291cmNlcy9zaGVldC5jc3PTK09MS8tJrU7Oz8kvsipKTanVGxWhgQgAUEsDBBQAAAAAALBOal32zK+HJAAAACQAAAAQAAAATydxdXZjaGlsYXIuaHRtbDx0YWJsZT48dHI+PHRkPklzbTwvdGQ+PC90cj48L3RhYmxlPlBLAQIUAxQAAAAAAAAAIQAAAAAAAAAAAAAAAAAKAAAAAAAAAAAAAACAAQAAAAByZXNvdXJjZXMvUEsBAhQDFAAAAAgAsE5qXVnY8EQZAAAAaAEAABMAAAAAAAAAAAAAAIABKAAAAHJlc291cmNlcy9zaGVldC5jc3NQSwECFAMUAAAAAACwTmpd9syvhyQAAAAkAAAAEAAAAAAAAAAAAAAAgAFyAAAATydxdXZjaGlsYXIuaHRtbFBLBQYAAAAAAwADALcAAADEAAAAAAA=";
  const entries = readZip(Buffer.from(b64, "base64"));
  assert.deepEqual(
    entries.map((e) => e.name),
    ["resources/sheet.css", "O'quvchilar.html"],
  );
  assert.equal(entries[0].data.toString(), ".waffle{color:red}".repeat(20));
  assert.equal(entries[1].data.toString(), "<table><tr><td>Ism</td></tr></table>");
  assert.throws(() => readZip(Buffer.from("bu zip emas")), /ZIP/);
});
