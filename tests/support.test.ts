import assert from "node:assert/strict";
import { test } from "node:test";
import { searchScore } from "../lib/normalize";

test("searchScore: x/h va so'zlar tartibi farqisiz topadi", () => {
  assert.equal(searchScore("Abduhalilov Ahrorbek", "Abduxalilov Axrorbek"), 1);
  assert.equal(searchScore("Abduhalilov Ahrorbek", "Axrorbek Abduxalilov"), 1);
  assert.ok(searchScore("Ahrorbek", "Abduxalilov Axrorbek") >= 0.99);
  assert.ok(searchScore("Abduhalilov Ahrorbek", "Abdukhalilov Akhrorbek") >= 0.8);
  assert.ok(searchScore("Abduhalilov Ahrorbek", "Karimov Jasur") < 0.6);
});
