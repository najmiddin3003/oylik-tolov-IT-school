"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { Check, Eye, EyeOff, HandCoins, KeyRound, MessageSquareText, Percent, Send, ShieldCheck, Tags, Wallet } from "lucide-react";
import {
  addSalary,
  applyFeeChange,
  applyPercentChange,
  changeOwnerPassword,
  saveCenterName,
  saveSmsSettings,
  sendTestSmsAction,
  setAdminPassword,
} from "@/app/actions/settings";
import type { FormState } from "@/app/actions/types";
import { renderSmsText } from "@/lib/reminders";
import { formatNumber, MONTH_NAMES, monthLabel } from "@/lib/time";
import { DatePicker, MonthPicker, Select } from "./pickers";
import { btn, cx, inputCls, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs text-rose-600">{msg}</p> : null;
}

function Result({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800" role="status">
        ✓ {state.message}
      </p>
    );
  }
  return null;
}

function Submit({ pending, children, pendingText = "Saqlanmoqda…", className }: { pending: boolean; children: ReactNode; pendingText?: string; className?: string }) {
  return (
    <button type="submit" disabled={pending} className={cx(btn.primary, className)}>
      {pending ? pendingText : children}
    </button>
  );
}

const moneyInput = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
  setter(digits ? formatNumber(Number(digits)) : "");
};

// ---------- Oylik va avans ----------

export function SalaryForm({ month, today }: { month: string; today: string }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(addSalary, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <SalaryFields key={state.nonce ?? 0} month={month} today={today} fe={state.fieldErrors ?? {}} />
      <Result state={state} />
      <div>
        <Submit pending={pending}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          Qo‘shish va ayirish
        </Submit>
      </div>
    </form>
  );
}

