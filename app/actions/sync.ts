"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isId } from "@/lib/ids";
import { importFromRun } from "@/lib/importer";
import { SyncRun } from "@/lib/models";
import { getSettings, updateSettings } from "@/lib/settings";
import { parseSheetUrl } from "@/lib/sheets";
import { runSync } from "@/lib/sync";
import type { FormState } from "./types";

const COLUMN_FIELDS = ["name", "phone", "month", "amount", "date", "cash", "card", "fee", "course"] as const;

export async function saveSheetSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner({ fresh: true });
  const sheetUrl = String(formData.get("sheetUrl") ?? "").trim();
  const courseFilter = String(formData.get("courseFilter") ?? "").trim().slice(0, 200);

  if (sheetUrl && !parseSheetUrl(sheetUrl)) {
    return { fieldErrors: { sheetUrl: "Havola noto'g'ri. Google Sheets manzilini to'liq nusxalang." } };
  }

  const current = await getSettings({ fresh: true });
  const columns = { ...current.columns };
  for (const f of COLUMN_FIELDS) {
    const v = String(formData.get(`col_${f}`) ?? "").trim().slice(0, 60);
    if (v) columns[f] = v;
  }
  await updateSettings({ $set: { sheetUrl, columns, courseFilter } });
  refresh();
  return { ok: true, message: "Sozlamalar saqlandi" };
}

export async function runSyncNow(): Promise<FormState> {
  await requireOwner({ fresh: true });
  await connectDB();
  const res = await runSync("manual");
  refresh();
  if (!res) return { error: "Hozir boshqa tekshiruv ketmoqda, birozdan keyin urinib ko'ring" };
  if (!res.ok) return { error: res.error };
  return {
    ok: true,
    message: res.mismatches ? `Tekshirildi: ${res.mismatches} ta farq topildi` : "Tekshirildi: hammasi bir xil ✓",
  };
}

/** Bitta «Saytda yo'q» / «Noma'lum o'quvchi» farqini saytga qo'shadi. */
export async function importMismatch(runId: string, mismatchId: string): Promise<void> {
  await requireOwner({ fresh: true });
  if (!isId(runId) || !isId(mismatchId)) return;
  await importFromRun(runId, [mismatchId]);
  refresh();
}

/** Barcha qo'shsa bo'ladigan farqlarni saytga qo'shadi va qayta tekshiradi. */
export async function importAllMismatches(runId: string): Promise<void> {
  await requireOwner({ fresh: true });
  if (!isId(runId)) return;
  const res = await importFromRun(runId, "all");
  if (res && res.resolved > 0) await runSync("manual");
  refresh();
}

/** Farqni "hal qilindi" deb belgilash (masalan, Sheets'ni qo'lda to'g'rilagandan keyin). */
export async function resolveMismatch(runId: string, mismatchId: string): Promise<void> {
  await requireOwner({ fresh: true });
  if (!isId(runId) || !isId(mismatchId)) return;
  await connectDB();
  const run = await SyncRun.findById(runId);
  const mismatch = run?.mismatches.id(mismatchId);
  if (!run || !mismatch) return;
  mismatch.resolved = true;
  await run.save();
  refresh();
}
