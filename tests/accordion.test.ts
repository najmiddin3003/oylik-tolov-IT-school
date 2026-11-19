import assert from "node:assert/strict";
import { test } from "node:test";
import { previewCounts, previewNames } from "../lib/accordion";

test("accordion: yopiq holatdagi qisqa ko'rinish", () => {
  assert.equal(previewNames([]), "");
  assert.equal(previewNames(["Ali", "Vali"]), "Ali, Vali");
  assert.equal(previewNames(["Ali", "Vali", "G'ani", "Soli", "Ali"]), "Ali, Vali, G'ani va yana 1 ta", "takrorlar bir marta");
  assert.equal(previewNames([" Ali ", "", "Vali"], 1), "Ali va yana 1 ta");
  assert.equal(
    previewCounts(["a", "b", "a", "c", "a", "b"], (k) => k.toUpperCase()),
    "3 ta A · 2 ta B · 1 ta C",
    "ko'pi oldinda",
  );
  assert.equal(previewCounts([], (k: string) => k), "");
});
