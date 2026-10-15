"use client";

import { useState, type ReactNode } from "react";
import { Check, Eye, EyeOff, HandCoins, KeyRound, MessageSquareText, Percent, Plus, Send, ShieldCheck, Tags, Trash2, Wallet } from "lucide-react";
import { applyFeeChange, changeOwnerPassword, saveCenterName, saveCourses, saveSmsSettings, sendTestSmsAction, setAdminPassword } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/types";
import { renderOtpText } from "@/lib/otp-text";
import { renderSmsText, SMS_START_DAY_OPTIONS } from "@/lib/reminders";
import { formatNumber, MONTH_NAMES, monthLabel } from "@/lib/time";
import { MoneyInput, PhoneInput } from "./inputs";
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

// ---------- Oylik va avans ----------

type FormAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Oylik yoki avans yozish (`action` — xodimga bog'langan server action yoki xodimning o'zi uchun). */
export function SalaryForm({
  month,
  today,
  action,
  narrow = false,
  defaultKind = "oylik",
  submitLabel = "Qo‘shish va ayirish",
}: {
  month: string;
  today: string;
  action: FormAction;
  /** Tor ustunda — maydonlar bittadan */
  narrow?: boolean;
  defaultKind?: "oylik" | "avans";
  submitLabel?: string;
}) {
  const [state, onSubmit, pending] = useActionForm<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <SalaryFields key={state.nonce ?? 0} month={month} today={today} fe={state.fieldErrors ?? {}} narrow={narrow} defaultKind={defaultKind} />
      <Result state={state} />
      <div>
        <Submit pending={pending} className={narrow ? "w-full" : undefined}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {submitLabel}
        </Submit>
      </div>
    </form>
  );
}

