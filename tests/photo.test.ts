import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePhotoField, photoUrl, PHOTO_MAX_BYTES } from "../lib/photo-rules";

test("rasm maydoni: o'zgarmaydi, o'chiriladi, yangi, xato", () => {
  assert.deepEqual(parsePhotoField(""), { kind: "keep" });
  assert.deepEqual(parsePhotoField(null), { kind: "keep" });
  assert.deepEqual(parsePhotoField("remove"), { kind: "remove" });
  const ok = parsePhotoField("data:image/jpeg;base64,/9j/4AAQSkZJRg==");
  assert.equal(ok.kind, "set");
  assert.equal(parsePhotoField("data:image/gif;base64,R0lGOD==").kind, "error");
  assert.equal(parsePhotoField("javascript:alert(1)").kind, "error");
  const big = "data:image/jpeg;base64," + "A".repeat(Math.ceil((PHOTO_MAX_BYTES * 4) / 3) + 8);
  assert.equal(parsePhotoField(big).kind, "error");
  assert.equal(photoUrl("student", "abc", null), null);
  assert.equal(photoUrl("staff", "abc", new Date(1000)), "/api/photo/staff/abc?v=1000");
});
