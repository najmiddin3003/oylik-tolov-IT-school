import assert from "node:assert/strict";
import { test } from "node:test";
import { activityGroup, deviceLabel } from "../lib/activity-rules";
import { parseCSV } from "../lib/csv";
import { compareRecords, courseLabel, DEFAULT_COLUMNS, parseSheet } from "../lib/compare";
import {
  courseFee,
  courseKey,
  courseNames,
  coursesForStorage,
  courseStudentsToAssign,
  courseTeacher,
  courseTeachers,
  DEFAULT_COURSES,
  normalizeCourses,
  sameCourse,
  teacherCourses,
  teacherOnCourseChange,
} from "../lib/courses";

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
      { name: "Web dasturlash", fee: 300000, teachers: [] },
      { name: "Grafik dizayn", fee: null, teachers: [] },
    ],
  );
  // O'quvchilarda uchraydigan, ro'yxatda yo'q nomlar ham tanlovga qo'shiladi (takrorsiz)
  assert.deepEqual(courseNames(DEFAULT_COURSES, ["web dasturlash", "Ingliz tili", ""]), ["Web dasturlash", "Kompyuter savodxonligi", "Grafik dizayn", "Ingliz tili"]);
  assert.equal(courseFee(DEFAULT_COURSES, "WEB DASTURLASH"), 300000);
  assert.equal(courseFee(DEFAULT_COURSES, "Grafik dizayn"), null);
});

test("kurs o'qituvchisi: kursga biriktirish va kurs almashganda o'qituvchi", () => {
  const A = "a".repeat(24);
  const B = "b".repeat(24);
  const C = "c".repeat(24);
  // Bazadan o'qilgan o'qituvchilar (ObjectId ham, satr ham) saqlanadi; eski yozuvdagi yagona "teacher" ham o'qiladi;
  // noto'g'ri qiymat va takrorlar tashlab yuboriladi
  const courses = normalizeCourses([
    { name: "Web dasturlash", fee: 300000, teacher: { toString: () => A } },
    { name: "Grafik dizayn", fee: 300000, teacher: "noto'g'ri" },
    { name: "Kompyuter savodxonligi", fee: 250000, teachers: [B, { toString: () => C }, B, "x"], teacher: B },
    { name: "Ingliz tili", fee: null, teachers: [], teacher: null },
  ]);
  assert.deepEqual(
    courses.map((c) => c.teachers),
    [[A], [], [B, C], []],
  );
  // Avtomatik biriktirish — faqat yagona o'qituvchi bo'lsa
  assert.equal(courseTeacher(courses, "web  DASTURLASH"), A);
  assert.equal(courseTeacher(courses, "Grafik dizayn"), null);
  assert.equal(courseTeacher(courses, "Kompyuter savodxonligi"), null, "bir nechta o'qituvchi — qo'lda tanlanadi");
  assert.deepEqual(courseTeachers(courses, "kompyuter savodxonligi"), [B, C]);
  // O'qituvchi o'zi o'quvchi qo'sha oladigan kurslar — faqat unga biriktirilganlari (narxi bilan)
  assert.deepEqual(teacherCourses(courses, A).map((c) => [c.name, c.fee]), [["Web dasturlash", 300000]]);
  assert.deepEqual(teacherCourses(courses, C).map((c) => c.name), ["Kompyuter savodxonligi"]);
  assert.deepEqual(teacherCourses(courses, "d".repeat(24)), [], "kursga biriktirilmagan o'qituvchi");
  assert.deepEqual(teacherCourses(courses, null), []);
  assert.equal(courseTeacher(courses, ""), null);
  // Bazaga yozish: yagona o'qituvchi eski versiya uchun "teacher" maydoniga ham yoziladi
  assert.deepEqual(coursesForStorage(courses).map((c) => c.teacher), [A, null, null, null]);

  // Kursga o'qituvchi biriktirilganda: o'qituvchisizlar o'tadi, boshqa o'qituvchinikilar va boshqa kurslar o'zgarmaydi
  const students = [
    { id: "1", group: "Web dasturlash", teacher: null },
    { id: "2", group: "web dasturlash", teacher: null },
    { id: "3", group: "Web dasturlash", teacher: C },
    { id: "4", group: "Web dasturlash", teacher: A },
    { id: "5", group: "Grafik dizayn", teacher: null },
    { id: "6", group: "", teacher: null },
  ];
  assert.deepEqual(courseStudentsToAssign(students, "Web dasturlash", A), ["1", "2"]);
  // Kurs o'qituvchisi A dan B ga almashsa — A ning shu kursdagi o'quvchilari ham B ga o'tadi (C nikilar — yo'q)
  assert.deepEqual(courseStudentsToAssign(students, "Web dasturlash", B, A), ["1", "2", "4"]);
  assert.deepEqual(courseStudentsToAssign(students, "Ingliz tili", A), []);

  // O'quvchining kursi tanlanganda/o'zgarganda o'qituvchisi
  assert.equal(teacherOnCourseChange(null, null, A), A, "o'qituvchisiz — kurs o'qituvchisi");
  assert.equal(teacherOnCourseChange(A, A, B), B, "avvalgi kursniki edi — yangi kursnikiga");
  assert.equal(teacherOnCourseChange(A, A, null), null, "yangi kursda o'qituvchi yo'q");
  assert.equal(teacherOnCourseChange(C, A, B), C, "boshqa o'qituvchi tanlangan — o'zgarmaydi");
  assert.equal(teacherOnCourseChange(C, null, B), C);
  assert.equal(teacherOnCourseChange(null, A, null), null);
  // Yangi kursda bir nechta o'qituvchi: joriy o'qituvchi ulardan biri bo'lsa — qoladi, bo'lmasa (avvalgi kursniki) — bo'sh
  assert.equal(teacherOnCourseChange(B, B, null, [B, C]), B, "Sardorbek savodxonlikka ham dars beradi — qoladi");
  assert.equal(teacherOnCourseChange(A, A, null, [B, C]), null, "yangi kursda dars bermaydi — qo'lda tanlanadi");
  assert.equal(teacherOnCourseChange(null, null, null, [B, C]), null);
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