function SalaryFields({
  month,
  today,
  fe,
  narrow,
  defaultKind,
}: {
  month: string;
  today: string;
  fe: Record<string, string>;
  narrow: boolean;
  defaultKind: "oylik" | "avans";
}) {
  const [kind, setKind] = useState<"oylik" | "avans">(defaultKind);
  return (
    <>
      <fieldset>
        <legend className={labelCls}>Turi</legend>
        <div className="grid max-w-sm grid-cols-2 gap-2">
          {(["avans", "oylik"] as const).map((k) => (
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
      <div className={cx("grid gap-4", !narrow && "sm:grid-cols-3")}>
        <div>
          <label htmlFor="sal-amount" className={labelCls}>
            Summa
          </label>
          <MoneyInput id="sal-amount" name="amount" placeholder="300 000" invalid={!!fe.amount} />
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

export function FeeForm({
  month,
  groups,
  courses = [],
}: {
  month: string;
  groups: { fee: number; count: number }[];
  /** Kurslar: tanlangan kursdagi o'quvchilarga qo'llash uchun */
  courses?: { name: string; students: number }[];
}) {
  const [state, onSubmit, pending] = useActionForm<FormState>(applyFeeChange, {});
  const [fee, setFee] = useState("");
  const [from, setFrom] = useState(month);
  const [scope, setScope] = useState("all");
  const fe = state.fieldErrors ?? {};
  const scopeOptions = [
    { value: "all", label: "Barcha o‘quvchilarga" },
    ...courses.map((c) => ({ value: `course:${c.name}`, label: `«${c.name}» kursiga`, hint: `${c.students} ta` })),
    ...groups.map((g) => ({ value: `fee:${g.fee}`, label: `Faqat hozir ${formatNumber(g.fee)} to‘layotganlarga`, hint: `${g.count} ta` })),
  ];

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        const target =
          scope === "all"
            ? "barcha o‘quvchilarga"
            : scope.startsWith("course:")
              ? `«${scope.slice(7)}» kursidagi o‘quvchilarga`
              : `hozir ${formatNumber(Number(scope.slice(4)))} so‘m to‘layotganlarga`;
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
          <MoneyInput id="fee-new" name="fee" value={fee} onValueChange={(_, f) => setFee(f)} placeholder="350 000" invalid={!!fe.fee} />
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

/** Oylik foizi "falon oydan boshlab" (`action` — xodimga bog'langan server action). */
export function PercentForm({ month, current, action }: { month: string; current: number; action: FormAction }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(action, {});
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

/** Parolni almashtirish: standart — rahbarning eski umumiy paroli; xodim profili uchun `action` beriladi. */
export function OwnerPasswordForm({ action = changeOwnerPassword }: { action?: FormAction }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(action, {});
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
  sms: { enabled: boolean; phone: string; sender: string; template: string; startDay: number; otpTemplate: string };
  month: string;
}) {
  const [state, onSubmit, pending] = useActionForm<FormState>(saveSmsSettings, {});
  const [template, setTemplate] = useState(sms.template);
  const [startDay, setStartDay] = useState(String(sms.startDay));
  const [otpTemplate, setOtpTemplate] = useState(sms.otpTemplate);
  const otpPreview = renderOtpText(otpTemplate, "482913");
  const dayOptions = [...new Set<number>([...SMS_START_DAY_OPTIONS, sms.startDay])]
    .sort((a, b) => a - b)
    .map((d) => ({ value: String(d), label: d === 1 ? "Har kuni (oy boshidan)" : `Har oyning ${d}-sanasidan` }));
  const fe = state.fieldErrors ?? {};
  const preview = renderSmsText(template, [month], 10, monthName);
  const length = preview.length;

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="max-w-sm">
        <span className={labelCls}>Qachondan boshlab</span>
        <Select name="startDay" value={startDay} onChange={setStartDay} options={dayOptions} aria-label="Qachondan boshlab" />
        <p className="mt-1.5 text-xs leading-relaxed text-ink-400">Oldingi oylardan to‘lamaganlar qolgan bo‘lsa — ular ham jami songa qo‘shiladi.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sms-phone" className={labelCls}>
            Qaysi raqamga
          </label>
          <PhoneInput id="sms-phone" name="phone" defaultValue={sms.phone} placeholder="33 626 30 06" invalid={!!fe.phone} />
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

      <div>
        <label htmlFor="sms-otp" className={labelCls}>
          Xodim ro‘yxatdan o‘tish kodi (SMS matni)
        </label>
        <textarea
          id="sms-otp"
          name="otpTemplate"
          rows={2}
          maxLength={300}
          value={otpTemplate}
          onChange={(e) => setOtpTemplate(e.target.value)}
          className={cx(inputCls, "h-auto py-2.5")}
          aria-invalid={!!fe.otpTemplate}
        />
        <FieldError msg={fe.otpTemplate} />
        <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
          <code className="rounded bg-slate-100 px-1 text-ink-600">{"{#kod#}"}</code> — 6 xonali tasdiqlash kodi. Xodim ro‘yxatdan o‘tganda yoki parolini
          tiklaganda yuboriladi. Eskiz kabinetida («Mening matnlarim») quyidagi namunani <b className="font-semibold text-ink-600">harfma-harf</b> shunday
          qo‘shib, tasdiqlatib qo‘ying (kod o‘rnida raqam turgani to‘g‘ri — o‘zgaruvchini moderator belgilaydi). Tasdiqlangan matn boshqacha chiqsa — uni shu
          maydonga o‘zgartirmasdan ko‘chirib qo‘ying. Namuna: <span className="text-ink-600">{otpPreview}</span>
        </p>
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

// ---------- Kurslar ----------

type CourseDraft = { key: number; name: string; fee: string; prev: string; students: number };

/** Kurslar ro'yxati: nomi va standart oylik narxi. Nomi o'zgarsa — o'sha kursdagi o'quvchilar ham yangi nomga o'tadi. */
export function CoursesForm({ courses }: { courses: { name: string; fee: number | null; inList: boolean; students: number }[] }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(saveCourses, {});
  const [rows, setRows] = useState<CourseDraft[]>(() =>
    courses.map((c, i) => ({ key: i, name: c.name, fee: c.fee ? formatNumber(c.fee) : "", prev: c.inList || c.students ? c.name : "", students: c.students })),
  );
  const [nextKey, setNextKey] = useState(courses.length);
  const fe = state.fieldErrors ?? {};
  const update = (key: number, patch: Partial<CourseDraft>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const payload = JSON.stringify(rows.map((r) => ({ name: r.name, fee: r.fee, prev: r.prev })));

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="courses" value={payload} />
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="hidden grid-cols-[minmax(0,1fr)_200px_96px_44px] gap-3 border-b border-line-soft bg-slate-50/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-400 sm:grid">
          <span>Kurs nomi</span>
          <span>Oylik narxi</span>
          <span className="text-right">O‘quvchi</span>
          <span />
        </div>
        <ul className="divide-y divide-line-soft">
          {rows.map((r, i) => (
            <li key={r.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_200px_96px_44px] sm:items-start sm:gap-3">
              <div>
                <input
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  maxLength={80}
                  className={inputCls}
                  placeholder="Masalan: Grafik dizayn"
                  aria-label="Kurs nomi"
                  aria-invalid={!!fe[`name-${i}`]}
                />
                <FieldError msg={fe[`name-${i}`]} />
                {r.prev && r.name.trim() && r.name.trim() !== r.prev && r.students ? (
                  <p className="mt-1.5 text-xs text-amber-700">Saqlansa, {r.students} ta o‘quvchining kursi «{r.name.trim()}» bo‘ladi</p>
                ) : null}
              </div>
              <div>
                <MoneyInput value={r.fee} onValueChange={(_, f) => update(r.key, { fee: f })} placeholder="belgilanmagan" aria-label="Oylik narxi" invalid={!!fe[`fee-${i}`]} />
                <FieldError msg={fe[`fee-${i}`]} />
              </div>
              <p className="num flex h-11 items-center text-sm text-ink-500 sm:justify-end">
                <span className="sm:hidden">O‘quvchilar:&nbsp;</span>
                {r.students}
              </p>
              <button
                type="button"
                onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                disabled={rows.length <= 1 || r.students > 0}
                className={cx(btn.iconDanger, "size-11")}
                title={r.students > 0 ? "O‘quvchisi bor kursni o‘chirib bo‘lmaydi" : "Ro‘yxatdan olib tashlash"}
                aria-label="Kursni olib tashlash"
              >
                <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setRows((list) => [...list, { key: nextKey, name: "", fee: "", prev: "", students: 0 }]);
            setNextKey((k) => k + 1);
          }}
          className={cx(btn.outline, "h-10")}
        >
          <Plus className="size-4" aria-hidden />
          Kurs qo‘shish
        </button>
        <Submit pending={pending} className="h-10">
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          Saqlash
        </Submit>
      </div>
      <Result state={state} />
    </form>
  );
}
