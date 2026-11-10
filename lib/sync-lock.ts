// Google Sheets bilan ishlash qulfi: bir vaqtda ikkita tekshiruv yoki arxivlash ishlab ketmasligi uchun.
import { Setting } from "./models";

const LOCK_MS = 5 * 60_000;

export async function acquireSyncLock(): Promise<boolean> {
  const now = new Date();
  const res = await Setting.updateOne(
    { _id: "main", $or: [{ syncLockedUntil: null }, { syncLockedUntil: { $lt: now } }] },
    { $set: { syncLockedUntil: new Date(now.getTime() + LOCK_MS) } },
  );
  return res.modifiedCount === 1;
}

export async function releaseSyncLock(): Promise<void> {
  await Setting.updateOne({ _id: "main" }, { $set: { syncLockedUntil: null } });
}
