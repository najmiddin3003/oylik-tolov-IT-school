"use client";

// Xodim ro'yxatdan o'tishi / parolni tiklash: 1) telefon -> SMS kod, 2) kod + yangi parol.
import { startTransition, useActionState, useState, useSyncExternalStore } from "react";
import { ArrowRight, KeyRound, MessageSquareText, RotateCcw } from "lucide-react";
import { requestCode, verifyCode, type CodeState } from "@/app/actions/auth";
import { PhoneInput } from "@/components/inputs";
import { btn, cx, inputCls, labelCls } from "@/components/ui";
import { formatUzPhone } from "@/lib/phone";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords-rules";

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

export function RegisterForm() {
  const [sendState, sendAction, sending] = useActionState<CodeState, FormData>(requestCode, { step: "phone" });
  const [verifyState, verifyAction, verifying] = useActionState<CodeState, FormData>(verifyCode, { step: "code" });
  const [restart, setRestart] = useState(0);
  // Kod bosqichi: kod so'ralgan va foydalanuvchi telefonni o'zgartirmagan
  const codeStep = sendState.step === "code" && restart < 1;
  const now = useSyncExternalStore(subscribe, nowSec, () => 0);
  const waitSec = sendState.resendAt ? Math.max(0, Math.floor(sendState.resendAt / 1000) - now) : 0;

  if (!codeStep) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setRestart(0);
          startTransition(() => sendAction(fd));
        }}
        className="grid gap-5"
        noValidate
      >
        <div>
          <label htmlFor="reg-phone" className={labelCls}>
            Telefon raqamingiz
          </label>
          <PhoneInput
            id="reg-phone"
            name="phone"
            icon
            size="lg"
            autoComplete="tel"
            autoFocus
            defaultValue={sendState.phone ?? ""}
            placeholder="90 123 45 67"
            invalid={!!sendState.error}
          />
          {sendState.error ? (
            <p className="mt-1.5 text-sm text-rose-600" role="alert">
              {sendState.error}
            </p>
          ) : null}
        </div>
        <button type="submit" disabled={sending} className={cx(btn.primary, "h-12 w-full")}>
          <MessageSquareText className="size-[18px]" aria-hidden />
          {sending ? "Yuborilmoqda…" : "SMS kod yuborish"}
        </button>
      </form>
    );
  }

  const phone = sendState.phone!;
  const purpose = sendState.purpose ?? "activate";
  const fe = verifyState.fieldErrors ?? {};

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm leading-relaxed text-brand-900">
        {sendState.name ? (
          <p className="font-semibold">
            {purpose === "reset" ? "Parolni tiklash" : "Xush kelibsiz"}, {sendState.name}!
          </p>
        ) : null}
        <p className="text-brand-800/85">{sendState.info}</p>
        {sendState.error ? <p className="mt-1.5 font-medium text-rose-600">{sendState.error}</p> : null}
        {sendState.devCode ? (
          <p className="num mt-2 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 font-semibold text-ink-900 ring-1 ring-inset ring-brand-200">
            Kod: <span className="tracking-[0.3em]">{sendState.devCode}</span>
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
            <input
              id="reg-password"
              name="password"
              type="password"
              autoComplete="new-password"
              className={cx(inputCls, "h-12")}
              aria-invalid={!!fe.password}
            />
            {fe.password ? <p className="mt-1.5 text-xs text-rose-600">{fe.password}</p> : <p className="mt-1.5 text-xs text-ink-400">Kamida {MIN_PASSWORD_LENGTH} ta belgi</p>}
          </div>
          <div>
            <label htmlFor="reg-confirm" className={labelCls}>
              Parolni takrorlang
            </label>
            <input id="reg-confirm" name="confirm" type="password" autoComplete="new-password" className={cx(inputCls, "h-12")} aria-invalid={!!fe.confirm} />
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
          {verifying ? "Tekshirilmoqda…" : purpose === "reset" ? "Parolni saqlash va kirish" : "Ro‘yxatdan o‘tish va kirish"}
          {verifying ? null : <ArrowRight className="size-[18px]" aria-hidden />}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4 text-[13px]">
        <span className="num text-ink-500">{formatUzPhone(phone)}</span>
        <span className="flex items-center gap-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(() => sendAction(fd));
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
          <button type="button" onClick={() => setRestart(1)} className="rounded-lg px-2 py-1 font-medium text-ink-500 transition hover:bg-slate-100 hover:text-ink-800">
            Raqamni o‘zgartirish
          </button>
        </span>
      </div>
    </div>
  );
}
