"use client";

// Kirish: 1) telefon raqam; 2) ro'yxatdan o'tgan bo'lsa — parol, birinchi marta bo'lsa — SMS kod va yangi parol.
// «Parolimni unutdim» — parol oynasida SMS kod shu yerda yuboriladi, raqam oynasida — tiklash sahifasiga (raqam bilan).
// O'tish davrida (rahbar yoki administrator profili hali faol bo'lmasa) — eski umumiy parol bilan ham kirish mumkin.
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Lock } from "lucide-react";
import { checkLoginPhone, login, requestCode, type CodeState, type LoginState } from "@/app/actions/auth";
import { PhoneInput } from "@/components/inputs";
import { OtpCodeStep } from "@/components/OtpCodeStep";
import { btn, cx, inputCls, labelCls } from "@/components/ui";
import { formatUzPhone, normalizeUzPhone } from "@/lib/phone";

export function LoginForm({ legacyHint }: { legacyHint: boolean }) {
  const router = useRouter();
  const [flow, flowAction, checking] = useActionState<CodeState, FormData>(checkLoginPhone, { step: "phone" });
  const [loginState, loginAction, signingIn] = useActionState<LoginState, FormData>(login, {});
  // «Parolimni unutdim»: shu raqamga SMS kod (yangi parol qo'yish oynasi shu yerda ochiladi)
  const [reset, resetAction, sendingReset] = useActionState<CodeState, FormData>(requestCode, { step: "phone" });
  // «Raqamni o'zgartirish» bosilgan holat: yangi javob kelguncha raqam bosqichi ko'rsatiladi
  const [backFrom, setBackFrom] = useState<CodeState | null>(null);
  // Bekor qilingan parol tiklash (raqam o'zgartirilganda) — qayta ko'rsatilmaydi
  const [resetClosed, setResetClosed] = useState<CodeState | null>(null);
  const [legacy, setLegacy] = useState(false);
  const step = flow === backFrom ? "phone" : flow.step;
  const submitPhone = (fd: FormData) => startTransition(() => flowAction(fd));
  const sendReset = (fd: FormData) => startTransition(() => resetAction(fd));
  const changePhone = () => {
    setBackFrom(flow);
    setResetClosed(reset);
  };

  if (legacy) {
    return (
      <form action={loginAction} className="grid gap-5">
        <input type="hidden" name="phone" value="" />
        <PasswordField label="Umumiy parol" error={loginState.phone === "" ? loginState.error : undefined} />
        <button type="submit" disabled={signingIn} className={cx(btn.primary, "h-12 w-full")}>
          {signingIn ? "Tekshirilmoqda…" : "Kirish"}
          {signingIn ? null : <ArrowRight className="size-[18px]" aria-hidden />}
        </button>
        <BackLink onClick={() => setLegacy(false)}>Telefon raqam bilan kirish</BackLink>
      </form>
    );
  }

  if (step === "code") {
    return <OtpCodeStep state={flow} sending={checking} onResend={submitPhone} onChangePhone={() => setBackFrom(flow)} />;
  }

  if (step === "password") {
    const phone = flow.phone ?? "";
    const resetOpen = reset !== resetClosed && reset.phone === phone;
    if (resetOpen && reset.step === "code") {
      return <OtpCodeStep state={reset} sending={sendingReset} onResend={sendReset} onChangePhone={changePhone} />;
    }
    return (
      <form action={loginAction} className="grid gap-5">
        <input type="hidden" name="phone" value={phone} />
        {/* Parol menejerlari uchun: qaysi hisob ekanini bilsin */}
        <input type="text" name="username" autoComplete="username" value={formatUzPhone(phone)} readOnly className="sr-only" tabIndex={-1} aria-hidden />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-slate-50/70 px-4 py-3">
          <span className="num text-[15px] font-semibold text-ink-900">{formatUzPhone(phone)}</span>
          <button type="button" onClick={changePhone} className="text-[13px] font-medium text-brand-600 hover:text-brand-800">
            O‘zgartirish
          </button>
        </div>
        <PasswordField label="Parol" autoFocus error={loginState.phone === phone ? loginState.error : undefined} />
        <button type="submit" disabled={signingIn} className={cx(btn.primary, "h-12 w-full")}>
          {signingIn ? "Tekshirilmoqda…" : "Kirish"}
          {signingIn ? null : <ArrowRight className="size-[18px]" aria-hidden />}
        </button>
        <div className="-mt-1 grid gap-2 border-t border-line-soft pt-4">
          <button
            type="button"
            disabled={sendingReset}
            onClick={() => {
              const fd = new FormData();
              fd.set("phone", phone);
              sendReset(fd);
            }}
            className={cx(btn.outline, "h-12 w-full")}
          >
            <KeyRound className="size-[18px]" aria-hidden />
            {sendingReset ? "SMS kod yuborilmoqda…" : "Parolimni unutdim"}
          </button>
          {resetOpen && reset.error ? (
            <p className="text-center text-sm text-rose-600" role="alert">
              {reset.error}
            </p>
          ) : (
            <p className="text-center text-xs leading-relaxed text-ink-400">Raqamingizga SMS kod keladi — kodni kiritib, yangi parol qo‘yasiz.</p>
          )}
        </div>
      </form>
    );
  }

  // 1-qadam: telefon raqam
  const error = flow !== backFrom ? flow.error : undefined;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitPhone(new FormData(e.currentTarget));
      }}
      className="grid gap-5"
      noValidate
    >
      <div>
        <label htmlFor="phone" className={labelCls}>
          Telefon raqam
        </label>
        <PhoneInput
          id="phone"
          name="phone"
          icon
          size="lg"
          autoComplete="username"
          defaultValue={flow.phone ?? ""}
          autoFocus
          placeholder="90 123 45 67"
          invalid={!!error}
        />
        {error ? (
          <p className="mt-1.5 text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-400">Birinchi marta kirsangiz, raqamingizga SMS kod keladi va o‘zingiz parol qo‘yasiz.</p>
        )}
      </div>
      <button type="submit" disabled={checking} className={cx(btn.primary, "h-12 w-full")}>
        {checking ? "Tekshirilmoqda…" : "Davom etish"}
        {checking ? null : <ArrowRight className="size-[18px]" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          // Yozilgan raqam tiklash sahifasiga o'tadi (qayta yozish shart emas)
          const typed = new FormData(e.currentTarget.form ?? undefined).get("phone");
          const phone = normalizeUzPhone(typeof typed === "string" ? typed : "");
          router.push(`/register?${new URLSearchParams({ reset: "1", ...(phone ? { phone } : {}) })}`);
        }}
        className="mx-auto -mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-800"
      >
        <KeyRound className="size-3.5" aria-hidden />
        Parolimni unutdim
      </button>
      {legacyHint ? (
        <p className="-mt-1 text-center text-xs leading-relaxed text-ink-400">
          Xodim profillari hali to‘liq sozlanmagan.{" "}
          <button type="button" onClick={() => setLegacy(true)} className="font-medium text-brand-600 hover:text-brand-800">
            Eski umumiy parol bilan kirish
          </button>
        </p>
      ) : null}
    </form>
  );
}

function PasswordField({ label, error, autoFocus }: { label: string; error?: string; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor="password" className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" strokeWidth={1.8} aria-hidden />
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus={autoFocus}
          required
          className={cx(inputCls, "h-12 pl-11")}
          aria-invalid={!!error}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mx-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-800">
      <ArrowLeft className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}
