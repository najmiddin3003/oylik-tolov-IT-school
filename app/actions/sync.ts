"use server";

import { logActivity } from "@/lib/activity";
import { dataChanged } from "@/lib/after-change";
import { requireOwner } from "@/lib/auth";
import { mismatchKey } from "@/lib/compare";
import { connectDB } from "@/lib/db";
import { isId } from "@/lib/ids";
import { importFromRun } from "@/lib/importer";
import { SyncIgnore, SyncRun, type MismatchKind } from "@/lib/models";
import { getSettings, updateSettings } from "@/lib/settings";
import { parseSheetUrl } from "@/lib/sheets";
import { runSync } from "@/lib/sync";
import { monthLabel } from "@/lib/time";
import type { FormState } from "./types";

const COLUMN_FIELDS = ["name", "phone", "month", "amount", "date", "cash", "card", "fee", "course"] as const;

export async function saveSheetSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const sheetUrl = String(formData.get("sheetUrl") ?? "").trim();
  const courseFilter = String(formData.get("courseFilter") ?? "").trim().slice(0, 200);

  if (sheetUrl && !parseSheetUrl(sheetUrl)) {
    return { fieldErrors: { sheetUrl: "Havola noto'g'ri. Google Sheets manzilini to'liq nusxalang." } };
  }

  const current = await getSettings({ fresh: true });
  // Belgi faqat formada bo'lsa o'qiladi (eski ochiq sahifadan yuborilsa — o'zgarmaydi)
  const autoImport = formData.has("autoImportShown") ? formData.get("autoImport") === "on" : current.autoImport;
  const columns = { ...current.columns };
  for (const f of COLUMN_FIELDS) {
    const v = String(formData.get(`col_${f}`) ?? "").trim().slice(0, 60);
    if (v) columns[f] = v;
  }
  await updateSettings({ $set: { sheetUrl, columns, courseFilter, autoImport } });
  await logActivity(session, "sync.settings", `Google Sheets sozlamalari saqlandi${courseFilter ? ` (kurslar: ${courseFilter})` : " (barcha kurslar)"}`);
  await dataChanged();
  return { ok: true, message: "Sozlamalar saqlandi" };
}

export async function runSyncNow(): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  await connectDB();
  const res = await runSync("manual");
  await dataChanged();
  if (!res) return { error: "Hozir boshqa tekshiruv ketmoqda, birozdan keyin urinib ko'ring" };
  await logActivity(
    session,
    "sync.run",
    res.ok
      ? `Sheets bilan tekshirildi: ${res.mismatches} ta farq${res.imported ? `, ${res.imported} ta to‘lov qo‘shildi` : ""}${res.ignored ? ` (${res.ignored} tasi e’tiborsiz qoldirilgan)` : ""}`
      : `Sheets tekshiruvi xato: ${res.error}`,
  );
  if (!res.ok) return { error: res.error };
  const parts = [
    res.imported ? `${res.imported} ta to‘lov Sheets’dan saytga qo‘shildi` : "",
    res.mismatches ? `${res.mismatches} ta farq topildi` : "",
    res.ignored ? `${res.ignored} ta e’tiborsiz qoldirilgan farq ko‘rsatilmadi` : "",
  ].filter(Boolean);
  return { ok: true, message: parts.length ? `Tekshirildi: ${parts.join(", ")}` : "Tekshirildi: hammasi bir xil ✓" };
}

/** Bitta «Saytda yo'q» / «Noma'lum o'quvchi» farqini saytga qo'shadi. */
export async function importMismatch(runId: string, mismatchId: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(runId) || !isId(mismatchId)) return;
  const res = await importFromRun(runId, [mismatchId]);
  if (res?.resolved) await logActivity(session, "sync.import", "Sheets’dagi yozuv saytga qo‘shildi");
  await dataChanged();
}

/**
 * «Noma'lum o'quvchi» farqini saytdagi tanlangan o'quvchiga qo'shadi (ismi Sheets'da boshqacha yozilgan bo'lsa):
 * to'lovlari unga yoziladi, Sheets'dagi ismi unga bog'lanadi — keyingi tekshiruvlarda o'zi topiladi.
 */
