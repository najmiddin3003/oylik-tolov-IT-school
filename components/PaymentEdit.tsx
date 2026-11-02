"use client";

// To'lov summasini tahrirlash oynasi (To'lovlar tarixi va o'quvchi sahifasi) va «tahrirlangan» belgisi.
import { useEffect, useEffectEvent, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { updatePaymentAmount } from "@/app/actions/payments";
import type { FormState } from "@/app/actions/types";
import { formatDateTime, formatMoney, monthLabel } from "@/lib/time";
import { MoneyInput } from "./inputs";
import { Modal, ModalBody, ModalHeader } from "./Modal";
import { btn, cx, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

export type EditablePayment = {
  id: string;
  studentName: string;
  month: string;
  amount: number;
  editedAt: string | null;
  editedBy: "owner" | "admin" | null;
  originalAmount: number | null;
};

/** Qalamcha tugma: bosilsa summani tahrirlash oynasi ochiladi. */
export function EditPaymentButton({ payment }: { payment: EditablePayment }) {
  const [open, setOpen] = useState(false);
  const titleId = `edit-payment-${payment.id}`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn.icon} title="Summani tahrirlash" aria-label="Summani tahrirlash">
        <Pencil className="size-[17px]" strokeWidth={1.8} aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId} size="sm">
        <ModalHeader
          id={titleId}
          icon={Pencil}
          title="Summani tahrirlash"
          subtitle={`${payment.studentName} · ${monthLabel(payment.month)} uchun`}
          onClose={() => setOpen(false)}
        />
        {/* Oyna yopilgach forma o'chadi — keyingi ochilishda yangi holatdan (eski xato ko'rinmaydi) */}
        <EditPaymentForm payment={payment} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function EditPaymentForm({ payment, onDone }: { payment: EditablePayment; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(updatePaymentAmount, {});
  const [digits, setDigits] = useState(String(payment.amount));
  const inputId = `edit-payment-amount-${payment.id}`;

  // Saqlangach oyna yopiladi (yangi summa ro'yxatda darhol ko'rinadi)
  const close = useEffectEvent(onDone);
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, state.nonce]);

  // Oyna ochilgach summa belgilanadi — darhol yangisini yozish mumkin
  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = document.getElementById(inputId) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }, 30);
    return () => window.clearTimeout(t);
  }, [inputId]);

  const next = Number(digits) || 0;
  const diff = next - payment.amount;
  const original = payment.originalAmount !== null && payment.originalAmount !== payment.amount ? payment.originalAmount : null;
  const err = state.fieldErrors?.amount;

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="id" value={payment.id} />
      <ModalBody className="grid gap-5">
        <dl className="num grid gap-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm ring-1 ring-inset ring-line-soft">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-500">Hozirgi summa</dt>
            <dd className="font-semibold text-ink-900">{formatMoney(payment.amount)}</dd>
          </div>
          {original !== null ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Birinchi kiritilgani</dt>
              <dd className="text-ink-600">{formatMoney(original)}</dd>
            </div>
          ) : null}
        </dl>

        <div>
          <label htmlFor={inputId} className={labelCls}>
            Yangi summa <span className="text-brand-600">*</span>
          </label>
          <MoneyInput id={inputId} name="amount" value={digits} onValueChange={(d) => setDigits(d)} maxDigits={10} placeholder="To‘langan summa" invalid={!!err} />
          {err ? (
            <p className="mt-1.5 text-xs text-rose-600">{err}</p>
          ) : next > 0 && diff !== 0 ? (
            <p className={cx("num mt-1.5 text-xs font-medium", diff > 0 ? "text-emerald-700" : "text-amber-700")}>
              {diff > 0 ? "+" : "−"} {formatMoney(Math.abs(diff))} {diff > 0 ? "ko‘proq" : "kamroq"}
            </p>
          ) : null}
        </div>

        <p className="text-xs leading-relaxed text-ink-400">
          Qarz, oy rejasi, kassa va oyliklar yangi summa bo‘yicha qayta hisoblanadi. Asl summa saqlanib qoladi.
        </p>

        {state.error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
            {state.error}
          </p>
        ) : null}
      </ModalBody>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-slate-50/60 px-5 py-3.5 sm:px-6">
        <button type="button" onClick={onDone} className={cx(btn.outline, "h-10")}>
          Bekor qilish
        </button>
        <button type="submit" disabled={pending || next <= 0 || diff === 0} className={cx(btn.primary, "h-10")}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </form>
  );
}

/** Summa tahrirlangan to'lov uchun kichik belgi: «avval 300 000» (ustiga olib borilsa — kim va qachon). */
export function EditedMark({ payment, className }: { payment: Pick<EditablePayment, "amount" | "editedAt" | "editedBy" | "originalAmount">; className?: string }) {
  if (!payment.editedAt) return null;
  const who = payment.editedBy === "admin" ? "administrator" : payment.editedBy === "owner" ? "rahbar" : "";
  const original = payment.originalAmount !== null && payment.originalAmount !== payment.amount ? payment.originalAmount : null;
  const title = [
    `Summa tahrirlangan: ${formatDateTime(payment.editedAt)}${who ? ` (${who})` : ""}`,
    original !== null ? `Birinchi kiritilgani: ${formatMoney(original)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className={cx("num inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-amber-700", className)} title={title}>
      <Pencil className="size-3" aria-hidden />
      {original !== null ? (
        <>
          <span className="sr-only">tahrirlangan, </span>avval <span className="line-through decoration-amber-500/60">{formatMoney(original)}</span>
        </>
      ) : (
        "tahrirlangan"
      )}
    </span>
  );
}
