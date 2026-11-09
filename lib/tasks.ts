import "server-only";
// Rahbardan administratorga topshiriqlar: «To'lovlarni yig'ing — Sentabr uchun 5 ta o'quvchi to'lov qilmabdi».
import { connectDB } from "./db";
import { Task } from "./models";
import type { Role } from "./session";

export type TaskRow = {
  id: string;
  month: string;
  count: number;
  total: number;
  fromName: string;
  status: "open" | "done";
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
  doneByName: string;
};

function toTaskRow(t: {
  _id: unknown;
  month: string;
  count?: number | null;
  total?: number | null;
  fromName?: string | null;
  status?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  doneAt?: Date | null;
  doneByName?: string | null;
}): TaskRow {
  return {
    id: String(t._id),
    month: t.month,
    count: t.count ?? 0,
    total: t.total ?? 0,
    fromName: t.fromName || "Rahbar",
    status: t.status === "done" ? "done" : "open",
    createdAt: (t.createdAt ?? new Date()).toISOString(),
    updatedAt: (t.updatedAt ?? t.createdAt ?? new Date()).toISOString(),
    doneAt: t.doneAt ? t.doneAt.toISOString() : null,
    doneByName: t.doneByName ?? "",
  };
}

/** Rolga kelgan topshiriqlar: ochiqlari va yaqinda bajarilganlari (7 kun). */
export async function tasksFor(role: Role): Promise<TaskRow[]> {
  await connectDB();
  const since = new Date(Date.now() - 7 * 24 * 3600_000);
  const docs = await Task.find({ toRole: role, $or: [{ status: "open" }, { doneAt: { $gte: since } }] })
    .sort({ status: -1, updatedAt: -1 })
    .limit(20)
    .lean();
  return docs.map(toTaskRow);
}

/** Rahbar uchun: oylar bo'yicha oxirgi yuborilgan topshiriq (qo'ng'iroqchadagi eslatmada holatini ko'rsatish uchun). */
export async function latestTasksByMonth(months: string[]): Promise<Record<string, TaskRow>> {
  if (!months.length) return {};
  await connectDB();
  const docs = await Task.find({ month: { $in: months } }).sort({ updatedAt: -1 }).lean();
  const out: Record<string, TaskRow> = {};
  for (const d of docs) if (!out[d.month]) out[d.month] = toTaskRow(d);
  return out;
}