export async function linkMismatch(runId: string, mismatchId: string, studentId: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(runId) || !isId(mismatchId) || !isId(studentId)) return;
  await connectDB();
  const run = await SyncRun.findById(runId, { mismatches: 1 }).lean();
  const m = run?.mismatches.find((x) => String(x._id) === mismatchId);
  if (!m || m.kind !== "unknown_student" || m.resolved) return;
  const res = await importFromRun(runId, [mismatchId], { studentId });
  if (res?.resolved) {
    await logActivity(
      session,
      "sync.import",
      res.payments
        ? `Sheets’dagi «${m.studentName}» to‘lovlari saytdagi «${res.linkedTo}» o‘quvchisiga qo‘shildi (${res.payments} ta to‘lov)`
        : `Sheets’dagi «${m.studentName}» saytdagi «${res.linkedTo}» o‘quvchisiga bog‘landi (to‘lovi saytda allaqachon bor — qayta yozilmadi)`,
    );
  }
  await dataChanged();
}

/** Barcha qo'shsa bo'ladigan farqlarni saytga qo'shadi va qayta tekshiradi. */
export async function importAllMismatches(runId: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(runId)) return;
  const res = await importFromRun(runId, "all");
  if (res && res.resolved > 0) {
    await logActivity(session, "sync.import", `Sheets’dan ${res.resolved} ta yozuv saytga qo‘shildi`);
    await runSync("manual");
  }
  await dataChanged();
}

/** Farqni "hal qilindi" deb belgilash (masalan, Sheets'ni qo'lda to'g'rilagandan keyin). */
export async function resolveMismatch(runId: string, mismatchId: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(runId) || !isId(mismatchId)) return;
  await connectDB();
  const run = await SyncRun.findById(runId);
  const mismatch = run?.mismatches.id(mismatchId);
  if (!run || !mismatch) return;
  mismatch.resolved = true;
  await run.save();
  await logActivity(session, "sync.resolve", `Farq hal qilindi deb belgilandi: ${mismatch.studentName}`);
  await dataChanged();
}

const KIND_TEXT: Record<MismatchKind, string> = {
  missing_on_site: "Saytda yo‘q",
  missing_in_sheet: "Sheets’da yo‘q",
  amount_diff: "Summa farqi",
  unknown_student: "Saytda yo‘q o‘quvchi",
};

/**
 * Farqni e'tiborsiz qoldirish: shu tekshiruvda yashiriladi va keyingi tekshiruvlarda (qo'lda, cron, avtomatik) ham
 * ko'rsatilmaydi, saytga avtomatik qo'shilmaydi. Shu yozuv o'zgarsa (summa, sana, yangi to'lov) — farq yana chiqadi.
 */
export async function ignoreMismatch(runId: string, mismatchId: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(runId) || !isId(mismatchId)) return;
  await connectDB();
  const run = await SyncRun.findById(runId);
  const m = run?.mismatches.id(mismatchId);
  if (!run || !m || m.ignored) return;
  const key = mismatchKey(m, run.basis === "date" ? "date" : "month");
  await SyncIgnore.updateOne(
    { key },
    {
      $setOnInsert: {
        key,
        kind: m.kind,
        studentId: m.studentId ?? null,
        studentName: m.studentName ?? "",
        group: m.group ?? "",
        month: m.month,
        siteAmount: m.siteAmount ?? 0,
        sheetAmount: m.sheetAmount ?? 0,
        sheetRows: m.sheetRows ?? [],
        sheetDate: m.sheetDate ?? "",
      },
    },
    { upsert: true },
  );
  m.ignored = true;
  m.resolved = true;
  await run.save();
  await logActivity(session, "sync.ignore", `E’tiborsiz qoldirildi: ${m.studentName} — ${KIND_TEXT[m.kind as MismatchKind]}, ${monthLabel(m.month)}`);
  await dataChanged();
}

/** E'tiborsiz qoldirishni bekor qilish: farq oxirgi tekshiruvda bo'lsa — darhol, aks holda keyingi tekshiruvda yana ko'rinadi. */
export async function unignoreMismatch(ignoreId: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(ignoreId)) return;
  await connectDB();
  const doc = await SyncIgnore.findByIdAndDelete(ignoreId).lean();
  if (!doc) return;
  const last = await SyncRun.findOne({}).sort({ startedAt: -1 });
  if (last) {
    const basis = last.basis === "date" ? "date" : "month";
    let changed = false;
    for (const m of last.mismatches) {
      if (m.ignored && mismatchKey(m, basis) === doc.key) {
        m.ignored = false;
        m.resolved = false;
        changed = true;
      }
    }
    if (changed) await last.save();
  }
  await logActivity(session, "sync.unignore", `E’tiborsiz qoldirish bekor qilindi: ${doc.studentName} — ${KIND_TEXT[doc.kind as MismatchKind]}, ${monthLabel(doc.month)}`);
  await dataChanged();
}
