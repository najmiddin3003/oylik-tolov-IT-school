import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTENDANCE_SMS_MAX_TRIES,
  attendanceSmsAt,
  attendanceSmsBlocker,
  attendanceSmsDue,
  attendanceSmsShouldSend,
  attendanceSmsState,
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

test("davomat SMS: xatoda qayta urinish, «yuborilmadi» yozuvi to'siq emas", () => {
  assert.equal(attendanceSmsShouldSend(undefined), true);
  assert.equal(attendanceSmsShouldSend({ sent: true, failed: 0, skipped: false }), false, "yuborilgan — ikkinchi marta yo'q");
  assert.equal(attendanceSmsShouldSend({ sent: false, failed: 1, skipped: false }), true, "xato — yana uriniladi");
  assert.equal(attendanceSmsShouldSend({ sent: false, failed: ATTENDANCE_SMS_MAX_TRIES, skipped: false }), false, "urinishlar tugadi");
  // O'qituvchi ertalab ro'yxatdan o'tmagan edi (yozuv bor), keyin o'tdi — SMS yuboriladi
  assert.equal(attendanceSmsShouldSend({ sent: false, failed: 0, skipped: true }), true);
});

test("davomat SMS: nega o'qituvchiga bormaydi", () => {
  assert.equal(attendanceSmsBlocker(null, false), "O‘qituvchi biriktirilmagan");
  assert.equal(attendanceSmsBlocker(null, true), "O‘qituvchi profili topilmadi");
  assert.equal(attendanceSmsBlocker({ status: "invited", phone: "998336263006" }, true), "O‘qituvchi ro‘yxatdan o‘tmagan");
  assert.equal(attendanceSmsBlocker({ status: "disabled", phone: "998336263006" }, true), "O‘qituvchining kirishi o‘chirilgan");
  assert.equal(attendanceSmsBlocker({ status: "active", phone: null }, true), "Telefon raqami yo‘q");
  assert.equal(attendanceSmsBlocker({ status: "active", phone: "998336263006" }, true), null);
});

test("davomat SMS: bugungi guruh holati (Sozlamalar jadvali)", () => {
  // 14:00–16:00, kechikish 10 daqiqa: SMS 14:40 da, 18:00 gacha
  const at = (minutes: number, extra: Partial<Parameters<typeof attendanceSmsState>[0]> = {}) =>
    attendanceSmsState({ missing: 3, start: "14:00", end: "16:00", delay: 10, minutes, blocker: null, ...extra });
  assert.equal(at(14 * 60 + 10), "waiting");
  assert.equal(at(14 * 60 + 40), "due");
  assert.equal(at(15 * 60, { missing: 0 }), "done", "davomat qilingan — SMS kerak emas");
  assert.equal(at(15 * 60, { logs: { sent: true, failed: 0, skipped: false } }), "sent");
  assert.equal(at(15 * 60, { missing: 0, logs: { sent: true, failed: 0, skipped: false } }), "sent", "SMS ketgach davomat qilingan");
  assert.equal(at(15 * 60, { logs: { sent: false, failed: 1, skipped: false } }), "failed");
  assert.equal(at(19 * 60, { logs: { sent: false, failed: 3, skipped: false } }), "failed", "urinishlar tugagan");
  assert.equal(at(14 * 60 + 10, { blocker: "O‘qituvchi ro‘yxatdan o‘tmagan" }), "blocked", "sabab oldindan ko'rinadi");
  assert.equal(at(18 * 60 + 1), "late", "vaqt oynasida tekshiruv ishlamagan");
});
