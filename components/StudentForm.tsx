"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveStudent } from "@/app/actions/students";
import type { FormState } from "@/app/actions/types";
import type { StudentDetail } from "@/lib/data";
import { dateToISO } from "@/lib/time";
import { btn, inputCls, labelCls } from "./ui";

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-rose-600">{msg}</p> : null;
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
    <form action={formAction} className="grid gap-5 sm:grid-cols-2" noValidate>
      {state.error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <label htmlFor="fullName" className={labelCls}>
          Ism-familiya *
        </label>
        <input id="fullName" name="fullName" required defaultValue={student?.fullName} className={inputCls} placeholder="Masalan: Aliyev Vali" aria-invalid={!!fe.fullName} autoFocus={!student} />
        <FieldError msg={fe.fullName} />
      </div>

      <div>
        <label htmlFor="phone" className={labelCls}>
          Telefon
        </label>
        <input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={student?.phone} className={inputCls} placeholder="+998 90 123 45 67" aria-invalid={!!fe.phone} />
        <FieldError msg={fe.phone} />
      </div>

      <div>
        <label htmlFor="parentPhone" className={labelCls}>
          Ota-ona telefoni
        </label>
        <input id="parentPhone" name="parentPhone" type="tel" inputMode="tel" defaultValue={student?.parentPhone} className={inputCls} placeholder="+998 ..." aria-invalid={!!fe.parentPhone} />
        <FieldError msg={fe.parentPhone} />
      </div>

      <div>
        <label htmlFor="group" className={labelCls}>
          Guruh / kurs
        </label>
        <input id="group" name="group" list="group-list" defaultValue={student?.group} className={inputCls} placeholder="Masalan: Ingliz tili A1" />
        <datalist id="group-list">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="monthlyFee" className={labelCls}>
          Oylik to&apos;lov (so&apos;m) *
        </label>
        <input id="monthlyFee" name="monthlyFee" inputMode="numeric" required defaultValue={student ? String(student.monthlyFee) : ""} className={`${inputCls} num`} placeholder="500000" aria-invalid={!!fe.monthlyFee} />
        <FieldError msg={fe.monthlyFee} />
      </div>

      <div>
        <label htmlFor="startDate" className={labelCls}>
          O&apos;qishni boshlagan sana *
        </label>
        <input id="startDate" name="startDate" type="date" required defaultValue={student ? dateToISO(new Date(student.startDate)) : today} className={inputCls} aria-invalid={!!fe.startDate} />
        <FieldError msg={fe.startDate} />
      </div>

      <div>
        <label htmlFor="active" className={labelCls}>
          Holati
        </label>
        <select id="active" name="active" defaultValue={student && !student.active ? "false" : "true"} className={inputCls}>
          <option value="true">Faol (o&apos;qiyapti)</option>
          <option value="false">Nofaol (ketgan / to&apos;xtatgan)</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="note" className={labelCls}>
          Izoh
        </label>
        <textarea id="note" name="note" rows={3} defaultValue={student?.note} className={inputCls} placeholder="Chegirma, kelishuv va h.k." />
      </div>

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saqlanmoqda…" : student ? "O'zgarishlarni saqlash" : "O'quvchini qo'shish"}
        </button>
        <Link href={student ? `/students/${student.id}` : "/students"} className={btn.secondary}>
          Bekor qilish
        </Link>
      </div>
    </form>
  );
}
