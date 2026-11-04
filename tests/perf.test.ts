import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMs, parsePerfBeacon, perfRoute, perfStats, perfTone } from "../lib/perf-rules";

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
  assert.deepEqual(parsePerfBeacon({ route: "/qarzdorlar", kind: "nav", ms: 812.4 }), { route: "/qarzdorlar", kind: "nav", ms: 812, ttfb: null });
  assert.deepEqual(parsePerfBeacon({ route: "/students/6ac9dcf90698aca8bd508d6c", kind: "load", ms: 1500, ttfb: 320.6 }), {
    route: "/students/[id]",
    kind: "load",
    ms: 1500,
    ttfb: 321,
  });
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
