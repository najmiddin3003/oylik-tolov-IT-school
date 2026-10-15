"use client";

// Xodimlar formalari (rahbar): yangi xodim, ma'lumotlarni tahrirlash, eski ulush yozuvlarini o'tkazish.
import { useState } from "react";
import { ArrowRightLeft, Check, Percent, UserPlus } from "lucide-react";
import { addStaff, assignLegacyPay } from "@/app/actions/staff";
import type { FormState } from "@/app/actions/types";
import type { Role } from "@/lib/session";
import { defaultPercent, ROLE_HINT, ROLE_LABEL } from "@/lib/staff-rules";
import { PhoneInput } from "./inputs";
import { Select } from "./pickers";
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
      <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm leading-relaxed text-emerald-800" role="status">
        ✓ {state.message}
      </p>
    );
  }
  return null;
}

const ROLE_OPTIONS = (["teacher", "admin", "owner"] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r], hint: r === "owner" ? "hamma bo‘limlar" : undefined }));

/** Yangi xodim: ism, telefon, lavozim, oylik foizi. */
export function StaffAddForm() {
  const [state, onSubmit, pending] = useActionForm<FormState>(addStaff, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <StaffAddFields key={state.nonce ?? 0} fe={state.fieldErrors ?? {}} />
      <Result state={state} />
      <div>
        <button type="submit" disabled={pending} className={btn.primary}>
          <UserPlus className="size-[18px]" aria-hidden />
          {pending ? "Qo‘shilmoqda…" : "Xodimni qo‘shish"}
        </button>
      </div>
    </form>
  );
}

function StaffAddFields({ fe }: { fe: Record<string, string> }) {
  const [role, setRole] = useState<Role>("teacher");
  const [percent, setPercent] = useState(String(defaultPercent("teacher")));
  return (
    <>
      <div>
        <label htmlFor="st-name" className={labelCls}>
          Ism-familiya
        </label>
        <input id="st-name" name="name" maxLength={80} className={inputCls} placeholder="Masalan: Najmiddin Karimov" aria-invalid={!!fe.name} />
        <FieldError msg={fe.name} />
      </div>
      <div>
        <label htmlFor="st-phone" className={labelCls}>
          Telefon raqami <span className="font-normal text-ink-400">(SMS kod shu raqamga keladi)</span>
        </label>
        <PhoneInput id="st-phone" name="phone" icon placeholder="90 123 45 67" invalid={!!fe.phone} />
        <FieldError msg={fe.phone} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Lavozimi</span>
          <Select
            name="role"
            value={role}
            onChange={(v) => {
              setRole(v as Role);
              setPercent(String(defaultPercent(v as Role)));
            }}
            options={ROLE_OPTIONS}
            searchable={false}
            invalid={!!fe.role}
            aria-label="Lavozimi"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{ROLE_HINT[role]}</p>
        </div>
        <div>
          <label htmlFor="st-percent" className={labelCls}>
            Oylik foizi
          </label>
          <div className="relative">
            <input
              id="st-percent"
              name="percent"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
              className={cx(inputCls, "num pr-10")}
              aria-invalid={!!fe.percent}
            />
            <Percent className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
            {role === "teacher" ? "O‘z o‘quvchilari to‘lovlaridan" : role === "admin" ? "Butun markaz tushumidan (0 — hisoblanmaydi)" : "Odatda 0"}
          </p>
          <FieldError msg={fe.percent} />
        </div>
      </div>
    </>
  );
}

/** Ism, lavozim va oylik asosini tahrirlash (`action` — xodimga bog'langan server action). */
export function StaffEditForm({
  action,
  name,
  role,
  shareBase,
  self,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  name: string;
  role: Role;
  shareBase: "students" | "center";
  /** Rahbar o'zini tahrirlayapti — lavozimni o'zgartirib bo'lmaydi */
  self: boolean;
}) {
  const [state, onSubmit, pending] = useActionForm<FormState>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div>
        <label htmlFor="se-name" className={labelCls}>
          Ism-familiya
        </label>
        <input id="se-name" name="name" defaultValue={name} maxLength={80} className={inputCls} aria-invalid={!!fe.name} />
        <FieldError msg={fe.name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Lavozimi</span>
          {self ? (
            <>
              <input type="hidden" name="role" value={role} />
              <p className="flex h-11 items-center rounded-xl border border-line bg-slate-50 px-3.5 text-[15px] text-ink-600">{ROLE_LABEL[role]} (o‘zingiz)</p>
            </>
          ) : (
            <Select name="role" defaultValue={role} options={ROLE_OPTIONS} searchable={false} aria-label="Lavozimi" invalid={!!fe.role} />
          )}
        </div>
        <div>
          <span className={labelCls}>Oylik foizi nimadan</span>
          <Select
            name="shareBase"
            defaultValue={shareBase}
            searchable={false}
            aria-label="Oylik foizi nimadan"
            options={[
              { value: "students", label: "O‘z o‘quvchilari to‘lovlaridan" },
              { value: "center", label: "Butun markaz tushumidan" },
            ]}
          />
        </div>
      </div>
      <Result state={state} />
      <div>
        <button type="submit" disabled={pending} className={btn.primary}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </form>
  );
}

/** Eski (bitta o'qituvchi uchun yuritilgan) ulush va oylik/avans yozuvlarini xodimga o'tkazish. */
export function LegacyPayForm({ staff }: { staff: { id: string; name: string; role: Role }[] }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(assignLegacyPay, {});
  const teachers = staff.filter((s) => s.role === "teacher");
  const options = (teachers.length ? teachers : staff).map((s) => ({ value: s.id, label: s.name, hint: ROLE_LABEL[s.role] }));
  const fe = state.fieldErrors ?? {};
  if (!options.length) return <p className="text-sm text-amber-900/80">Avval o‘qituvchini qo‘shing — keyin bu yozuvlarni unga o‘tkazasiz.</p>;
  return (
    <form
      onSubmit={(e) => {
        if (!window.confirm("Eski ulush foizi va barcha biriktirilmagan oylik/avans yozuvlari tanlangan xodimga o‘tkazilsinmi?")) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
      className="flex flex-wrap items-start gap-3"
      noValidate
    >
      <div className="w-full sm:w-72">
        <Select name="staffId" defaultValue={options[0].value} options={options} searchable={false} aria-label="Qaysi xodimga" invalid={!!fe.staffId} />
        <FieldError msg={fe.staffId} />
      </div>
      <button type="submit" disabled={pending} className={cx(btn.primary, "w-full sm:w-auto")}>
        <ArrowRightLeft className="size-[18px]" aria-hidden />
        {pending ? "O‘tkazilmoqda…" : "Shu xodimga o‘tkazish"}
      </button>
      <div className="w-full">
        <Result state={state} />
      </div>
    </form>
  );
}
