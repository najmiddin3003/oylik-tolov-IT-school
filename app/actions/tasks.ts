"use server";

// Rahbardan administratorga topshiriq: «To'lovlarni yig'ing — N ta o'quvchi to'lov qilmabdi».
import { logActivity } from "@/lib/activity";
import { dataChanged } from "@/lib/after-change";
import { requireOwner, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isId } from "@/lib/ids";
import { monthRows, sortDebtors } from "@/lib/ledger";
import { Task } from "@/lib/models";
import { formatMoney, isValidMonth, monthLabel } from "@/lib/time";

export type TaskResult = { ok?: boolean; error?: string; message?: string };

/** Rahbar: tanlangan oy qarzdorlari bo'yicha administratorga topshiriq yuboradi (shu oy uchun ochig'i bo'lsa — yangilanadi). */
export async function sendCollectTask(month: string): Promise<TaskResult> {
  const session = await requireOwner({ fresh: true });
  if (!isValidMonth(month)) return { error: "Oy noto‘g‘ri" };
  await connectDB();
  const debtors = sortDebtors(await monthRows(month));
  if (!debtors.length) return { error: `${monthLabel(month)} uchun hamma to‘lagan — topshiriq kerak emas` };
  const total = debtors.reduce((s, r) => s + r.debt, 0);
  const fromName = session.name ?? "Rahbar";
  // Shu oy uchun ochiq topshiriq bo'lsa — yangilanadi (takror yuborilmaydi), bo'lmasa — yangisi
  const updated = await Task.updateOne(
    { toRole: "admin", month, status: "open" },
    { $set: { count: debtors.length, total, fromStaff: session.staffId, fromName } },
  );
  if (!updated.matchedCount) {
    await Task.create({ toRole: "admin", kind: "collect", month, count: debtors.length, total, fromStaff: session.staffId, fromName });
  }
  await logActivity(session, "task.send", `Administratorga topshiriq: ${monthLabel(month)} — ${debtors.length} ta o‘quvchi, ${formatMoney(total)}`);
  await dataChanged();
  return { ok: true, message: updated.matchedCount ? "Topshiriq yangilandi" : "Topshiriq yuborildi" };
}

/** Administrator: topshiriq bajarildi. */
export async function completeTask(id: string): Promise<TaskResult> {
  const session = await requireRole(["admin"], { fresh: true });
  if (!isId(id)) return { error: "Topshiriq topilmadi" };
  await connectDB();
  const task = await Task.findOneAndUpdate(
    { _id: id, toRole: "admin", status: "open" },
    { $set: { status: "done", doneAt: new Date(), doneBy: session.staffId, doneByName: session.name ?? "Administrator" } },
    { returnDocument: "after" },
  ).lean();
  if (!task) return { error: "Topshiriq allaqachon bajarilgan" };
  await logActivity(session, "task.done", `Topshiriq bajarildi: ${monthLabel(task.month)} to‘lovlari`);
  await dataChanged();
  return { ok: true, message: "Bajarildi deb belgilandi" };
}
