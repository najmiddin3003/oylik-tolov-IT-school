"use client";

import { useActionState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";
import { btn, cx, inputCls, labelCls } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={formAction} className="grid gap-5">
      <div>
        <label htmlFor="password" className={labelCls}>
          Parol
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" strokeWidth={1.8} aria-hidden />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
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
    </form>
  );
}
