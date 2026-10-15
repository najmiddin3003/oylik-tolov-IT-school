"use client";

// Ro'yxatdan o'tish / parolni tiklash: 1) telefon -> SMS kod, 2) kod + yangi parol.
import { startTransition, useActionState, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { requestCode, type CodeState } from "@/app/actions/auth";
import { PhoneInput } from "@/components/inputs";
import { OtpCodeStep } from "@/components/OtpCodeStep";
import { btn, cx, labelCls } from "@/components/ui";

export function RegisterForm() {
  const [sendState, sendAction, sending] = useActionState<CodeState, FormData>(requestCode, { step: "phone" });
  // «Raqamni o'zgartirish» bosilgan holat: yangi javob kelguncha raqam bosqichi ko'rsatiladi
  const [backFrom, setBackFrom] = useState<CodeState | null>(null);
  const codeStep = sendState.step === "code" && sendState !== backFrom;
  const error = sendState !== backFrom ? sendState.error : undefined;

  if (codeStep) {
    return (
      <OtpCodeStep
        state={sendState}
        sending={sending}
        onResend={(fd) => startTransition(() => sendAction(fd))}
        onChangePhone={() => setBackFrom(sendState)}
      />
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
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
          invalid={!!error}
        />
        {error ? (
          <p className="mt-1.5 text-sm text-rose-600" role="alert">
            {error}
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
