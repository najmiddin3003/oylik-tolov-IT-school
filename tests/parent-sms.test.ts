import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PARENT_SMS_TEMPLATE,
  normalizeParentSms,
  parentSmsAgain,
  parentSmsDue,
  parentTemplateErrors,
  renderParentSms,
} from "../lib/parent-sms-rules";
import { MONTH_NAMES } from "../lib/time";

const monthName = (m: string) => MONTH_NAMES[Number(m.slice(5, 7)) - 1];

test("ota-ona SMS: shablon va sozlamalar", () => {
  const text = renderParentSms(DEFAULT_PARENT_SMS_TEMPLATE, { name: "Aliyev Vali", months: ["2026-11", "2026-10"], debt: 450000, center: "IT school" }, monthName);
  assert.equal(text, "Hurmatli ota-ona! Farzandingiz Aliyev Vali Oktabr-Noyabr oyi uchun 450 000 so'm to'lov qilmagan. Iltimos, to'lovni amalga oshiring. IT school");
  assert.ok(text.length <= 160);
  assert.equal(parentTemplateErrors(DEFAULT_PARENT_SMS_TEMPLATE), null);
  assert.match(parentTemplateErrors("Salom {#ism#}") ?? "", /summa/);
  assert.match(parentTemplateErrors("To'lov {#summa#}") ?? "", /ism/);
  assert.deepEqual(normalizeParentSms(null), { enabled: false, startDay: 10, repeatDays: 0, template: DEFAULT_PARENT_SMS_TEMPLATE, includePartial: true });
  assert.equal(normalizeParentSms({ startDay: 40, repeatDays: 4 }).startDay, 10);
  assert.equal(normalizeParentSms({ startDay: 40, repeatDays: 4 }).repeatDays, 0);
});

test("ota-ona SMS: qachon yuboriladi", () => {
  assert.equal(parentSmsDue("2026-11-09", 10), false);
  assert.equal(parentSmsDue("2026-11-10", 10), true);
  assert.equal(parentSmsDue("2026-02-28", 28), true);
  // Oyiga bir marta
  assert.equal(parentSmsAgain("2026-11-12", 0, null), true);
  assert.equal(parentSmsAgain("2026-11-12", 0, "2026-11-10"), false);
  assert.equal(parentSmsAgain("2026-12-10", 0, "2026-11-10"), true);
  // Har 3 kunda
  assert.equal(parentSmsAgain("2026-11-12", 3, "2026-11-10"), false);
  assert.equal(parentSmsAgain("2026-11-13", 3, "2026-11-10"), true);
});
