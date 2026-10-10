"use client";

import { useActionState } from "react";
import { runSyncNow, saveSheetSettings } from "@/app/actions/sync";
import type { FormState } from "@/app/actions/types";
import type { ColumnNames } from "@/lib/compare";
import { btn, inputCls, labelCls } from "./ui";

export function RunSyncButton({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(runSyncNow, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:items-end">
      <button type="submit" disabled={pending || disabled} className={btn.primary}>
        <svg viewBox="0 0 24 24" className={`size-4 ${pending ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />
        </svg>
        {pending ? "Tekshirilmoqda…" : "Hozir tekshirish"}
      </button>
      {state.error ? <p className="max-w-sm text-sm text-rose-600" role="alert">{state.error}</p> : null}
      {state.ok && state.message ? <p className="text-sm text-emerald-700" role="status">{state.message}</p> : null}
    </form>
  );
}

const COLUMN_FIELDS: { key: keyof ColumnNames; label: string; hint: string }[] = [
  { key: "name", label: "Ism", hint: "majburiy" },
  { key: "course", label: "Kurs", hint: "filtr uchun" },
  { key: "amount", label: "Jami summa", hint: "yoki naqd + plastik" },
  { key: "cash", label: "Naqd", hint: "ixtiyoriy" },
  { key: "card", label: "Plastik", hint: "ixtiyoriy" },
  { key: "date", label: "To'lov sanasi", hint: "oy ustuni bo'lmasa — majburiy" },
  { key: "fee", label: "Kurs narxi", hint: "import uchun" },
  { key: "month", label: "Oy", hint: "ixtiyoriy" },
  { key: "phone", label: "Telefon", hint: "ixtiyoriy" },
];

export function SheetSettingsForm({
  sheetUrl,
  columns,
  courseFilter,
}: {
  sheetUrl: string;
  columns: ColumnNames;
  courseFilter: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSheetSettings, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-5">
      <div>
        <label htmlFor="sheetUrl" className={labelCls}>
          Google Sheets havolasi
        </label>
        <input
          id="sheetUrl"
          name="sheetUrl"
          type="url"
          defaultValue={sheetUrl}
          className={inputCls}
          placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
          aria-invalid={!!fe.sheetUrl}
        />
        {fe.sheetUrl ? (
          <p className="mt-1 text-xs text-rose-600">{fe.sheetUrl}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            To&apos;lovlar varag&apos;ini (masalan «O&apos;quvchilar») oching va brauzerdagi manzilni to&apos;liq nusxalang. Yangi oy
            uchun yangi jadval ochilsa — shu yerga yangisini qo&apos;ying.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="courseFilter" className={labelCls}>
          Faqat shu kurs
        </label>
        <input
          id="courseFilter"
          name="courseFilter"
          defaultValue={courseFilter}
          className={inputCls}
          placeholder="Bo'sh — barcha kurslar"
        />
        <p className="mt-1 text-xs text-slate-500">
          «Kurs» ustunida shu nom bor qatorlargina solishtiriladi, qolganlari e&apos;tiborsiz qoldiriladi. Bir nechta kurs —
          vergul bilan.
        </p>
      </div>

      <details className="group rounded-lg border border-slate-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
          <span>
            Jadval ustunlari{" "}
            <span className="font-normal text-slate-500">
              · {columns.name} · {columns.course} · {columns.amount} · {columns.date}
            </span>
          </span>
          <span className="text-xs text-slate-400 group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="border-t border-slate-100 p-4">
          <p className="mb-3 text-xs text-slate-500">
            Sarlavha qatoridagi nomlar. Topilmasa, tizim «F.I.SH», «Summa», «Naqd», «Sana» kabi keng tarqalgan nomlarni ham
            o&apos;zi qidiradi. «Oy» ustuni bo&apos;lmasa, to&apos;lovlar <b>to&apos;lov sanasi</b> bo&apos;yicha solishtiriladi.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLUMN_FIELDS.map((c) => (
              <div key={c.key}>
                <label htmlFor={`col_${c.key}`} className="mb-1 block text-xs font-medium text-slate-600">
                  {c.label}
                </label>
                <input id={`col_${c.key}`} name={`col_${c.key}`} defaultValue={columns[c.key]} className={inputCls} />
                <span className="mt-1 block text-[11px] text-slate-400">{c.hint}</span>
              </div>
            ))}
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn.secondary}>
          {pending ? "Saqlanmoqda…" : "Sozlamalarni saqlash"}
        </button>
        {state.ok && state.message ? <span className="text-sm text-emerald-700">✓ {state.message}</span> : null}
        {state.error ? <span className="text-sm text-rose-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
