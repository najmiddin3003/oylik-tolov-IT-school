"use client";

// SMS kod bosqichi (birinchi kirish / parolni tiklash): SMS'dagi kod + yangi parol, kodni qayta yuborish va raqamni o'zgartirish.
import { startTransition, useActionState, useState, useSyncExternalStore } from "react";
import { ArrowRight, KeyRound, RotateCcw } from "lucide-react";
import { verifyCode, type CodeState } from "@/app/actions/auth";
import { formatUzPhone } from "@/lib/phone";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords-rules";
import { RevealPasswordButton } from "./inputs";
import { btn, cx, inputCls, labelCls } from "./ui";

// Soniyalar sanog'i (qayta yuborish tugmasi uchun) — har soniyada yangilanadi
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;
function subscribe(cb: () => void) {
  listeners.add(cb);
  ticker ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(cb);
    if (!listeners.size && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}
const nowSec = () => Math.floor(Date.now() / 1000);

export function OtpCodeStep({
  state,
  sending,
  onResend,
  onChangePhone,
}: {
  /** Kod yuborilgan holat (telefon, maqsad, ism, xabar, qayta yuborish vaqti) */
  state: CodeState;
  /** Kod qayta yuborilmoqda */
  sending: boolean;
  /** Kodni qayta yuborish (forma: phone) */
  onResend: (fd: FormData) => void;
  /** Telefon raqamni o'zgartirish — raqam bosqichiga qaytish */
  onChangePhone: () => void;
}) {
  const [verifyState, verifyAction, verifying] = useActionState<CodeState, FormData>(verifyCode, { step: "code" });
  const now = useSyncExternalStore(subscribe, nowSec, () => 0);
  const waitSec = state.resendAt ? Math.max(0, Math.floor(state.resendAt / 1000) - now) : 0;
  const phone = state.phone ?? "";
  const purpose = state.purpose ?? "activate";
  const fe = verifyState.fieldErrors ?? {};
  // Yangi parol va takrori — bitta tugma bilan birga ko'rsatiladi / yashiriladi
  const [shown, setShown] = useState(false);
  const toggle = () => setShown((v) => !v);

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm leading-relaxed text-brand-900">
        {state.name ? (
          <p className="font-semibold">
            {purpose === "reset" ? "Parolni tiklash" : "Xush kelibsiz"}, {state.name}!
          </p>
        ) : null}
        <p className="text-brand-800/85">{state.info}</p>
        {purpose === "activate" ? <p className="mt-1 text-brand-800/85">Kodni kiritib, o‘zingizga parol qo‘ying — keyingi safar shu parol bilan kirasiz.</p> : null}
        {state.error ? <p className="mt-1.5 font-medium text-rose-600">{state.error}</p> : null}
        {state.devCode ? (
          <p className="num mt-2 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 font-semibold text-ink-900 ring-1 ring-inset ring-brand-200">
            Kod: <span className="tracking-[0.3em]">{state.devCode}</span>
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => verifyAction(fd));
        }}
        className="grid gap-4"
        noValidate
      >
        <input type="hidden" name="phone" value={phone} />
        <div>
          <label htmlFor="reg-code" className={labelCls}>
            SMS’dagi kod
          </label>
          <input
            id="reg-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={8}
            placeholder="• • • • • •"
            className={cx(inputCls, "num h-12 text-center text-[20px] font-semibold tracking-[0.4em]")}
            aria-invalid={!!fe.code}
          />
          {fe.code ? <p className="mt-1.5 text-xs text-rose-600">{fe.code}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-password" className={labelCls}>
              {purpose === "reset" ? "Yangi parol" : "Parol yarating"}
            </label>
            <div className="relative">
              <input
                id="reg-password"
                name="password"
                type={shown ? "text" : "password"}
                autoComplete="new-password"
                className={cx(inputCls, "h-12 pr-12")}
                aria-invalid={!!fe.password}
              />
              <RevealPasswordButton shown={shown} onToggle={toggle} />
            </div>
            {fe.password ? <p className="mt-1.5 text-xs text-rose-600">{fe.password}</p> : <p className="mt-1.5 text-xs text-ink-400">Kamida {MIN_PASSWORD_LENGTH} ta belgi</p>}
          </div>
          <div>
            <label htmlFor="reg-confirm" className={labelCls}>
              Parolni takrorlang
            </label>
            <div className="relative">
              <input
                id="reg-confirm"
                name="confirm"
                type={shown ? "text" : "password"}
                autoComplete="new-password"
                className={cx(inputCls, "h-12 pr-12")}
                aria-invalid={!!fe.confirm}
              />
              <RevealPasswordButton shown={shown} onToggle={toggle} />
            </div>
            {fe.confirm ? <p className="mt-1.5 text-xs text-rose-600">{fe.confirm}</p> : null}
          </div>
        </div>
        {verifyState.error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
            {verifyState.error}
          </p>
        ) : null}
        <button type="submit" disabled={verifying} className={cx(btn.primary, "h-12 w-full")}>
          <KeyRound className="size-[18px]" aria-hidden />
          {verifying ? "Tekshirilmoqda…" : purpose === "reset" ? "Parolni saqlash va kirish" : "Parol qo‘yish va kirish"}
          {verifying ? null : <ArrowRight className="size-[18px]" aria-hidden />}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4 text-[13px]">
        <span className="num text-ink-500">{formatUzPhone(phone)}</span>
        <span className="flex items-center gap-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onResend(new FormData(e.currentTarget));
            }}
          >
            <input type="hidden" name="phone" value={phone} />
            <button
              type="submit"
              disabled={sending || waitSec > 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-brand-600 transition hover:bg-brand-50 disabled:text-ink-400 disabled:hover:bg-transparent"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {waitSec > 0 ? `Qayta yuborish (${waitSec})` : "Kodni qayta yuborish"}
            </button>
          </form>
          <button type="button" onClick={onChangePhone} className="rounded-lg px-2 py-1 font-medium text-ink-500 transition hover:bg-slate-100 hover:text-ink-800">
            Raqamni o‘zgartirish
          </button>
        </span>
      </div>
    </div>
  );
}
