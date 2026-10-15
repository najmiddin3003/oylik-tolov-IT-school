"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";
import { PhoneInput } from "@/components/inputs";
import { btn, cx, inputCls, labelCls } from "@/components/ui";

export function LoginForm({ legacyHint }: { legacyHint: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={formAction} className="grid gap-5">
      <div>
        <label htmlFor="phone" className={labelCls}>
          Telefon raqam
        </label>
        <PhoneInput id="phone" name="phone" icon size="lg" autoComplete="username" defaultValue={state.phone} autoFocus placeholder="90 123 45 67" />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-sm font-medium text-ink-700">
            Parol
          </label>
          <Link href="/register?reset=1" className="text-[13px] font-medium text-brand-600 hover:text-brand-800">
            Parolni unutdingizmi?
          </Link>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" strokeWidth={1.8} aria-hidden />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={cx(inputCls, "h-12 pl-11")}
            aria-invalid={!!state.error}
          />
        </div>
        {state.error ? (
          <p className="mt-1.5 text-sm text-rose-600" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={pending} className={cx(btn.primary, "h-12 w-full")}>
        {pending ? "Tekshirilmoqda…" : "Kirish"}
        {pending ? null : <ArrowRight className="size-[18px]" aria-hidden />}
      </button>
      {legacyHint ? (
        <p className="-mt-1 text-center text-xs leading-relaxed text-ink-400">
          Xodim profillari hali to‘liq sozlanmagan: telefon raqamsiz, eski umumiy parol bilan ham kirish mumkin.
        </p>
      ) : null}
    </form>
  );
}
