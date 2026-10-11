// O'quvchilarning tartib raqami (#001, #002, ...).
import { Counter, Student } from "./models";

// Raqamsiz o'quvchilarni tekshirish har so'rovda emas — jarayon ichida 10 daqiqada bir marta.
const g = globalThis as unknown as { __seqCheckedAt?: number };
const RECHECK_MS = 10 * 60_000;

/** Raqamsiz (eski) o'quvchilarga yaratilgan tartibida raqam beradi. */
export async function ensureStudentSeqs(force = false): Promise<void> {
  if (!force && g.__seqCheckedAt && Date.now() - g.__seqCheckedAt < RECHECK_MS) return;
  const missing = await Student.find({ seq: null }, { _id: 1 }).sort({ createdAt: 1, _id: 1 }).lean();
  if (missing.length) {
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
  g.__seqCheckedAt = Date.now();
}

/** Yangi o'quvchi uchun keyingi raqam. */
export async function nextStudentSeq(): Promise<number> {
  await ensureStudentSeqs(true);
  const doc = await Counter.findOneAndUpdate(
    { _id: "student" },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  return doc?.value ?? 1;
}
