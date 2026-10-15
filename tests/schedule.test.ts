import assert from "node:assert/strict";
import { test } from "node:test";
import {
  daysLabel,
  lessonState,
  matchesDayFilter,
  minutesUntil,
  nextLesson,
  nextLessonLabel,
  normalizeLessons,
  parseDayFilter,
  parseLessons,
  popularSchedules,
  scheduleKind,
  scheduleLabel,
  shiftEnd,
  tashkentClock,
  untilLabel,
  weekdayOfIso,
  type Lesson,
} from "../lib/schedule";

const toq: Lesson[] = [
  { day: 1, start: "14:00", end: "16:00" },
  { day: 3, start: "14:00", end: "16:00" },
  { day: 5, start: "14:00", end: "16:00" },
];

test("jadval: formadan o'qish va tekshirish", () => {
  assert.deepEqual(parseLessons(""), { lessons: [] });
  assert.deepEqual(parseLessons("[]"), { lessons: [] });
  // kun tartibida qaytadi
  assert.deepEqual(parseLessons(JSON.stringify([toq[2], toq[0], toq[1]])), { lessons: toq });
  assert.deepEqual(parseLessons("buzilgan"), { error: "Dars jadvali noto‘g‘ri" });
  assert.deepEqual(parseLessons(JSON.stringify([{ day: 8, start: "14:00", end: "16:00" }])), { error: "Dars kunlari noto‘g‘ri" });
  assert.deepEqual(parseLessons(JSON.stringify([toq[0], toq[0]])), { error: "Dars kunlari noto‘g‘ri" });
  // vaqt tanlanmagan — hamma kunda bir xil bo'lsa, kun nomisiz xabar
  assert.deepEqual(parseLessons(JSON.stringify([{ day: 1, start: "", end: "" }, { day: 3, start: "", end: "" }])), { error: "Dars boshlanish vaqtini tanlang" });
  // har xil vaqtlar — xabarda kun nomi
  assert.deepEqual(parseLessons(JSON.stringify([toq[0], { day: 6, start: "11:00", end: "10:00" }])), { error: "Shanba: dars tugashi boshlanishidan keyin bo‘lishi kerak" });
  assert.deepEqual(parseLessons(JSON.stringify([{ day: 2, start: "24:00", end: "25:00" }])), { error: "Dars boshlanish vaqtini tanlang" });
  // juda uzun yoki 7 tadan ko'p
  assert.ok("error" in parseLessons(JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ day: i + 1, start: "09:00", end: "10:00" })))));
});

test("jadval: bazadagi qiymatni tozalash", () => {
  assert.deepEqual(normalizeLessons(undefined), []);
  assert.deepEqual(normalizeLessons(null), []);
  assert.deepEqual(
    normalizeLessons([{ day: 5, start: "14:00", end: "16:00" }, { day: 1, start: "14:00", end: "16:00" }, { day: 1, start: "09:00", end: "10:00" }, { day: 2, start: "x", end: "y" }]),
    [{ day: 1, start: "14:00", end: "16:00" }, { day: 5, start: "14:00", end: "16:00" }],
  );
});

test("jadval: nomlar", () => {
  assert.equal(daysLabel([1, 3, 5]), "Toq kunlar");
  assert.equal(daysLabel([6, 4, 2]), "Juft kunlar");
  assert.equal(daysLabel([1, 2, 3, 4, 5, 6]), "Har kuni");
  assert.equal(daysLabel([1, 2, 3, 4, 5]), "Du – Ju");
  assert.equal(daysLabel([1, 4]), "Du, Pa");
  assert.equal(scheduleLabel(toq), "Toq kunlar · 14:00–16:00");
  assert.equal(scheduleLabel([]), "");
  assert.equal(
    scheduleLabel([{ day: 1, start: "14:00", end: "16:00" }, { day: 3, start: "14:00", end: "16:00" }, { day: 6, start: "10:00", end: "12:00" }]),
    "Du, Ch · 14:00–16:00; Sh · 10:00–12:00",
  );
});

test("jadval: tugash vaqti boshlanish bilan suriladi", () => {
  assert.equal(shiftEnd("", "", "14:00"), "16:00"); // standart — 2 soat
  assert.equal(shiftEnd("14:00", "15:30", "15:00"), "16:30"); // davomiylik saqlanadi
  assert.equal(shiftEnd("14:00", "16:00", "23:00"), "23:59"); // kun chegarasidan chiqmaydi
  assert.equal(shiftEnd("", "", "23:55"), "23:59"); // eng kech boshlanishda ham tugash boshlanishdan keyin
});

test("jadval: Toshkent vaqti va hafta kuni", () => {
  // 2026-10-12 — dushanba. UTC 08:30 = Toshkent 13:30
  const c = tashkentClock(Date.UTC(2026, 9, 12, 8, 30));
  assert.deepEqual(c, { iso: "2026-10-12", weekday: 1, minutes: 13 * 60 + 30 });
  // UTC 20:00 yakshanba = Toshkentda dushanba 01:00
  assert.deepEqual(tashkentClock(Date.UTC(2026, 9, 11, 20, 0)), { iso: "2026-10-12", weekday: 1, minutes: 60 });
  assert.equal(weekdayOfIso("2026-10-12"), 1);
  assert.equal(weekdayOfIso("2026-10-18"), 7);
});

