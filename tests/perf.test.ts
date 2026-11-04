import assert from "node:assert/strict";
import { test } from "node:test";
import { edgeLag, formatMs, parsePerfBeacon, parseVercelId, perfRoute, perfStats, perfTone, regionLabel } from "../lib/perf-rules";

test("tezlik: manzil -> sahifa turi", () => {
  assert.equal(perfRoute("/"), "/");
  assert.equal(perfRoute("/payments"), "/payments");
  assert.equal(perfRoute("/payments/"), "/payments");
  assert.equal(perfRoute("/students/6ac9dcf90698aca8bd508d6c"), "/students/[id]");
  assert.equal(perfRoute("/students/6AC9DCF90698ACA8BD508D6C/edit"), "/students/[id]/edit");
  assert.equal(perfRoute("/students/new"), "/students/new");
  assert.equal(perfRoute("/staff/6ac9dcf90698aca8bd508d6c"), "/staff/[id]");
  assert.equal(perfRoute("/login"), null, "ro'yxatda yo'q");
  assert.equal(perfRoute("/api/perf"), null);
  assert.equal(perfRoute("/students/abc"), null);
});

test("tezlik: brauzer xabarini tekshirish", () => {
  assert.deepEqual(parsePerfBeacon({ route: "/qarzdorlar", kind: "nav", ms: 812.4 }), { route: "/qarzdorlar", kind: "nav", ms: 812, ttfb: null, wait: null, conn: null });
  assert.deepEqual(parsePerfBeacon({ route: "/students/6ac9dcf90698aca8bd508d6c", kind: "load", ms: 1500, ttfb: 320.6 }), {
    route: "/students/[id]",
    kind: "load",
    ms: 1500,
    ttfb: 321,
    wait: null,
    conn: null,
  });
  // O'tish bo'laklari: kutish, birinchi javob, yangi ulanish
  assert.deepEqual(parsePerfBeacon({ route: "/payments", kind: "nav", ms: 900, wait: 700, ttfb: 450, conn: 120 }), {
    route: "/payments",
    kind: "nav",
    ms: 900,
    ttfb: 450,
    wait: 700,
    conn: 120,
  });
  // Bo'laklar bir-biridan oshmaydi; noto'g'ri qiymat — tashlanadi
  assert.deepEqual(parsePerfBeacon({ route: "/payments", kind: "nav", ms: 900, wait: 1200, ttfb: 1000, conn: -5 }), {
    route: "/payments",
    kind: "nav",
    ms: 900,
    ttfb: 900,
    wait: 900,
    conn: null,
  });
  assert.equal(parsePerfBeacon({ route: "/payments", kind: "nav", ms: 900, wait: "700" })?.wait, null);
  assert.equal(parsePerfBeacon({ route: "/qarzdorlar", kind: "server", ms: 100 }), null, "server vaqtini brauzer yubormaydi");
  assert.equal(parsePerfBeacon({ route: "/login", kind: "nav", ms: 100 }), null);
  assert.equal(parsePerfBeacon({ route: "/", kind: "nav", ms: 0 }), null);
  assert.equal(parsePerfBeacon({ route: "/", kind: "nav", ms: 999_999 }), null);
  assert.equal(parsePerfBeacon({ route: "/", kind: "nav", ms: "100" }), null);
  assert.equal(parsePerfBeacon(null), null);
});

test("tezlik: mediana, 90-persentil, baho va ko'rinish", () => {
  assert.equal(perfStats([]), null);
  assert.deepEqual(perfStats([300]), { n: 1, median: 300, p90: 300 });
  assert.deepEqual(perfStats([400, 100, 300, 200]), { n: 4, median: 250, p90: 400 });
  assert.deepEqual(perfStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), { n: 10, median: 6, p90: 9 });
  assert.equal(perfTone(900), "emerald");
  assert.equal(perfTone(2000), "amber");
  assert.equal(perfTone(3000), "rose");
  assert.equal(formatMs(90), "90 ms");
  assert.equal(formatMs(850.4), "850 ms");
  assert.equal(formatMs(1234), "1,23 s");
  assert.equal(formatMs(12_400), "12,4 s");
});

test("tezlik: Vercel tuguni va tugundan kodgacha vaqt", () => {
  // Keshdan javob (faqat tugun) va server ishlagan so'rov (tugun :: server regioni)
  assert.deepEqual(parseVercelId("hkg1::x4vbv-1793793493358-3b4ecea58bad"), { pop: "hkg1", regions: ["hkg1"], at: 1793793493358 });
  assert.deepEqual(parseVercelId("hkg1::arn1::abcde-1793793493358-0123456789ab"), { pop: "hkg1", regions: ["hkg1", "arn1"], at: 1793793493358 });
  assert.deepEqual(parseVercelId(null), { pop: null, regions: [], at: null });
  assert.deepEqual(parseVercelId("noto'g'ri"), { pop: null, regions: [], at: null });
  assert.equal(edgeLag(1000, 1150), 150);
  assert.equal(edgeLag(1000, 990), 0, "soatlar biroz farq qilsa");
  assert.equal(edgeLag(1000, 500), null, "katta farq");
  assert.equal(edgeLag(1000, 1000 + 120_000), null);
  assert.equal(edgeLag(null, 1000), null);
  assert.equal(regionLabel("hkg1"), "hkg1 · Gonkong");
  assert.equal(regionLabel("xyz9"), "xyz9");
});
