import assert from "node:assert/strict";
import { test } from "node:test";
import { activityGroup, deviceLabel } from "../lib/activity-rules";
import { parseCSV } from "../lib/csv";
import { compareRecords, courseLabel, DEFAULT_COLUMNS, parseSheet } from "../lib/compare";
import { courseFee, courseKey, courseNames, DEFAULT_COURSES, normalizeCourses, sameCourse } from "../lib/courses";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";

test("yangi bo'limlarga kirish huquqi", async () => {
  const { canAccess } = await import("../lib/session");
  // Kassa — rahbar va administrator
  assert.equal(canAccess("owner", "/kassa"), true);
  assert.equal(canAccess("admin", "/kassa"), true);
  assert.equal(canAccess("teacher", "/kassa"), false);
  // Olingan avans/oylik — o'qituvchi va administrator (rahbar hammasiga kiradi)
  assert.equal(canAccess("teacher", "/olinganlar"), true);
  assert.equal(canAccess("admin", "/olinganlar"), true);
  // Faoliyat tarixi — hamma
  for (const r of ["owner", "admin", "teacher"] as const) assert.equal(canAccess(r, "/faoliyat"), true, r);
  // Reja va yangiliklar — faqat rahbar
  assert.equal(canAccess("owner", "/reja"), true);
  assert.equal(canAccess("admin", "/reja"), false);
  assert.equal(canAccess("teacher", "/reja"), false);
  // o'xshash nomli yo'llar ochilib qolmasin
  assert.equal(canAccess("admin", "/kassa-boshqa"), false);
  assert.equal(canAccess("teacher", "/olinganlarx"), false);
});

test("kurslar: ro'yxat, taqqoslash va narx", () => {
  assert.equal(courseKey("  Web   Dasturlash "), "web dasturlash");
  assert.equal(sameCourse("Grafik dizayn", "grafik  DIZAYN"), true);
  assert.equal(sameCourse("", ""), false);
  assert.deepEqual(normalizeCourses(undefined), DEFAULT_COURSES);
  assert.deepEqual(
    normalizeCourses([{ name: " Web dasturlash ", fee: 300000 }, { name: "web dasturlash", fee: 1 }, { name: "", fee: 5 }, { name: "Grafik dizayn", fee: -5 }]),
    [
      { name: "Web dasturlash", fee: 300000 },
      { name: "Grafik dizayn", fee: null },
    ],
  );
  // O'quvchilarda uchraydigan, ro'yxatda yo'q nomlar ham tanlovga qo'shiladi (takrorsiz)
  assert.deepEqual(courseNames(DEFAULT_COURSES, ["web dasturlash", "Ingliz tili", ""]), ["Web dasturlash", "Kompyuter savodxonligi", "Grafik dizayn", "Ingliz tili"]);
  assert.equal(courseFee(DEFAULT_COURSES, "WEB DASTURLASH"), 300000);
  assert.equal(courseFee(DEFAULT_COURSES, "Grafik dizayn"), null);
});

test("faoliyat jurnali: amal guruhi va qurilma nomi", () => {
  assert.equal(activityGroup("login"), "auth");
  assert.equal(activityGroup("auth.password"), "auth");
  assert.equal(activityGroup("payment.add"), "payment");
  assert.equal(activityGroup("kassa.accept"), "kassa");
  assert.equal(activityGroup("export.hisobot"), "export");
  assert.equal(activityGroup("noma'lum.amal"), "settings");
  assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"), "Chrome · Windows");
  assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), "Safari · iPhone");
  assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 Edg/141.0"), "Edge · Android");
  assert.equal(deviceLabel(""), "");
});

const SHEET = `№,Ism Familiya,Kurs nomi,Kurs Narxi,Naqt,To'lov olingan sana,Plastik,Jami
1,Aliyev Vali,Kompyuter S,"250,000","250,000",07.09.2026,,"250,000"
2,Sobirov Jasur,Web dasturlash,"300,000","300,000",11.09.2026,,"300,000"
3,Sobirov Jasur,Web dasturlash,"300,000","300,000",05.10.2026,,"300,000"
4,Ergashev Anvar,Grafik Dizayn,"300,000","300,000",08.10.2026,,"300,000"
5,Karimov Bobur,Web dasturlash,"300,000","100,000",06.10.2026,,"100,000"
`;

test("Sheets: kurslar bo'yicha qatorlar, filtr va mos kelganlar", () => {
  const opts = { fallbackYear: 2026, today: "2026-10-10" };
  const filtered = parseSheet(parseCSV(SHEET), DEFAULT_COLUMNS, { ...opts, courseFilter: "Web dasturlash" });
  assert.deepEqual(filtered.rowsByCourse, { "Web dasturlash": 3 });
  assert.deepEqual(filtered.filteredByCourse, { "Kompyuter S": 1, "Grafik Dizayn": 1 });

  const all = parseSheet(parseCSV(SHEET), DEFAULT_COLUMNS, opts);
  assert.deepEqual(all.rowsByCourse, { "Kompyuter S": 1, "Web dasturlash": 3, "Grafik Dizayn": 1 });
  assert.deepEqual(all.filteredByCourse, {});

  const students = [
    { id: "s1", fullName: "Sobirov Jasur", phone: "", parentPhone: "", group: "Web dasturlash" },
    { id: "s2", fullName: "Ergashev Anvar", phone: "", parentPhone: "", group: "Grafik dizayn" },
    { id: "s3", fullName: "Karimov Bobur", phone: "", parentPhone: "", group: "Web dasturlash" },
  ];
  const site = [
    { studentId: "s1", month: "2026-09", paidDate: "2026-09-11", amount: 300000 },
    { studentId: "s1", month: "2026-10", paidDate: "2026-10-05", amount: 300000 },
    { studentId: "s2", month: "2026-10", paidDate: "2026-10-08", amount: 300000 },
    { studentId: "s3", month: "2026-10", paidDate: "2026-10-06", amount: 150000 }, // summa farqi
  ];
  const res = compareRecords(all.records, students, site, { window: all.window });
  assert.deepEqual(res.matchedByCourse, { "Web dasturlash": 2, "Grafik Dizayn": 1 });
  assert.equal(res.matchedCount, 3);
  // Farqlar kursi bilan: summa farqi (Web) va saytda yo'q o'quvchi (Kompyuter S)
  assert.deepEqual(res.mismatches.map((m) => [m.kind, courseLabel(m.group)]).sort(), [
    ["amount_diff", "Web dasturlash"],
    ["unknown_student", "Kompyuter S"],
  ]);
  assert.equal(courseLabel("  "), "Kursi yozilmagan");
});
