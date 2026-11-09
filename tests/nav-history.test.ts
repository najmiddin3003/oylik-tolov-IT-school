import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arriveAt,
  canGoBack,
  canGoForward,
  emptyHistory,
  NAV_HISTORY_MAX,
  parseNavHistory,
  pathOf,
  recordPop,
  recordVisit,
  type NavHistory,
} from "../lib/nav-history";

const visit = (...urls: string[]) => urls.reduce<NavHistory>((h, u) => recordVisit(h, u), emptyHistory());

test("tarix: yangi sahifalar ketma-ket qo'shiladi, orqaga/oldinga holati", () => {
  const h = visit("/", "/staff", "/staff/a1");
  assert.deepEqual(h, { entries: ["/", "/staff", "/staff/a1"], index: 2 });
  assert.equal(canGoBack(h), true);
  assert.equal(canGoForward(h), false);
  assert.equal(canGoBack(emptyHistory()), false);
  assert.equal(canGoForward(emptyHistory()), false);
  // Sahifani yangilash (o'sha manzil) — o'zgarmaydi
  assert.equal(recordVisit(h, "/staff/a1"), h);
});

test("tarix: shu sahifa ichida oy yoki filtr o'zgarsa — yangi qadam emas, oxirgi holati eslab qolinadi", () => {
  let h = visit("/", "/payments");
  h = recordVisit(h, "/payments?month=2026-10");
  h = recordVisit(h, "/payments?month=2026-10&method=naqd");
  assert.deepEqual(h, { entries: ["/", "/payments?month=2026-10&method=naqd"], index: 1 });
  assert.equal(pathOf("/payments?month=2026-10"), "/payments");
  // Boshqa xodim — boshqa sahifa (yo'li boshqa)
  assert.equal(visit("/staff/a1", "/staff/b2").entries.length, 2);
});

test("tarix: tugma bilan orqaga/oldinga va yangi o'tishda «oldinga» qismi o'chadi", () => {
  let h = visit("/", "/staff", "/staff/a1");
  h = arriveAt(h, 1, "/staff");
  assert.equal(h.index, 1);
  assert.equal(canGoForward(h), true);
  h = arriveAt(h, 2, "/staff/a1");
  assert.equal(h.index, 2);
  h = arriveAt(h, 0, "/");
  // Orqadan yangi sahifaga — keyingilari o'chadi (brauzerdagidek)
  h = recordVisit(h, "/students");
  assert.deepEqual(h, { entries: ["/", "/students"], index: 1 });
  // Kutilgan sahifa boshqa joyga yo'naltirsa — o'sha qadamdan oddiy o'tish
  const r = arriveAt(visit("/", "/staff", "/payments"), 1, "/");
  assert.deepEqual(r, { entries: ["/", "/staff", "/"], index: 2 });
});

test("tarix: brauzerning o'z orqaga/oldinga tugmasi bilan mos", () => {
  const h = visit("/", "/staff", "/staff/a1");
  const back = recordPop(h, "/staff");
  assert.equal(back.index, 1);
  assert.equal(recordPop(back, "/staff/a1").index, 2);
  // Havola bilan oldingi sahifaga — yangi qadam (brauzerdagidek: A → B → A)
  assert.deepEqual(recordVisit(visit("/a", "/b"), "/a"), { entries: ["/a", "/b", "/a"], index: 2 });
});

test("tarix: eng ko'p 50 qadam, buzilgan qiymat — bo'sh tarix", () => {
  const h = visit(...Array.from({ length: NAV_HISTORY_MAX + 10 }, (_, i) => `/p${i}`));
  assert.equal(h.entries.length, NAV_HISTORY_MAX);
  assert.equal(h.entries[0], "/p10");
  assert.equal(h.index, NAV_HISTORY_MAX - 1);
  assert.deepEqual(parseNavHistory(JSON.stringify(h)), h);
  assert.deepEqual(parseNavHistory("{buzilgan"), emptyHistory());
  assert.deepEqual(parseNavHistory(null), emptyHistory());
  // Tashqi manzil va noto'g'ri qiymatlar tashlanadi, index chegarada
  assert.deepEqual(parseNavHistory(JSON.stringify({ entries: ["/a", "https://x.uz", "//x", 5, "/b"], index: 9 })), { entries: ["/a", "/b"], index: 1 });
});
