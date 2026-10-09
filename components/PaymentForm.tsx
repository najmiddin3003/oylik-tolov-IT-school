"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { addPayment } from "@/app/actions/payments";
import type { FormState } from "@/app/actions/types";
import { btn, inputCls, labelCls } from "./ui";

type StudentOption = { id: string; label: string; monthlyFee: number };

/**
 * To'lov qo'shish formasi.
 * - `studentId` berilsa — o'quvchi tanlanmaydi (o'quvchi sahifasida).
 * - `students` berilsa — ro'yxatdan tanlanadi (To'lovlar sahifasida).
 */
export function PaymentForm({
  studentId,
  students,
  defaultMonth,
  defaultAmount,
  today,
}: {
  studentId?: string;
  students?: StudentOption[];
  defaultMonth: string;
  defaultAmount?: number;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPayment, {});
  const [selected, setSelected] = useState(studentId ?? "");
  const [amount, setAmount] = useState("");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {studentId ? <input type="hidden" name="studentId" value={studentId} /> : null}

      {students ? (
        <div>
          <label htmlFor="studentId" className={labelCls}>
            O&apos;quvchi
          </label>
          <select
            id="studentId"
            name="studentId"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              const st = students.find((s) => s.id === e.target.value);
              if (st) setAmount(String(st.monthlyFee));
            }}
            className={inputCls}
            aria-invalid={!!fe.studentId}
          >
            <option value="">— tanlang —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {fe.studentId ? <p className="mt-1 text-xs text-rose-600">{fe.studentId}</p> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-month" className={labelCls}>
            Qaysi oy uchun
          </label>
          <input id="pf-month" name="month" type="month" defaultValue={defaultMonth} className={inputCls} aria-invalid={!!fe.month} />
        </div>
        <div>
          <label htmlFor="pf-amount" className={labelCls}>
            Summa (so&apos;m)
          </label>
          <input
            id="pf-amount"
            name="amount"
            inputMode="numeric"
            // O'quvchi ro'yxatdan tanlansa summa avtomatik to'ladi (controlled); aks holda forma
            // saqlangandan keyin React uni yangi standart qiymatga qaytaradi (uncontrolled).
            {...(students
              ? { value: amount, onChange: (e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value) }
              : { defaultValue: defaultAmount ? String(defaultAmount) : "" })}
            className={`${inputCls} num`}
            placeholder="500000"
            aria-invalid={!!fe.amount}
          />
          {fe.amount ? <p className="mt-1 text-xs text-rose-600">{fe.amount}</p> : null}
        </div>
        <div>
          <label htmlFor="pf-date" className={labelCls}>
            To&apos;langan sana
          </label>
          <input id="pf-date" name="paidAt" type="date" defaultValue={today} className={inputCls} aria-invalid={!!fe.paidAt} />
        </div>
        <div>
          <label htmlFor="pf-method" className={labelCls}>
            Usul
          </label>
          <select id="pf-method" name="method" defaultValue="naqd" className={inputCls}>
            <option value="naqd">Naqd</option>
            <option value="karta">Karta</option>
            <option value="otkazma">O&apos;tkazma</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="pf-note" className={labelCls}>
          Izoh <span className="font-normal text-slate-400">(ixtiyoriy)</span>
        </label>
        <input id="pf-note" name="note" className={inputCls} placeholder="Masalan: chek №123" />
      </div>

      {state.error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          ✓ {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={btn.primary}>
        {pending ? "Saqlanmoqda…" : "To'lovni saqlash"}
      </button>
    </form>
  );
}
