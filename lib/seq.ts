// O'quvchilarning tartib raqami (#001, #002, ...).
import { Counter, Student } from "./models";

/** Raqamsiz (eski) o'quvchilarga yaratilgan tartibida raqam beradi. */
export async function ensureStudentSeqs(): Promise<void> {
  const missing = await Student.find({ seq: null }, { _id: 1 }).sort({ createdAt: 1, _id: 1 }).lean();
  if (!missing.length) return;
  const [maxDoc, counter] = await Promise.all([
    Student.findOne({ seq: { $ne: null } }, { seq: 1 }).sort({ seq: -1 }).lean(),
    Counter.findById("student").lean(),
  ]);
  let next = Math.max(maxDoc?.seq ?? 0, counter?.value ?? 0);
  await Student.bulkWrite(
    missing.map((s) => ({ updateOne: { filter: { _id: s._id, seq: null }, update: { $set: { seq: ++next } } } })),
  );
  await Counter.updateOne({ _id: "student" }, { $max: { value: next } }, { upsert: true });
}

/** Yangi o'quvchi uchun keyingi raqam. */
export async function nextStudentSeq(): Promise<number> {
  await ensureStudentSeqs();
  const doc = await Counter.findOneAndUpdate(
    { _id: "student" },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  return doc?.value ?? 1;
}
