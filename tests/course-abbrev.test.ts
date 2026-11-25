import assert from "node:assert/strict";
import { test } from "node:test";
import { courseAbbreviates, resolveCourse, sheetCourseIs } from "../lib/courses";

const COURSES = ["Web dasturlash", "Kompyuter savodxonligi", "Grafik dizayn"];

test("courseAbbreviates: so'z boshlari bo'yicha", () => {
  assert.ok(courseAbbreviates("Kompyuter S", "Kompyuter savodxonligi"));
  assert.ok(courseAbbreviates("kompyuter s.", "Kompyuter savodxonligi"));
  assert.ok(courseAbbreviates("Komp sav", "Kompyuter savodxonligi"));
  assert.ok(courseAbbreviates("Grafik", "Grafik dizayn"));
  assert.ok(!courseAbbreviates("KS Jasurbek", "Kompyuter savodxonligi"));
  assert.ok(!courseAbbreviates("Ko", "Kompyuter savodxonligi"));
  assert.ok(!courseAbbreviates("Kompyuter savodxonligi kech", "Kompyuter savodxonligi"));
  assert.ok(!courseAbbreviates("Web D", "Kompyuter savodxonligi"));
});

test("resolveCourse: aynan mos yoki yagona qisqartma", () => {
  assert.equal(resolveCourse("Kompyuter S", COURSES), "Kompyuter savodxonligi");
  assert.equal(resolveCourse("grafik dizayn", COURSES), "Grafik dizayn");
  assert.equal(resolveCourse("KS Jasurbek", COURSES), null);
  // Ikki kursga to'g'ri kelsa — aniqlanmaydi
  assert.equal(resolveCourse("Web", ["Web dasturlash", "Web dizayn"]), null);
});

test("sheetCourseIs: o'qituvchi doirasi", () => {
  assert.ok(sheetCourseIs("Kompyuter S", "Kompyuter savodxonligi", COURSES));
  assert.ok(sheetCourseIs("Grafik Dizayn", "Grafik dizayn", COURSES));
  assert.ok(!sheetCourseIs("Kompyuter S", "Grafik dizayn", COURSES));
  assert.ok(!sheetCourseIs("KS Jasurbek", "Kompyuter savodxonligi", COURSES));
});
