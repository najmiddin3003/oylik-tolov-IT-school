import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDiscount, discountAt, discountLabel, discountValueError, netFee, setDiscountFrom, type DiscountChange } from "../lib/discounts";

const aka = { typeId: "t1", name: "Aka-uka", kind: "percent" as const, value: 10 };
const aksiya = { typeId: "t2", name: "Aksiya", kind: "amount" as const, value: 50000 };

test("chegirma: narxdan ayirish", () => {
  assert.equal(applyDiscount(300000, { kind: "percent", value: 10 }), 270000);
  assert.equal(applyDiscount(250000, { kind: "percent", value: 15 }), 212500);
  assert.equal(applyDiscount(300000, { kind: "amount", value: 50000 }), 250000);
  assert.equal(applyDiscount(30000, { kind: "amount", value: 50000 }), 0);
  assert.equal(applyDiscount(300000, { kind: "percent", value: 100 }), 0);
  assert.equal(applyDiscount(300000, null), 300000);
  assert.equal(discountLabel({ kind: "percent", value: 10 }), "10%");
  assert.equal(discountLabel({ kind: "amount", value: 50000 }), "50 000 so‘m");
  assert.equal(discountValueError("percent", 120), "Foiz 1 dan 100 gacha bo‘lishi kerak");
  assert.equal(discountValueError("amount", 0), "Qiymatni kiriting");
  assert.equal(discountValueError("percent", 12.5), null);
});

test("chegirma: tanlangan oydan, o'tgan oylar o'zgarmaydi", () => {
  // Noyabrdan 10% — oktabr o'zgarmaydi
  let h: DiscountChange[] = setDiscountFrom([], "2026-11", aka);
  const s = { monthlyFee: 300000, discountHistory: h };
  assert.equal(netFee(s, "2026-10"), 300000);
  assert.equal(netFee(s, "2026-11"), 270000);
  assert.equal(netFee(s, "2027-03"), 270000);
  // Yanvardan o'chirildi
  h = setDiscountFrom(h, "2027-01", null);
  assert.equal(netFee({ ...s, discountHistory: h }, "2026-12"), 270000);
  assert.equal(netFee({ ...s, discountHistory: h }, "2027-01"), 300000);
  assert.equal(discountAt(h, "2027-02"), null);
  // Dekabrdan boshqa chegirma — undan keyingi eski o'zgarishlar bekor
  h = setDiscountFrom(h, "2026-12", aksiya);
  assert.deepEqual(h.map((x) => [x.from, x.kind, x.value]), [["2026-11", "percent", 10], ["2026-12", "amount", 50000]]);
  assert.equal(netFee({ ...s, discountHistory: h }, "2027-05"), 250000);
  // Bir xil chegirma qayta yoqilsa / chegirmasiz o'quvchida o'chirilsa — yozilmaydi
  assert.equal(setDiscountFrom(setDiscountFrom([], "2026-11", aka), "2026-12", aka).length, 1);
  assert.deepEqual(setDiscountFrom([], "2026-11", null), []);
  // Narx tarixi bilan birga: dekabrdan narx 350 000
  assert.equal(netFee({ monthlyFee: 300000, feeHistory: [{ from: "2026-12", fee: 350000 }], discountHistory: setDiscountFrom([], "2026-11", aka) }, "2026-12"), 315000);
});
