"use client";

// Administrator: kassadagi pulni rahbarga topshirish (naqd va karta alohida).
import { useState } from "react";
import { Banknote, CreditCard, Send } from "lucide-react";
import { sendHandover } from "@/app/actions/kassa";
import type { FormState } from "@/app/actions/types";
import { formatMoney, formatNumber } from "@/lib/time";
import { MoneyInput } from "./inputs";
import { btn, cx, inputCls, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

export function HandoverForm({ available }: { available: { cash: number; card: number } }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(sendHandover, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <HandoverFields key={state.nonce ?? 0} available={available} fe={state.fieldErrors ?? {}} />
      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800" role="status">
          ✓ {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending || available.cash + available.card <= 0} className={cx(btn.primary, "w-full")}>
        <Send className="size-[18px]" aria-hidden />
        {pending ? "Yuborilmoqda…" : "Rahbarga topshirish"}
      </button>
      <p className="-mt-1 text-xs leading-relaxed text-ink-400">Rahbar «Qabul qildim» deguncha pul sizning kassangizda turadi.</p>
    </form>
  );
}

function HandoverFields({ available, fe }: { available: { cash: number; card: number }; fe: Record<string, string> }) {
  const [cash, setCash] = useState(available.cash > 0 ? formatNumber(available.cash) : "");
  const [card, setCard] = useState(available.card > 0 ? formatNumber(available.card) : "");
  const field = (key: "cash" | "card", label: string, Icon: typeof Banknote, value: string, set: (v: string) => void, max: number) => (
    <div>
      <label htmlFor={`ho-${key}`} className={cx(labelCls, "flex items-center gap-2")}>
        <Icon className="size-4 text-ink-400" aria-hidden />
        {label}
        <span className="num ml-auto text-xs font-normal text-ink-400">kassada {formatMoney(Math.max(0, max))}</span>
      </label>
      <MoneyInput id={`ho-${key}`} name={key} value={value} onValueChange={(_, f) => set(f)} placeholder="0" invalid={!!fe[key]} />
      {fe[key] ? <p className="mt-1.5 text-xs text-rose-600">{fe[key]}</p> : null}
    </div>
  );
  return (
    <>
      {field("cash", "Naqd", Banknote, cash, setCash, available.cash)}
      {field("card", "Karta va o‘tkazma", CreditCard, card, setCard, available.card)}
      <div>
        <label htmlFor="ho-note" className={labelCls}>
          Izoh <span className="font-normal text-ink-400">(ixtiyoriy)</span>
        </label>
        <input id="ho-note" name="note" maxLength={300} className={inputCls} placeholder="Topshirilayotgan pul haqida qisqacha" />
      </div>
    </>
  );
}
