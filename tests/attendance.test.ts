import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attendanceGroups,
  attendanceOpen,
  attendanceOpensAt,
  attendanceSummary,
  needsNote,
  validateAttendance,
  type AttendanceStudent,
} from "../lib/attendance-rules";

const st = (id: string, name: string, group: string, teacherId: string | null, lessons: AttendanceStudent["lessons"]): AttendanceStudent => ({
  id,
  name,
  seq: null,
  group,
  teacherId,
  lessons,
});

test("davomat: dars boshlanganidan 30 daqiqa o'tib ochiladi", () => {
  assert.equal(attendanceOpensAt("14:00"), "14:30");
  assert.equal(attendanceOpensAt("09:45"), "10:15");
  assert.equal(attendanceOpensAt("23:50"), "23:59");
  const today = "2026-11-10";
  // Bugun: 14:29 da hali yopiq, 14:30 dan ochiq
  assert.equal(attendanceOpen(today, "14:00", { iso: today, minutes: 14 * 60 + 29 }), false);
  assert.equal(attendanceOpen(today, "14:00", { iso: today, minutes: 14 * 60 + 30 }), true);
  // O'tgan kun — har doim ochiq (qilinmay qolgan davomat), kelgusi kun — yo'q
  assert.equal(attendanceOpen("2026-11-09", "18:00", { iso: today, minutes: 8 * 60 }), true);
  assert.equal(attendanceOpen("2026-11-11", "08:00", { iso: today, minutes: 23 * 60 }), false);
});

test("davomat: guruhlar — bir xil vaqt, kurs va o'qituvchi", () => {
  const toq = [
    { day: 1, start: "14:00", end: "16:00" },
    { day: 3, start: "14:00", end: "16:00" },
  ];
  const students = [
    st("a", "Valiyev Ali", "Web dasturlash", "t1", toq),
    st("b", "Aliyev Vali", "web  Dasturlash", "t1", toq), // yozilishi farqli — o'sha kurs
    st("c", "Karimov Said", "Web dasturlash", "t2", toq), // boshqa o'qituvchi — alohida guruh
    st("d", "Usmonov Bek", "Grafik dizayn", "t1", [{ day: 1, start: "09:00", end: "11:00" }]),
    st("e", "Jadvalsiz", "Web dasturlash", "t1", []),
    st("f", "Seshanba", "Web dasturlash", "t1", [{ day: 2, start: "14:00", end: "16:00" }]),
  ];
  const g = attendanceGroups(students, 1);
  assert.deepEqual(
    g.map((x) => [x.start, x.course, x.teacherId, x.students.map((s) => s.id)]),
    [
      ["09:00", "Grafik dizayn", "t1", ["d"]],
      ["14:00", "Web dasturlash", "t1", ["b", "a"]],
      ["14:00", "Web dasturlash", "t2", ["c"]],
    ],
  );
  assert.equal(attendanceGroups(students, 2).length, 1);
  assert.equal(attendanceGroups(students, 7).length, 0);
});

test("davomat: holat tanlanishi shart, «Kelmadi» va «Sababli» da izoh majburiy", () => {
  assert.equal(needsNote("present"), false);
  assert.equal(needsNote("absent"), true);
  assert.equal(needsNote("excused"), true);
  const errors = validateAttendance(["a", "b", "c", "d", "e"], {
    a: { status: "present", note: "" },
    b: { status: "absent", note: "   " },
    c: { status: "excused", note: "Kasal" },
    d: { status: "", note: "" },
    e: { status: "keldi", note: "" },
  });
  assert.deepEqual(Object.keys(errors).sort(), ["note_b", "status_d", "status_e"]);
  assert.match(errors.note_b, /Kelmadi/);
  assert.deepEqual(validateAttendance(["a"], { a: { status: "absent", note: "Telefon qilindi, kasal" } }), {});

  const marks: Record<string, "present" | "absent" | "excused"> = { a: "present", b: "absent", c: "present" };
  assert.deepEqual(attendanceSummary(["a", "b", "c", "d"], (id) => marks[id]), { present: 2, absent: 1, excused: 0, total: 4, missing: 1 });
});
