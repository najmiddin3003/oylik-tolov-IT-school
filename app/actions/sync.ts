"use server";

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment, Setting, SyncRun } from "@/lib/models";
import { parseSheetUrl } from "@/lib/sheets";
import { getSettings, runSync } from "@/lib/sync";
import { isoToDate } from "@/lib/time";
import type { FormState } from "./types";

export async function saveSheetSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const sheetUrl = String(formData.get("sheetUrl") ?? "").trim();
  const col = (k: string, def: string) => String(formData.get(k) ?? "").trim().slice(0, 60) || def;

  if (sheetUrl && !parseSheetUrl(sheetUrl)) {
    return { fieldErrors: { sheetUrl: "Havola noto'g'ri. Google Sheets manzilini to'liq nusxalang." } };
  }

  await connectDB();
  await getSettings(); // hujjat mavjudligini ta'minlaydi
  await Setting.updateOne(
    { _id: "main" },
    {
      $set: {
        sheetUrl,
        columns: {
          name: col("colName", "Ism"),
          phone: col("colPhone", "Telefon"),
          month: col("colMonth", "Oy"),
          amount: col("colAmount", "Summa"),
          date: col("colDate", "Sana"),
        },
      },
    },
  );
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

async function loadMismatch(runId: string, mismatchId: string) {
  if (!mongoose.isValidObjectId(runId) || !mongoose.isValidObjectId(mismatchId)) return null;
  await connectDB();
  const run = await SyncRun.findById(runId);
  const mismatch = run?.mismatches.id(mismatchId);
  return run && mismatch ? { run, mismatch } : null;
}

/** "Saytda yo'q" farqini Sheets'dagi summa bilan saytga to'lov qilib qo'shadi. */
export async function importMismatch(runId: string, mismatchId: string): Promise<void> {
  await requireAuth();
  const found = await loadMismatch(runId, mismatchId);
  if (!found) return;
  const { run, mismatch } = found;
  if (mismatch.resolved || mismatch.kind !== "missing_on_site" || !mismatch.studentId) return;

  await Payment.create({
    student: mismatch.studentId,
    month: mismatch.month,
    amount: mismatch.sheetAmount,
    paidAt: (mismatch.sheetDate && isoToDate(mismatch.sheetDate)) || new Date(),
    method: "naqd",
    note: `Google Sheets'dan (qator ${mismatch.sheetRows.join(", ")})`,
    source: "sheets",
  });
  mismatch.resolved = true;
  await run.save();
  refresh();
}

/** Farqni "hal qilindi" deb belgilash (masalan, Sheets'ni qo'lda to'g'rilagandan keyin). */
export async function resolveMismatch(runId: string, mismatchId: string): Promise<void> {
  await requireAuth();
  const found = await loadMismatch(runId, mismatchId);
  if (!found) return;
  found.mismatch.resolved = true;
  await found.run.save();
  refresh();
}
