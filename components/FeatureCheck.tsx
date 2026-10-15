"use client";

// Yoqib-o'chiriladigan sozlama: katakcha (galochka) bosilishi bilan saqlanadi — alohida «Saqlash» tugmasi shart emas.
import { useState, useTransition, type ReactNode } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { cx } from "./ui";

export function FeatureCheck({
  title,
  hint,
  initial,
  action,
  disabled,
}: {
  title: ReactNode;
  hint?: ReactNode;
  initial: boolean;
  /** Server action (masalan, setFeature.bind(null, "paymentDateAdmin")) */
  action: (on: boolean) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(initial);
  // Sahifa yangilanib, serverdagi qiymat o'zgarsa — katakcha ham yangilanadi
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setChecked(initial);
  }
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const toggle = () => {
    if (pending || disabled) return;
    const next = !checked;
    setChecked(next);
    setStatus("idle");
    startTransition(async () => {
      try {
        await action(next);
        setStatus("saved");
      } catch {
        setChecked(!next);
        setStatus("error");
      }
    });
  };

  return (
    <label
      className={cx(
        "group flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition",
        checked ? "border-brand-200 bg-brand-50/50" : "border-line hover:bg-slate-50/70",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={toggle} disabled={disabled} />
      <span
        className={cx(
          "mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-md border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/20",
          checked ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-surface text-transparent group-hover:border-brand-300",
        )}
        aria-hidden
      >
        <Check className={cx("size-3.5 transition", checked ? "scale-100" : "scale-50")} strokeWidth={3.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink-900">
          {title}
          {pending ? <LoaderCircle className="size-3.5 animate-spin text-ink-400" aria-label="Saqlanmoqda" /> : null}
          {!pending && status === "saved" ? <span className="text-xs font-medium text-emerald-600">saqlandi ✓</span> : null}
          {!pending && status === "error" ? <span className="text-xs font-medium text-rose-600">saqlanmadi — qayta urinib ko‘ring</span> : null}
        </span>
        {hint ? <span className="mt-0.5 block text-sm leading-relaxed text-ink-500">{hint}</span> : null}
      </span>
    </label>
  );
}
