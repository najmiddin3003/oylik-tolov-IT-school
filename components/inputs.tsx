"use client";

// Raqamli maydonlar: telefon ("90 123 45 67") va pul ("1 250 000") — yozish paytida raqamlar guruhlab ajratiladi,
// kursor joyidan sakramaydi. Forma qiymati ham shu ko'rinishda yuboriladi (server raqamlarni o'zi ajratib oladi).
// Shuningdek, parol maydonidagi «ko'rsatish / yashirish» tugmasi.
import { useLayoutEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, Smartphone } from "lucide-react";
import { cx, inputCls } from "./ui";

/** 9 ta raqamni "90 123 45 67" ko'rinishiga. */
export function formatPhoneDigits(digits: string): string {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

/** Istalgan yozuvdan 9 ta raqam: "+998 90 123-45-67" -> "901234567". */
export function phoneDigits(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  return d.slice(0, 9);
}

/** 1250000 -> "1 250 000" (bo'sh bo'lsa — ""). */
export function formatMoneyDigits(digits: string): string {
  const d = digits.replace(/^0+(?=\d)/, "");
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
}

/**
 * Formatlangan qiymat o'zgarganda kursorni joyida saqlash: kursordan oldingi raqamlar soni bo'yicha
 * yangi matndagi o'rni topiladi.
 */
function useCaret() {
  const ref = useRef<HTMLInputElement>(null);
  const pending = useRef<number | null>(null);
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    const digitsBefore = pending.current;
    if (!el || digitsBefore === null || document.activeElement !== el) return;
    pending.current = null;
    let pos = 0;
    let seen = 0;
    while (pos < el.value.length && seen < digitsBefore) {
      if (/\d/.test(el.value[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  }, [tick]);
  const remember = (e: ChangeEvent<HTMLInputElement>) => {
    const caret = e.target.selectionStart ?? e.target.value.length;
    pending.current = e.target.value.slice(0, caret).replace(/\D/g, "").length;
    setTick((t) => t + 1);
  };
  return { ref, remember };
}

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "size"> & {
  invalid?: boolean;
};

/** Telefon: chapda "+998", yozilganda "90 123 45 67" bo'lib ajratiladi. */
export function PhoneInput({
  defaultValue,
  value,
  onValueChange,
  invalid,
  className,
  icon = false,
  size = "md",
  ...rest
}: BaseProps & {
  defaultValue?: string;
  /** Boshqariladigan rejim: 9 ta raqam */
  value?: string;
  onValueChange?: (digits: string) => void;
  /** Chapda telefon belgisi */
  icon?: boolean;
  size?: "md" | "lg";
}) {
  const [inner, setInner] = useState(() => phoneDigits(defaultValue));
  const digits = value !== undefined ? phoneDigits(value) : inner;
  const { ref, remember } = useCaret();
  return (
    <div className="relative">
      {icon ? <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" strokeWidth={1.8} aria-hidden /> : null}
      <span className={cx("num pointer-events-none absolute top-1/2 -translate-y-1/2 text-[15px] text-ink-400", icon ? "left-11" : "left-3.5")}>+998</span>
      <input
        {...rest}
        ref={ref}
        type="tel"
        inputMode="tel"
        value={formatPhoneDigits(digits)}
        onChange={(e) => {
          remember(e);
          const next = phoneDigits(e.target.value);
          if (value === undefined) setInner(next);
          onValueChange?.(next);
        }}
        aria-invalid={invalid || undefined}
        className={cx(inputCls, "num", size === "lg" ? "h-12" : "", icon ? "pl-[5.5rem]" : "pl-14", className)}
      />
    </div>
  );
}

/** Pul summasi: "1 250 000" (o'ngda "so'm"). */
export function MoneyInput({
  defaultValue,
  value,
  onValueChange,
  invalid,
  className,
  suffix = "so‘m",
  maxDigits = 11,
  ...rest
}: BaseProps & {
  defaultValue?: string | number | null;
  /** Boshqariladigan rejim: formatlangan yoki faqat raqamli qiymat */
  value?: string;
  /** Raqamlar (masalan, "1250000") va formatlangani */
  onValueChange?: (digits: string, formatted: string) => void;
  suffix?: string | null;
  maxDigits?: number;
}) {
  const [inner, setInner] = useState(() => String(defaultValue ?? "").replace(/\D/g, "").slice(0, maxDigits));
  const digits = value !== undefined ? value.replace(/\D/g, "").slice(0, maxDigits) : inner;
  const { ref, remember } = useCaret();
  return (
    <div className="relative">
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatMoneyDigits(digits)}
        onChange={(e) => {
          remember(e);
          const next = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
          if (value === undefined) setInner(next);
          onValueChange?.(next, formatMoneyDigits(next));
        }}
        aria-invalid={invalid || undefined}
        className={cx(inputCls, "num", suffix ? "pr-14" : "", className)}
      />
      {suffix ? <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-400">{suffix}</span> : null}
    </div>
  );
}

/** Parol maydoni ichidagi «ko'rsatish / yashirish» tugmasi (maydonga o'ngdan `pr-11` joy qoldiring). */
export function RevealPasswordButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 transition hover:bg-slate-100 hover:text-ink-700"
      aria-label={shown ? "Parolni yashirish" : "Parolni ko‘rsatish"}
      aria-pressed={shown}
      title={shown ? "Parolni yashirish" : "Parolni ko‘rsatish"}
    >
      {shown ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
    </button>
  );
}
