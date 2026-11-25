import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateWithDebts } from "../lib/allocate";

const paidOf = (o: Record<string, number> = {}) => new Map(Object.entries(o));

test("ortiqcha to'lov: avval oldingi to'lanmagan oy, keyin tanlangan oy", () => {
  // Oylik 300 000, sentabr to'langan, oktabr to'lanmagan, noyabr uchun 500 000
  assert.deepEqual(allocateWithDebts(500_000, 300_000, "2026-11", paidOf({ "2026-09": 300_000 }), "2026-09"), [
    { month: "2026-10", amount: 300_000 },
    { month: "2026-11", amount: 200_000 },
  ]);
  // Oylik 250 000 — 250 + 250
  assert.deepEqual(allocateWithDebts(500_000, 250_000, "2026-11", paidOf({ "2026-09": 250_000 }), "2026-09"), [
    { month: "2026-10", amount: 250_000 },
    { month: "2026-11", amount: 250_000 },
  ]);
});

test("ortiqcha to'lov: ortiq bo'lmasa yoki oldingi qarz yo'q — avvalgidek", () => {
  // Faqat noyabr summasi — oktabr qarzi bo'lsa ham noyabrga
  assert.deepEqual(allocateWithDebts(300_000, 300_000, "2026-11", paidOf(), "2026-10"), [{ month: "2026-11", amount: 300_000 }]);
  // Oktabr to'langan — noyabr va dekabrga
  assert.deepEqual(allocateWithDebts(500_000, 300_000, "2026-11", paidOf({ "2026-10": 300_000 }), "2026-10"), [
    { month: "2026-11", amount: 300_000 },
    { month: "2026-12", amount: 200_000 },
  ]);
  // Oktabr qisman (100 000) — avval oktabrning qolgan 200 000, keyin noyabr
  assert.deepEqual(allocateWithDebts(500_000, 300_000, "2026-11", paidOf({ "2026-10": 100_000 }), "2026-10"), [
    { month: "2026-10", amount: 200_000 },
    { month: "2026-11", amount: 300_000 },
  ]);
  // Boshlanishdan oldingi oylarga yozilmaydi (earliest = boshlagan oy)
  assert.deepEqual(allocateWithDebts(500_000, 300_000, "2026-11", paidOf(), "2026-11"), [
    { month: "2026-11", amount: 300_000 },
    { month: "2026-12", amount: 200_000 },
  ]);
});

test("mavjud ortiqcha to'lovlar: oldingi to'lanmagan oyga ko'chirish", async () => {
  const { overpaymentMoves } = await import("../lib/allocate");
  const months = ["2026-09", "2026-10", "2026-11", "2026-12"];
  // Noyabrga 500 000 yozilgan (oylik 300 000), oktabr to'lanmagan: oktabr 300 000, noyabr 200 000
  assert.deepEqual(overpaymentMoves(months, () => 300_000, paidOf({ "2026-09": 300_000, "2026-11": 500_000 })), [{ from: "2026-11", to: "2026-10", amount: 300_000 }]);
  // Noyabr ortiqcha emas (300 000) — oktabr qarzi bo'lsa ham tegilmaydi
  assert.deepEqual(overpaymentMoves(months, () => 300_000, paidOf({ "2026-09": 300_000, "2026-11": 300_000 })), []);
  // Oylik 250 000: noyabr 500 000 -> oktabrga 250 000
  assert.deepEqual(overpaymentMoves(months, () => 250_000, paidOf({ "2026-09": 250_000, "2026-11": 500_000 })), [{ from: "2026-11", to: "2026-10", amount: 250_000 }]);
  // Oldingi qarz yo'q — o'zgarmaydi (oldindan to'lov)
  assert.deepEqual(overpaymentMoves(months, () => 300_000, paidOf({ "2026-09": 300_000, "2026-10": 300_000, "2026-11": 600_000 })), []);
  // Tugatgandan keyingi oy (narx 0) to'lovi — oldingi qarzga
  const fee = (m: string) => (m > "2026-10" ? 0 : 300_000);
  assert.deepEqual(overpaymentMoves(months, fee, paidOf({ "2026-09": 300_000, "2026-12": 300_000 })), [{ from: "2026-12", to: "2026-10", amount: 300_000 }]);
});

test("qo'lda taqsimlash: joriy va kerakli farqidan ko'chirishlar", async () => {
  const { movesBetween } = await import("../lib/allocate");
  const cur = new Map([["2026-10", 0], ["2026-11", 500000]]);
  assert.deepEqual(movesBetween(cur, new Map([["2026-10", 300000], ["2026-11", 200000]])), [{ from: "2026-11", to: "2026-10", amount: 300000 }]);
  assert.deepEqual(movesBetween(cur, new Map([["2026-10", 0], ["2026-11", 500000]])), [], "o'zgarmasa — hech narsa");
  const three = movesBetween(new Map([["2026-09", 0], ["2026-10", 0], ["2026-11", 600000]]), new Map([["2026-09", 250000], ["2026-10", 250000], ["2026-11", 100000]]));
  assert.deepEqual(three, [
    { from: "2026-11", to: "2026-09", amount: 250000 },
    { from: "2026-11", to: "2026-10", amount: 250000 },
  ]);
});
