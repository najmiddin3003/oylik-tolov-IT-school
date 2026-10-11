"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, Info } from "lucide-react";
import { saveStudent } from "@/app/actions/students";
import type { FormState } from "@/app/actions/types";
import type { StudentDetail } from "@/lib/data";
import { feeFor, type FeeChange } from "@/lib/fees";
import { dateToISO, formatNumber } from "@/lib/time";
import { DatePicker, MonthPicker, Select, SuggestInput } from "./pickers";
import { btn, cx, inputCls, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs text-rose-600">{msg}</p> : null;
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid gap-5 border-b border-line-soft px-6 py-6 last:border-b-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">{hint}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function StudentForm({
  student,
  groups,
  today,
  month,
  standard,
}: {
  student?: StudentDetail;
  groups: string[];
  today: string;
  /** Joriy oy — narx o'zgarsa, standart holatda shu oydan boshlab qo'llanadi */
  month: string;
  /** Markazning standart narxi (yangi o'quvchi uchun): asosiy narx va "falon oydan" o'zgarishlar */
  standard?: { base: number; schedule: FeeChange[] } | null;
}) {
  const action = saveStudent.bind(null, student?.id ?? null);
  const [state, onSubmit, pending] = useActionForm<FormState>(action, {});
  const fe = state.fieldErrors ?? {};
  const [feeFrom, setFeeFrom] = useState(month);
  const feeAtFrom = student ? feeFor(student, feeFrom) : null;
  const standardAt = (iso: string) => (standard ? feeFor({ monthlyFee: standard.base, feeHistory: standard.schedule }, iso.slice(0, 7)) : null);
  const initialFee = student ? student.currentFee : standardAt(today);
  const [fee, setFee] = useState(initialFee !== null ? formatNumber(initialFee) : "");
  const [feeTouched, setFeeTouched] = useState(false);
  const feeChanged = student !== undefined && feeAtFrom !== null && Number(fee.replace(/\D/g, "")) !== feeAtFrom;

  return (
    <form onSubmit={onSubmit} noValidate>
      {state.error ? (
        <p className="mx-6 mt-6 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <Section title="Shaxsiy ma’lumotlar" hint="Ism-familiya Google Sheets’dagi bilan bir xil yozilsa, solishtirish aniq bo‘ladi.">
        <div className="sm:col-span-2">
          <label htmlFor="fullName" className={labelCls}>
            Ism-familiya <span className="text-brand-600">*</span>
          </label>
          <input id="fullName" name="fullName" required defaultValue={student?.fullName} className={inputCls} placeholder="Masalan: Aliyev Vali" aria-invalid={!!fe.fullName} autoFocus={!student} />
          <FieldError msg={fe.fullName} />
        </div>
        <div>
          <label htmlFor="phone" className={labelCls}>
            Telefon
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={student?.phone} className={cx(inputCls, "num")} placeholder="+998 90 123 45 67" aria-invalid={!!fe.phone} />
          <FieldError msg={fe.phone} />
        </div>
        <div>
          <label htmlFor="parentPhone" className={labelCls}>
            Ota-ona telefoni
          </label>
          <input id="parentPhone" name="parentPhone" type="tel" inputMode="tel" defaultValue={student?.parentPhone} className={cx(inputCls, "num")} placeholder="+998 ..." aria-invalid={!!fe.parentPhone} />
          <FieldError msg={fe.parentPhone} />
        </div>
      </Section>

      <Section title="O‘qish va to‘lov" hint="Oylik to‘lov qarzni hisoblash uchun, boshlagan sana — qaysi oydan to‘lov kutilishini bilish uchun kerak.">
        <div>
          <label htmlFor="group" className={labelCls}>
            Guruh / kurs
          </label>
          <SuggestInput id="group" name="group" defaultValue={student?.group} suggestions={groups} className={inputCls} placeholder="Masalan: Web dasturlash" />
        </div>
        <div>
          <label htmlFor="monthlyFee" className={labelCls}>
            Oylik to‘lov (so‘m) <span className="text-brand-600">*</span>
          </label>
          <input
            id="monthlyFee"
            name="monthlyFee"
            inputMode="numeric"
            required
            value={fee}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              setFee(digits ? formatNumber(Number(digits)) : "");
              setFeeTouched(true);
            }}
            className={cx(inputCls, "num")}
            placeholder="300 000"
            aria-invalid={!!fe.monthlyFee}
          />
          <FieldError msg={fe.monthlyFee} />
        </div>
        {student ? (
          <div className="sm:col-span-2">
            <span className={labelCls}>Yangi narx qaysi oydan boshlab</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <MonthPicker name="feeFrom" value={feeFrom} onChange={setFeeFrom} aria-label="Qaysi oydan boshlab" />
              <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500 sm:pt-1">
                <Info className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden />
                {feeChanged
                  ? `${formatNumber(feeAtFrom!)} → ${fee || "0"} so‘m. Undan oldingi oylar hisobi o‘zgarmaydi.`
                  : "Narxni o‘zgartirsangiz, tanlangan oydan boshlab qo‘llanadi. O‘tgan oylar hisobi o‘zgarmaydi."}
              </p>
            </div>
          </div>
        ) : null}
        <div>
          <span className={labelCls}>
            O‘qishni boshlagan sana <span className="text-brand-600">*</span>
          </span>
          <DatePicker
            name="startDate"
            defaultValue={student ? dateToISO(new Date(student.startDate)) : today}
            onChange={(iso) => {
              // Yangi o'quvchi: narx qo'lda o'zgartirilmagan bo'lsa — boshlagan oydagi standart narx
              const std = !student && !feeTouched && iso ? standardAt(iso) : null;
              if (std !== null) setFee(formatNumber(std));
            }}
            invalid={!!fe.startDate}
            aria-label="O‘qishni boshlagan sana"
          />
          <FieldError msg={fe.startDate} />
        </div>
        <div>
          <span className={labelCls}>Holati</span>
          <Select
            name="active"
            defaultValue={student && !student.active ? "false" : "true"}
            aria-label="Holati"
            options={[
              { value: "true", label: "Faol (o‘qiyapti)", icon: <span className="block size-2 rounded-full bg-emerald-500" /> },
              { value: "false", label: "Nofaol (ketgan / to‘xtatgan)", icon: <span className="block size-2 rounded-full bg-ink-300" /> },
            ]}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="note" className={labelCls}>
            Izoh
          </label>
          <textarea id="note" name="note" rows={3} defaultValue={student?.note} className={cx(inputCls, "h-auto py-2.5")} placeholder="Chegirma, kelishuv va h.k." />
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-5">
        <Link href={student ? `/students/${student.id}` : "/students"} className={btn.outline}>
          Bekor qilish
        </Link>
        <button type="submit" disabled={pending} className={btn.primary}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : student ? "O‘zgarishlarni saqlash" : "O‘quvchini qo‘shish"}
        </button>
      </div>
    </form>
  );
}
