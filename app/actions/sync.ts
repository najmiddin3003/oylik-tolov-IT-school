"use server";

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { importFromRun } from "@/lib/importer";
import { Setting, SyncRun } from "@/lib/models";
import { parseSheetUrl } from "@/lib/sheets";
import { getSettings, runSync } from "@/lib/sync";
import type { FormState } from "./types";

const COLUMN_FIELDS = ["name", "phone", "month", "amount", "date", "cash", "card", "fee", "course"] as const;

export async function saveSheetSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const sheetUrl = String(formData.get("sheetUrl") ?? "").trim();
  const courseFilter = String(formData.get("courseFilter") ?? "").trim().slice(0, 200);

  if (sheetUrl && !parseSheetUrl(sheetUrl)) {
    return { fieldErrors: { sheetUrl: "Havola noto'g'ri. Google Sheets manzilini to'liq nusxalang." } };
  }

  await connectDB();
  const current = await getSettings(); // hujjat mavjudligini ta'minlaydi
  const columns = { ...current.columns };
  for (const f of COLUMN_FIELDS) {
    const v = String(formData.get(`col_${f}`) ?? "").trim().slice(0, 60);
    if (v) columns[f] = v;
  }
  await Setting.updateOne({ _id: "main" }, { $set: { sheetUrl, columns, courseFilter } });
  refresh();
  return { ok: true, message: "Sozlamalar saqlandi" };
}

export async function runSyncNow(): Promise<FormState> {
  await requireAuth();
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
  await requireAuth();
  await importFromRun(runId, [mismatchId]);
  refresh();
}

/** Barcha qo'shsa bo'ladigan farqlarni saytga qo'shadi va qayta tekshiradi. */
export async function importAllMismatches(runId: string): Promise<void> {
  await requireAuth();
  const res = await importFromRun(runId, "all");
  if (res && res.resolved > 0) await runSync("manual");
  refresh();
}

/** Farqni "hal qilindi" deb belgilash (masalan, Sheets'ni qo'lda to'g'rilagandan keyin). */
export async function resolveMismatch(runId: string, mismatchId: string): Promise<void> {
  await requireAuth();
  if (!mongoose.isValidObjectId(runId) || !mongoose.isValidObjectId(mismatchId)) return;
  await connectDB();
  const run = await SyncRun.findById(runId);
  const mismatch = run?.mismatches.id(mismatchId);
  if (!run || !mismatch) return;
  mismatch.resolved = true;
  await run.save();
  refresh();
}