function SalaryFields({ month, today, fe }: { month: string; today: string; fe: Record<string, string> }) {
  const [kind, setKind] = useState<"oylik" | "avans">("oylik");
  const [amount, setAmount] = useState("");
  return (
    <>
      <fieldset>
        <legend className={labelCls}>Turi</legend>
        <div className="grid max-w-sm grid-cols-2 gap-2">
          {(["oylik", "avans"] as const).map((k) => (
            <label
              key={k}
              className={cx(
                "group flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/15",
                kind === k ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line text-ink-500 hover:bg-slate-50",
              )}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === "oylik" ? <Wallet className="icon-wiggle size-4" aria-hidden /> : <HandCoins className="icon-wiggle size-4" aria-hidden />}
              {k === "oylik" ? "Oylik" : "Avans"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="sal-amount" className={labelCls}>
            Summa (so‘m)
          </label>
          <input id="sal-amount" name="amount" inputMode="numeric" value={amount} onChange={moneyInput(setAmount)} className={cx(inputCls, "num")} placeholder="300 000" aria-invalid={!!fe.amount} />
          <FieldError msg={fe.amount} />
        </div>
        <div>
          <span className={labelCls}>Olingan sana</span>
          <DatePicker name="date" defaultValue={today} max={today} invalid={!!fe.date} aria-label="Olingan sana" />
          <FieldError msg={fe.date} />
        </div>
        <div>
          <span className={labelCls}>Qaysi oy uchun</span>
          <MonthPicker name="month" defaultValue={month} invalid={!!fe.month} aria-label="Qaysi oy uchun" />
          <FieldError msg={fe.month} />
        </div>
      </div>
      <div>
        <label htmlFor="sal-note" className={labelCls}>
          Izoh <span className="font-normal text-ink-400">(ixtiyoriy)</span>
        </label>
        <input id="sal-note" name="note" maxLength={300} className={inputCls} placeholder="Masalan: oktabr oyi uchun birinchi qism" />
      </div>
    </>
  );
}

// ---------- Oylik to'lov narxi ----------

export function FeeForm({ month, groups }: { month: string; groups: { fee: number; count: number }[] }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(applyFeeChange, {});
  const [fee, setFee] = useState("");
  const [from, setFrom] = useState(month);
  const [scope, setScope] = useState("all");
  const fe = state.fieldErrors ?? {};
  const scopeOptions = [
    { value: "all", label: "Barcha o‘quvchilarga" },
    ...groups.map((g) => ({ value: `fee:${g.fee}`, label: `Faqat hozir ${formatNumber(g.fee)} to‘layotganlarga`, hint: `${g.count} ta` })),
  ];

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        const target = scope === "all" ? "barcha o‘quvchilarga" : `hozir ${formatNumber(Number(scope.slice(4)))} so‘m to‘layotganlarga`;
        if (fee && !window.confirm(`${monthLabel(from)} oyidan boshlab ${target} oylik narx ${fee} so‘m qilinsinmi? O‘tgan oylar hisobi o‘zgarmaydi.`)) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fee-new" className={labelCls}>
            Yangi narx (so‘m)
          </label>
          <input id="fee-new" name="fee" inputMode="numeric" value={fee} onChange={moneyInput(setFee)} className={cx(inputCls, "num")} placeholder="350 000" aria-invalid={!!fe.fee} />
          <FieldError msg={fe.fee} />
        </div>
        <div>
          <span className={labelCls}>Qaysi oydan boshlab</span>
          <MonthPicker name="from" value={from} onChange={setFrom} invalid={!!fe.from} aria-label="Qaysi oydan boshlab" />
          <FieldError msg={fe.from} />
        </div>
        <div>
          <span className={labelCls}>Kimlarga</span>
          <Select name="scope" value={scope} onChange={setScope} options={scopeOptions} aria-label="Kimlarga qo‘llanadi" invalid={!!fe.scope} />
          <FieldError msg={fe.scope} />
        </div>
      </div>
      <Result state={state} />
      <div>
        <Submit pending={pending} pendingText="Qo‘llanmoqda…">
          <Tags className="size-[18px]" aria-hidden />
          Narxni qo‘llash
        </Submit>
      </div>
    </form>
  );
}

// ---------- Ulush foizi ----------

export function PercentForm({ month, current }: { month: string; current: number }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(applyPercentChange, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pct" className={labelCls}>
            Foiz
          </label>
          <div className="relative">
            <input id="pct" name="percent" inputMode="decimal" defaultValue={String(current)} className={cx(inputCls, "num pr-10")} aria-invalid={!!fe.percent} />
            <Percent className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          </div>
          <FieldError msg={fe.percent} />
        </div>
        <div>
          <span className={labelCls}>Qaysi oydan boshlab</span>
          <MonthPicker name="from" defaultValue={month} invalid={!!fe.from} aria-label="Qaysi oydan boshlab" />
          <FieldError msg={fe.from} />
        </div>
      </div>
      <Result state={state} />
      <div>
        <Submit pending={pending}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          Saqlash
        </Submit>
      </div>
    </form>
  );
}

// ---------- Parollar ----------

function PasswordInput({ id, name, label, error, autoComplete }: { id: string; name: string; label: string; error?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} className={cx(inputCls, "pr-11")} aria-invalid={!!error} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 hover:bg-slate-100 hover:text-ink-700"
          aria-label={show ? "Parolni yashirish" : "Parolni ko‘rsatish"}
        >
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      <FieldError msg={error} />
    </div>
  );
}

export function OwnerPasswordForm() {
  const [state, onSubmit, pending] = useActionForm<FormState>(changeOwnerPassword, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate key={state.nonce ?? 0}>
      <PasswordInput id="pw-current" name="current" label="Joriy parol" error={fe.current} autoComplete="current-password" />
      <PasswordInput id="pw-next" name="next" label="Yangi parol" error={fe.next} autoComplete="new-password" />
      <PasswordInput id="pw-confirm" name="confirm" label="Yangi parolni takrorlang" error={fe.confirm} autoComplete="new-password" />
      <Result state={state} />
      <div>
        <Submit pending={pending}>
          <KeyRound className="size-[18px]" aria-hidden />
          Parolni almashtirish
        </Submit>
      </div>
    </form>
  );
}

export function AdminPasswordForm({ enabled }: { enabled: boolean }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(setAdminPassword, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate key={state.nonce ?? 0}>
      <PasswordInput id="adm-next" name="next" label={enabled ? "Yangi parol" : "Parol"} error={fe.next} autoComplete="new-password" />
      <PasswordInput id="adm-confirm" name="confirm" label="Parolni takrorlang" error={fe.confirm} autoComplete="new-password" />
      <Result state={state} />
      <div>
        <Submit pending={pending}>
          <ShieldCheck className="size-[18px]" aria-hidden />
          {enabled ? "Parolni almashtirish" : "Parolni o‘rnatish"}
        </Submit>
      </div>
    </form>
  );
}

// ---------- SMS ----------

const monthName = (m: string) => MONTH_NAMES[Number(m.slice(5, 7)) - 1] ?? m;

export function SmsForm({
  sms,
  month,
}: {
  sms: { enabled: boolean; phone: string; sender: string; template: string };
  month: string;
}) {
  const [state, onSubmit, pending] = useActionForm<FormState>(saveSmsSettings, {});
  const [enabled, setEnabled] = useState(sms.enabled);
  const [template, setTemplate] = useState(sms.template);
  const fe = state.fieldErrors ?? {};
  const preview = renderSmsText(template, [month], 10, monthName);
  const length = preview.length;

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <label className="flex cursor-pointer items-start gap-3.5 rounded-2xl border border-line p-4 transition hover:bg-slate-50/60">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="peer sr-only" />
        <span
          className={cx(
            "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/20",
            enabled ? "bg-emerald-500" : "bg-ink-300",
          )}
          aria-hidden
        >
          <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", enabled ? "left-[22px]" : "left-0.5")} />
        </span>
        <span>
          <span className="block text-[15px] font-semibold text-ink-900">Kunlik SMS eslatma {enabled ? "yoqilgan" : "o‘chirilgan"}</span>
          <span className="mt-0.5 block text-sm leading-relaxed text-ink-500">
            Har oyning 25-sanasidan boshlab, har kuni kechqurun (20:00) to‘lov qilmaganlar soni SMS qilib yuboriladi. Hamma to‘laganda SMS to‘xtaydi.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sms-phone" className={labelCls}>
            Qaysi raqamga
          </label>
          <div className="relative">
            <span className="num pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-400">+998</span>
            <input
              id="sms-phone"
              name="phone"
              inputMode="tel"
              defaultValue={sms.phone.replace(/^998/, "").replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4")}
              className={cx(inputCls, "num pl-14")}
              placeholder="33 626 30 06"
              aria-invalid={!!fe.phone}
            />
          </div>
          <FieldError msg={fe.phone} />
        </div>
        <div>
          <label htmlFor="sms-sender" className={labelCls}>
            Jo‘natuvchi nomi <span className="font-normal text-ink-400">(Eskiz)</span>
          </label>
          <input id="sms-sender" name="sender" defaultValue={sms.sender} className={cx(inputCls, "num")} aria-invalid={!!fe.sender} />
          <FieldError msg={fe.sender} />
        </div>
      </div>

      <div>
        <label htmlFor="sms-template" className={labelCls}>
          SMS matni
        </label>
        <textarea
          id="sms-template"
          name="template"
          rows={3}
          maxLength={400}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className={cx(inputCls, "h-auto py-2.5")}
          aria-invalid={!!fe.template}
        />
        <FieldError msg={fe.template} />
        <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
          <code className="rounded bg-slate-100 px-1 text-ink-600">{"{#oy#}"}</code> — oy nomi,{" "}
          <code className="rounded bg-slate-100 px-1 text-ink-600">{"{#soni#}"}</code> — to‘lov qilmaganlar soni. Matn Eskiz kabinetida tasdiqlangan
          shablon bilan <b className="font-semibold text-ink-600">harfma-harf bir xil</b> bo‘lishi kerak (nuqta va apostroflargacha) — aks holda Eskiz SMS’ni
          yubormaydi. Lotin harflari va oddiy apostrof (&apos;) ishlating.
        </p>
        <div className="mt-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
            <MessageSquareText className="size-3.5" aria-hidden />
            Namuna
          </p>
          <p className="mt-1.5 text-sm text-ink-800">{preview}</p>
          <p className={cx("num mt-1 text-xs", length > 160 ? "text-amber-700" : "text-ink-400")}>
            {length} belgi{length > 160 ? " — 2 ta SMS bo‘lib ketadi" : ""}
          </p>
        </div>
      </div>

      <Result state={state} />
      <div>
        <Submit pending={pending}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          Saqlash
        </Submit>
      </div>
    </form>
  );
}

export function TestSmsButton({ disabled }: { disabled: boolean }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(sendTestSmsAction, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div>
        <button type="submit" disabled={pending || disabled} className={btn.outline}>
          <Send className="size-4 text-brand-600" aria-hidden />
          {pending ? "Yuborilmoqda…" : "Sinov SMS yuborish"}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

// ---------- Umumiy ----------

export function CenterNameForm({ value }: { value: string }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(saveCenterName, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="max-w-md">
        <label htmlFor="center" className={labelCls}>
          Markaz nomi <span className="font-normal text-ink-400">(yon menyuda ko‘rinadi)</span>
        </label>
        <input id="center" name="centerName" defaultValue={value} maxLength={60} className={inputCls} aria-invalid={!!fe.centerName} />
        <FieldError msg={fe.centerName} />
      </div>
      <Result state={state} />
      <div>
        <Submit pending={pending}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          Saqlash
        </Submit>
      </div>
    </form>
  );
}
