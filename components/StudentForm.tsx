"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { saveStudent } from "@/app/actions/students";
import type { FormState } from "@/app/actions/types";
import type { StudentDetail } from "@/lib/data";
import { dateToISO } from "@/lib/time";
import { btn, cx, inputCls, labelCls } from "./ui";

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
}: {
  student?: StudentDetail;
  groups: string[];
  today: string;
}) {
  const action = saveStudent.bind(null, student?.id ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate>
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
          <input id="group" name="group" list="group-list" defaultValue={student?.group} className={inputCls} placeholder="Masalan: Web dasturlash" />
          <datalist id="group-list">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="monthlyFee" className={labelCls}>
            Oylik to‘lov (so‘m) <span className="text-brand-600">*</span>
          </label>
          <input id="monthlyFee" name="monthlyFee" inputMode="numeric" required defaultValue={student ? String(student.monthlyFee) : ""} className={cx(inputCls, "num")} placeholder="300000" aria-invalid={!!fe.monthlyFee} />
          <FieldError msg={fe.monthlyFee} />
        </div>
        <div>
          <label htmlFor="startDate" className={labelCls}>
            O‘qishni boshlagan sana <span className="text-brand-600">*</span>
          </label>
          <input id="startDate" name="startDate" type="date" required defaultValue={student ? dateToISO(new Date(student.startDate)) : today} className={inputCls} aria-invalid={!!fe.startDate} />
          <FieldError msg={fe.startDate} />
        </div>
        <div>
          <label htmlFor="active" className={labelCls}>
            Holati
          </label>
          <select id="active" name="active" defaultValue={student && !student.active ? "false" : "true"} className={inputCls}>
            <option value="true">Faol (o‘qiyapti)</option>
            <option value="false">Nofaol (ketgan / to‘xtatgan)</option>
          </select>
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