test("jadval: keyingi dars va holat", () => {
  const mon = (h: number, m = 0) => ({ weekday: 1, minutes: h * 60 + m });
  // darsdan oldin
  assert.deepEqual(nextLesson(toq, mon(13, 20)), { lesson: toq[0], inDays: 0, now: false });
  assert.equal(nextLessonLabel(nextLesson(toq, mon(13, 20))!), "Bugun, 14:00");
  assert.equal(minutesUntil(nextLesson(toq, mon(13, 20)), mon(13, 20)), 40);
  // dars paytida
  assert.equal(nextLessonLabel(nextLesson(toq, mon(15))!), "Hozir darsda (16:00 gacha)");
  assert.equal(minutesUntil(nextLesson(toq, mon(15)), mon(15)), 0);
  // dars tugagach — chorshanba
  assert.deepEqual(nextLesson(toq, mon(16)), { lesson: toq[1], inDays: 2, now: false });
  assert.equal(nextLessonLabel(nextLesson(toq, mon(17))!), "Chorshanba, 14:00");
  // juma kechqurun -> keyingi dushanba (3 kundan keyin)
  assert.equal(nextLessonLabel(nextLesson(toq, { weekday: 5, minutes: 20 * 60 })!), "Dushanba, 14:00");
  // payshanba -> ertaga (juma)
  assert.equal(nextLessonLabel(nextLesson(toq, { weekday: 4, minutes: 9 * 60 })!), "Ertaga, 14:00");
  // haftada bir kun, bugungisi tugagan -> keyingi hafta
  const once: Lesson[] = [{ day: 2, start: "10:00", end: "12:00" }];
  assert.equal(nextLessonLabel(nextLesson(once, { weekday: 2, minutes: 13 * 60 })!), "Keyingi seshanba, 10:00");
  assert.equal(nextLesson([], mon(10)), null);
  assert.equal(minutesUntil(null, mon(10)), Number.POSITIVE_INFINITY);

  assert.equal(lessonState(toq[0], 12 * 60), "later");
  assert.equal(lessonState(toq[0], 13 * 60 + 10), "soon");
  assert.equal(lessonState(toq[0], 14 * 60), "now");
  assert.equal(lessonState(toq[0], 16 * 60), "done");
  assert.equal(untilLabel(40), "40 daqiqadan keyin");
  assert.equal(untilLabel(80), "1 soat 20 daqiqadan keyin");
  assert.equal(untilLabel(120), "2 soatdan keyin");
});

test("jadval: ko'p uchraydiganlar va kun filtri", () => {
  const juft: Lesson[] = [
    { day: 2, start: "10:00", end: "12:00" },
    { day: 4, start: "10:00", end: "12:00" },
    { day: 6, start: "10:00", end: "12:00" },
  ];
  const top = popularSchedules([toq, juft, toq, [], toq, juft]);
  assert.deepEqual(top.map((t) => [scheduleLabel(t.lessons), t.count]), [
    ["Toq kunlar · 14:00–16:00", 3],
    ["Juft kunlar · 10:00–12:00", 2],
  ]);
  assert.equal(parseDayFilter("today"), "today");
  assert.equal(parseDayFilter("3"), "3");
  assert.equal(parseDayFilter("8"), "");
  assert.equal(parseDayFilter(undefined), "");
  assert.equal(matchesDayFilter(toq, "", 2), true);
  assert.equal(matchesDayFilter(toq, "today", 1), true);
  assert.equal(matchesDayFilter(toq, "today", 2), false);
  assert.equal(matchesDayFilter(juft, "6", 1), true);
  assert.equal(matchesDayFilter([], "none", 1), true);
  assert.equal(matchesDayFilter(toq, "none", 1), false);

  // Jadval turi bo'yicha filtr: toq / juft / har kuni
  assert.equal(parseDayFilter("toq"), "toq");
  assert.equal(parseDayFilter("juft"), "juft");
  assert.equal(parseDayFilter("har"), "har");
  const at = (days: number[]): Lesson[] => days.map((day) => ({ day, start: "14:00", end: "16:00" }));
  assert.equal(scheduleKind(at([1, 3, 5])), "toq");
  assert.equal(scheduleKind(at([1, 3])), "toq", "faqat toq kunlar (dushanba, chorshanba)");
  assert.equal(scheduleKind(at([2, 4, 6])), "juft");
  assert.equal(scheduleKind(at([1, 2, 3, 4, 5, 6])), "har");
  assert.equal(scheduleKind(at([1, 2, 3, 4, 5, 6, 7])), "har", "yakshanba bilan ham");
  assert.equal(scheduleKind(at([1, 2])), null, "aralash");
  assert.equal(scheduleKind([]), null);
  assert.equal(matchesDayFilter(toq, "toq", 2), true);
  assert.equal(matchesDayFilter(toq, "juft", 2), false);
  assert.equal(matchesDayFilter(juft, "juft", 1), true);
  assert.equal(matchesDayFilter(at([1, 2, 3, 4, 5, 6]), "har", 1), true);
  assert.equal(matchesDayFilter(at([1, 2, 3, 4, 5, 6]), "toq", 1), false, "har kungi o'quvchi toq kunlarga kirmaydi");
  assert.equal(matchesDayFilter([], "toq", 1), false);
});
