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

export function SheetSettingsForm({ sheetUrl, columns }: { sheetUrl: string; columns: ColumnNames }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSheetSettings, {});
  const fe = state.fieldErrors ?? {};
  const cols: { name: string; label: string; value: string; hint: string }[] = [
    { name: "colName", label: "Ism ustuni", value: columns.name, hint: "majburiy" },
    { name: "colPhone", label: "Telefon ustuni", value: columns.phone, hint: "tavsiya" },
    { name: "colMonth", label: "Oy ustuni", value: columns.month, hint: "yoki sana" },
    { name: "colAmount", label: "Summa ustuni", value: columns.amount, hint: "majburiy" },
    { name: "colDate", label: "Sana ustuni", value: columns.date, hint: "ixtiyoriy" },
  ];

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
            Kerakli varaqni oching va brauzerdagi manzilni to&apos;liq nusxalang (gid= qismi bilan).
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Jadvaldagi ustun nomlari (sarlavha qatori)</legend>
        <p className="mb-3 text-xs text-slate-500">
          Sarlavhalar shu nomlarga mos bo&apos;lishi kerak. Topilmasa, tizim «Ism», «F.I.SH», «Summa», «To&apos;lov», «Oy», «Sana» kabi
          keng tarqalgan nomlarni o&apos;zi qidiradi.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cols.map((c) => (
            <div key={c.name}>
              <label htmlFor={c.name} className="mb-1 block text-xs font-medium text-slate-600">
                {c.label}
              </label>
              <input id={c.name} name={c.name} defaultValue={c.value} className={inputCls} />
              <span className="mt-1 block text-[11px] text-slate-400">{c.hint}</span>
            </div>
          ))}
        </div>
      </fieldset>

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
