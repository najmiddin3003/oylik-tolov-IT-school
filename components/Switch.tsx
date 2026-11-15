"use client";

import { cx } from "./ui";

/** Yoqish/o'chirish tugmasi (switch). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full ring-1 ring-inset transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50",
        checked ? "bg-emerald-500 ring-emerald-600/30" : "bg-slate-200 ring-slate-300/60 dark:bg-slate-700",
      )}
    >
      <span
        className={cx(
          "inline-block size-5 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)]",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
