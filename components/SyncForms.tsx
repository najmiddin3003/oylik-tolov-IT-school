"use client";

import { useActionState, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { runSyncNow, saveSheetSettings } from "@/app/actions/sync";
import type { FormState } from "@/app/actions/types";
import type { ColumnNames } from "@/lib/compare";
import { btn, cx, inputCls, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

export function RunSyncButton({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(runSyncNow, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:items-end">
      <button type="submit" disabled={pending || disabled} className={btn.primary}>
        <RefreshCw className={cx("size-[18px]", pending && "animate-spin")} strokeWidth={2} aria-hidden />
        {pending ? "Tekshirilmoqda…" : "Hozir tekshirish"}
      </button>
      {state.error ? (
        <p className="max-w-sm text-sm text-rose-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-sm text-emerald-700" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

const COLUMN_FIELDS: { key: keyof ColumnNames; label: string; hint: string }[] = [
  { key: "name", label: "Ism", hint: "majburiy" },
  { key: "course", label: "Kurs", hint: "filtr uchun" },
  { key: "amount", label: "Jami summa", hint: "yoki naqd + plastik" },
  { key: "cash", label: "Naqd", hint: "ixtiyoriy" },
  { key: "card", label: "Plastik", hint: "ixtiyoriy" },
  { key: "date", label: "To‘lov sanasi", hint: "oy ustuni bo‘lmasa — majburiy" },
  { key: "fee", label: "Kurs narxi", hint: "import uchun" },
  { key: "month", label: "Oy", hint: "ixtiyoriy" },
  { key: "phone", label: "Telefon", hint: "ixtiyoriy" },
];

export function SheetSettingsForm({
  sheetUrl,
  columns,
  courseFilter,
  autoImport,
  courses = [],
}: {
  sheetUrl: string;
  columns: ColumnNames;
  courseFilter: string;
  autoImport: boolean;
  /** Sozlamalardagi kurslar — qaysilari solishtirilishini belgilash uchun */
  courses?: string[];
}) {
  const [state, onSubmit, pending] = useActionForm<FormState>(saveSheetSettings, {});
  const fe = state.fieldErrors ?? {};
  // Filtrdagi nomlar: ro'yxatdagi kurslar + ro'yxatda yo'q (qo'lda yozilgan) nomlar
  const initial = courseFilter
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const options = [...courses, ...initial.filter((t) => !courses.some((c) => c.toLowerCase() === t.toLowerCase()))];
  const [picked, setPicked] = useState<string[]>(() => options.filter((o) => initial.some((t) => t.toLowerCase() === o.toLowerCase())));
  const all = picked.length === 0;

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
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
          <p className="mt-1.5 text-xs text-rose-600">{fe.sheetUrl}</p>
        ) : (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
            To‘lovlar varag‘ini (masalan «O‘quvchilar») oching va brauzerdagi manzilni to‘liq nusxalang. Yangi oy uchun yangi jadval
            ochilsa — shu yerga yangisini qo‘ying.
          </p>
        )}
      </div>

      <fieldset>
        <legend className={labelCls}>Qaysi kurslar solishtiriladi</legend>
        <input type="hidden" name="courseFilter" value={picked.join(", ")} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPicked([])}
            aria-pressed={all}
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-inset transition",
              all ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-600 ring-line hover:bg-slate-50",
            )}
          >
            Barcha kurslar
          </button>
          {options.map((o) => {
            const on = picked.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((list) => (on ? list.filter((x) => x !== o) : [...list, o]))}
                className={cx(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-inset transition",
                  on ? "bg-brand-600 text-white ring-brand-600" : "bg-surface text-ink-600 ring-line hover:bg-slate-50",
                )}
              >
                {on ? <Check className="size-3.5" strokeWidth={2.6} aria-hidden /> : null}
                {o}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-400">
          {all
            ? "Jadvaldagi hamma qatorlar solishtiriladi. Saytda yo‘q kurs o‘quvchilari «Saytda yo‘q o‘quvchi» bo‘lib chiqadi."
            : `Faqat «Kurs» ustunida ${picked.join(", ")} bo‘lgan qatorlar solishtiriladi, qolganlari e’tiborsiz qoldiriladi.`}{" "}
          Kurslar ro‘yxati — Sozlamalar → Kurslar.
        </p>
      </fieldset>

      <div>
        <input type="hidden" name="autoImportShown" value="1" />
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition hover:bg-slate-50/60">
          <input type="checkbox" name="autoImport" defaultChecked={autoImport} className="mt-0.5 size-4 shrink-0 rounded accent-brand-600" />
          <span>
            <span className="block text-sm font-semibold text-ink-900">Sheets’dagi to‘lovlarni avtomatik saytga qo‘shish</span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-500">
              Har tekshiruvda (har kuni ertalab, kechki SMS oldidan va «Hozir tekshirish»da) Sheets’da bor, saytda yo‘q to‘lovlar o‘zi
              saytga yoziladi — sanasi, summasi va naqd/plastik bilan. Saytda yo‘q yangi o‘quvchilar va summa farqlari — avvalgidek tugma
              bilan tasdiqlanadi.
            </span>
          </span>
        </label>
      </div>

      <details className="group rounded-xl border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-ink-700 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            Jadval ustunlari{" "}
            <span className="font-normal text-ink-400">
              · {columns.name} · {columns.course} · {columns.amount} · {columns.date}
            </span>
          </span>
          <span className="text-xs text-ink-400 transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="border-t border-line-soft p-4">
          <p className="mb-4 text-xs leading-relaxed text-ink-500">
            Sarlavha qatoridagi nomlar. Topilmasa, tizim «F.I.SH», «Summa», «Naqd», «Sana» kabi keng tarqalgan nomlarni ham o‘zi
            qidiradi. «Oy» ustuni bo‘lmasa, to‘lovlar <b>to‘lov sanasi</b> bo‘yicha solishtiriladi.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {COLUMN_FIELDS.map((c) => (
              <div key={c.key}>
                <label htmlFor={`col_${c.key}`} className="mb-1.5 block text-xs font-medium text-ink-600">
                  {c.label}
                </label>
                <input id={`col_${c.key}`} name={`col_${c.key}`} defaultValue={columns[c.key]} className={inputCls} />
                <span className="mt-1 block text-[11px] text-ink-400">{c.hint}</span>
              </div>
            ))}
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn.outline}>
          {pending ? "Saqlanmoqda…" : "Sozlamalarni saqlash"}
        </button>
        {state.ok && state.message ? <span className="text-sm text-emerald-700">✓ {state.message}</span> : null}
        {state.error ? <span className="text-sm text-rose-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
