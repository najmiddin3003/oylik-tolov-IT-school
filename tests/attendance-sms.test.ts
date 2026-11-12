import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attendanceSmsAt,
  attendanceSmsDue,
  attendanceTemplateError,
  DEFAULT_ATTENDANCE_SMS_TEMPLATE,
  normalizeAttendanceSms,
  renderAttendanceSms,
} from "../lib/attendance-sms-rules";

test("davomat SMS: dars boshlanib 30 + 10 daqiqadan keyin", () => {
  assert.equal(attendanceSmsAt("14:00", 10), "14:40");
  assert.equal(attendanceSmsDue("14:00", "16:00", 10, 14 * 60 + 39), false);
  assert.equal(attendanceSmsDue("14:00", "16:00", 10, 14 * 60 + 40), true);
  assert.equal(attendanceSmsDue("14:00", "16:00", 10, 18 * 60), true);
  // Dars tugab 2 soatdan oshsa — kech
  assert.equal(attendanceSmsDue("14:00", "16:00", 10, 18 * 60 + 1), false);
  assert.equal(attendanceSmsDue("09:00", "11:00", 0, 9 * 60 + 30), true);
  assert.deepEqual(normalizeAttendanceSms(null), { enabled: false, delayMinutes: 10, template: DEFAULT_ATTENDANCE_SMS_TEMPLATE });
  assert.equal(normalizeAttendanceSms({ delayMinutes: 500 }).delayMinutes, 10);
  assert.equal(normalizeAttendanceSms({ delayMinutes: 25 }).delayMinutes, 25);
});

test("davomat SMS: shablon", () => {
  assert.equal(
    renderAttendanceSms(DEFAULT_ATTENDANCE_SMS_TEMPLATE, { group: "Web dasturlash", start: "14:00", missing: 5, teacher: "Najmiddin" }),
    "To'lov nazorati: 14:00 dagi Web dasturlash guruhi davomati qilinmagan. Iltimos, davomatni belgilang",
  );
  assert.equal(attendanceTemplateError(DEFAULT_ATTENDANCE_SMS_TEMPLATE), null);
  assert.match(attendanceTemplateError("Davomat qiling") ?? "", /guruh/);
});
