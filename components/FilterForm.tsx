"use client";

import Form from "next/form";
import { useEffect, useRef, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cx, inputCls } from "./ui";

/**
 * URL parametrlari bilan ishlaydigan filtr: ro'yxat/sana tanlansa darhol, qidiruv — yozilishi bilan
 * (Enter bosish shart emas). Brauzer tarixi har harfda to'lib ketmasligi uchun `replace`.
 */
export function FilterForm({ action, className, children }: { action: string; className?: string; children: ReactNode }) {
  return (
    <Form
      action={action}
      replace
      scroll={false}
      className={className}
      role="search"
      onSubmitCapture={(e) => {
        // Bo'sh filtrlar manzilga qo'shilmaydi (?method=&day= kabi) — fokusdagi maydondan tashqari
        const empty = Array.from(e.currentTarget.elements).filter(
          (el): el is HTMLInputElement => el instanceof HTMLInputElement && !!el.name && !el.value && el !== document.activeElement,
        );
        empty.forEach((el) => (el.disabled = true));
        setTimeout(() => empty.forEach((el) => (el.disabled = false)), 0);
      }}
    >
      {children}
    </Form>
  );
}

/** Yozilishi bilan (0.35 soniya kutib) formani yuboradigan qidiruv maydoni. */
export function SearchInput({
  name = "q",
  defaultValue,
  placeholder,
  label,
  className,
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef(defaultValue ?? "");

  // Manzil boshqa yo'l bilan o'zgarsa (tab, "tozalash" havolasi) — maydon ham yangilanadi.
  // Foydalanuvchi hozir shu maydonda yozayotgan bo'lsa — tegilmaydi.
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    el.value = defaultValue ?? "";
    last.current = defaultValue ?? "";
  }, [defaultValue]);

  const submitSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const value = ref.current?.value ?? "";
      if (value.trim() === last.current.trim()) return;
      last.current = value;
      ref.current?.form?.requestSubmit();
    }, 350);
  };

  return (
    <label className={cx("relative min-w-[200px] flex-1", className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" strokeWidth={1.8} aria-hidden />
      <input
        ref={ref}
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        onChange={submitSoon}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            clearTimeout(timer.current);
            last.current = e.currentTarget.value;
          }
        }}
        className={cx(inputCls, "pl-11")}
      />
    </label>
  );
}
