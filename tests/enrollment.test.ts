import assert from "node:assert/strict";
import { test } from "node:test";
import { netFee } from "../lib/discounts";
import { billedUntil, endDateError, isArchived, isCurrentStudent, lastBilledMonth, owesFor, studentStatus, studiesOn } from "../lib/enrollment";

test("o'qishni tugatish: oxirgi to'lanadigan oy", () => {
  assert.equal(lastBilledMonth("2026-11-20"), "2026-11", "oy o'rtasida tugatsa — shu oy to'lanadi");
  assert.equal(lastBilledMonth("2026-11-30"), "2026-11");
  assert.equal(lastBilledMonth("2026-12-01"), "2026-11", "1-sanada tugatsa — o'sha oy to'lanmaydi");
  assert.equal(lastBilledMonth("2027-01-01"), "2026-12", "yil almashishi");
  assert.equal(billedUntil("2026-11", "2026-11-20"), true);
  assert.equal(billedUntil("2026-12", "2026-11-20"), false);
  assert.equal(billedUntil("2030-01", null), true, "tugatish sanasi yo'q — cheklanmaydi");
});

test("o'qishni tugatish: holat va davomat", () => {
  assert.equal(isArchived("2026-11-20", "2026-11-19"), false, "kelgusi sana — hali o'qiydi");
  assert.equal(isArchived("2026-11-20", "2026-11-20"), true, "shu kundan arxivda");
  assert.equal(studentStatus(true, null, "2026-11-20"), "active");
  assert.equal(studentStatus(false, null, "2026-11-20"), "inactive");
  assert.equal(studentStatus(false, "2026-11-01", "2026-11-20"), "archived", "tugatgan — nofaol belgisidan ustun");
  assert.equal(studentStatus(true, "2026-12-01", "2026-11-20"), "active", "tugatish kelgusida");
  assert.equal(isCurrentStudent({ active: true }, "2026-11-10", "2026-11-20"), false);
  assert.equal(isCurrentStudent({}, null, "2026-11-20"), true);
  assert.equal(studiesOn("2026-11-19", "2026-09-01", "2026-11-20"), true);
  assert.equal(studiesOn("2026-11-20", "2026-09-01", "2026-11-20"), false, "tugatgan kundan davomat yo'q");
  assert.equal(studiesOn("2026-08-31", "2026-09-01", null), false, "boshlamagan");
});

test("o'qishni tugatish: qaysi oylar uchun to'laydi", () => {
  const s = { startMonth: "2026-09", active: true, endIso: "2026-11-20" };
  assert.deepEqual(
    ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map((m) => owesFor(m, s)),
    [false, true, true, true, false],
  );
  // Nofaol + tugatish sanasi: qarz bo'lgan oylar qoladi
  assert.equal(owesFor("2026-10", { startMonth: "2026-09", active: false, endIso: "2026-11-20" }), true);
  // Nofaol, tugatish sanasi yo'q — avvalgidek hisoblanmaydi
  assert.equal(owesFor("2026-10", { startMonth: "2026-09", active: false, endIso: null }), false);
  // Narx: tugatgandan keyingi oylar — 0 (oldindan to'lov o'sha oylarga taqsimlanmaydi)
  const fee = { monthlyFee: 300000, endDate: "2026-11-20" };
  assert.equal(netFee(fee, "2026-11"), 300000);
  assert.equal(netFee(fee, "2026-12"), 0);
  assert.equal(netFee({ monthlyFee: 300000 }, "2027-05"), 300000);
});

test("o'qishni tugatish: sana tekshiruvi", () => {
  assert.equal(endDateError("2026-11-20", "2026-09-01", "2026-11-20"), null);
  assert.ok(endDateError("2026-09-01", "2026-09-01", "2026-11-20"), "boshlagan kunning o'zi — yo'q");
  assert.ok(endDateError("2026-08-01", "2026-09-01", "2026-11-20"));
  assert.equal(endDateError("2027-06-01", "2026-09-01", "2026-11-20"), null, "kelgusi sana mumkin");
  assert.ok(endDateError("2028-01-01", "2026-09-01", "2026-11-20"), "juda uzoq");
  assert.ok(endDateError("20.11.2026", "2026-09-01", "2026-11-20"));
});
