"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { btn, inputCls, labelCls } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label htmlFor="password" className={labelCls}>
          Parol
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className={inputCls}
          aria-invalid={!!state.error}
        />
        {state.error ? (
          <p className="mt-1.5 text-sm text-rose-600" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
        {pending ? "Tekshirilmoqda…" : "Kirish"}
      </button>
    </form>
  );
}
