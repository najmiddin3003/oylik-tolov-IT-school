"use client";

// Ortiqcha to'lovni qo'lda taqsimlash: har oyga qancha to'lov bo'lishini xodim o'zi yozadi. Jami summa o'zgarmaydi —
// mavjud to'lov yozuvlari oylar orasida ko'chiriladi.
import { useState, useTransition } from "react";
import { Check, PencilLine, X } from "lucide-react";
import { rebalancePayments } from "@/app/actions/payments";
import { formatMoney, monthLabel } from "@/lib/time";
import { MoneyInput } from "./inputs";
import { btn, cx } from "./ui";

type Month = { month: string; fee: number; paid: number; suggested: number };

export function OverpayEditor({ studentId, name, months }: { studentId: string; name: string; months: Month[] }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(months.map((m) => [m.month, String(m.suggested)])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = months.reduce((s, m) => s + m.paid, 0);
  const entered = months.reduce((s, m) => s + (Number(values[m.month] || 0) || 0), 0);
  const diff = total - entered;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn.sm}>
        <PencilLine className="size-4" aria-hidden />
        Qo‘lda
      </button>
    );
  }
  return (
    <div className="w-full rounded-xl border border-line bg-slate-50/60 p-3.5 sm:p-4" role="group" aria-label={`${name}: to‘lovni oylarga taqsimlash`}>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => (
          <label key={m.month} className="block">
            <span className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium text-ink-700">{monthLabel(m.month)}</span>
              <span className="num text-xs text-ink-400">
                oylik {formatMoney(m.fee)} · hozir {formatMoney(m.paid)}
              </span>
            </span>
            <MoneyInput
              value={values[m.month] ?? ""}
              onValueChange={(d) => setValues((v) => ({ ...v, [m.month]: d }))}
              aria-label={`${monthLabel(m.month)} uchun to‘lov`}
              className="h-10 bg-surface"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className={cx("num text-[13px]", diff ? "font-medium text-rose-600" : "text-ink-500")} aria-live="polite">
          Jami {formatMoney(entered)} / {formatMoney(total)}
          {diff > 0 ? ` — yana ${formatMoney(diff)} taqsimlang` : diff < 0 ? ` — ${formatMoney(-diff)} ortiqcha` : " ✓"}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className={cx(btn.sm, "border-transparent")}>
            <X className="size-4" aria-hidden />
            Bekor
          </button>
          <button
            type="button"
            disabled={pending || diff !== 0}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await rebalancePayments(studentId, values).catch(() => ({ ok: false as const, error: "Tarmoq xatosi — qayta urinib ko‘ring" }));
                if (!res.ok) setError(res.error);
                else setOpen(false);
              })
            }
            className={cx(btn.primary, "h-9 px-3 text-sm")}
          >
            <Check className="size-4" aria-hidden />
            {pending ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
