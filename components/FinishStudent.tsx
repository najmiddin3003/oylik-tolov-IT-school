"use client";

// O'qishni tugatish: sana tanlash oynasi (o'quvchi profili va ro'yxatdagi ommaviy amal). Tanlangan sana bo'yicha
// nima bo'lishi darhol ko'rsatiladi: oxirgi to'lov oyi, davomat qachondan olinmaydi, qachon «Arxiv»ga o'tadi.
import { useState, useTransition } from "react";
import { Check, GraduationCap, X } from "lucide-react";
import { finishStudent } from "@/app/actions/students";
import { isArchived, lastBilledMonth } from "@/lib/enrollment";
import { formatDate, monthLabel, shiftMonth } from "@/lib/time";
import { useDialog } from "./Modal";
import { DatePicker } from "./pickers";
import { btn, cx, IconTile } from "./ui";

type FinishProps = {
  title: string;
  subtitle: string;
  initial: string;
  today: string;
  /** Saqlash: xato matni yoki null */
  onSave: (endIso: string) => Promise<string | null>;
};

export function FinishDialog({ open, onClose, ...props }: FinishProps & { open: boolean; onClose: () => void }) {
  const { ref, present } = useDialog(open);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="finish-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-2xl border border-line bg-surface p-0 text-ink-700 shadow-pop"
    >
      {present ? <FinishBody {...props} onClose={onClose} /> : null}
    </dialog>
  );
}

function FinishBody({ title, subtitle, initial, today, onSave, onClose }: FinishProps & { onClose: () => void }) {
  const [date, setDate] = useState(initial || today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const last = valid ? lastBilledMonth(date) : null;
  return (
    <div>
      <div className="group flex items-start gap-3.5 border-b border-line-soft px-5 py-4 sm:px-6">
        <IconTile icon={GraduationCap} tone="brand" variant="solid" />
        <div className="min-w-0 flex-1">
          <h2 id="finish-title" className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
            {title}
          </h2>
          <p className="mt-0.5 truncate text-sm text-ink-500">{subtitle}</p>
        </div>
        <button type="button" onClick={onClose} className={btn.icon} aria-label="Yopish">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:px-6">
        <div>
          <span className="mb-2 block text-sm font-medium text-ink-700">O‘qishni tugatgan sana</span>
          <DatePicker value={date} onChange={(v) => setDate(v)} aria-label="O‘qishni tugatgan sana" />
        </div>
        {last ? (
          <ul className="grid gap-1.5 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-ink-600">
            <li>
              To‘lov <b className="font-semibold text-ink-800">{monthLabel(last)}</b> gacha hisoblanadi, {monthLabel(shiftMonth(last, 1))} dan — yo‘q.
            </li>
            <li>
              Davomat <b className="font-semibold text-ink-800">{formatDate(date)}</b> dan boshlab olinmaydi.
            </li>
            <li>To‘lanmagan oylari qarz bo‘lib qoladi.</li>
            <li>{isArchived(date, today) ? "O‘quvchi darhol «Arxiv»ga o‘tadi." : `${formatDate(date)} da «Arxiv»ga o‘tadi (shungacha o‘qiydi).`}</li>
          </ul>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-slate-50/60 px-5 py-3 sm:px-6">
        <button type="button" onClick={onClose} className={cx(btn.outline, "h-10")}>
          Bekor qilish
        </button>
        <button
          type="button"
          disabled={pending || !valid}
          onClick={() =>
            start(async () => {
              const err = await onSave(date).catch(() => "Tarmoq xatosi — qayta urinib ko‘ring");
              if (err) setError(err);
              else onClose();
            })
          }
          className={cx(btn.primary, "h-10")}
        >
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

/** O'quvchi profili: «O'qishni tugatish» (yoki sanani o'zgartirish) tugmasi va oynasi. */
export function FinishStudentButton({
  studentId,
  name,
  endDate,
  today,
  label,
  className,
}: {
  studentId: string;
  name: string;
  endDate: string | null;
  today: string;
  label: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <GraduationCap className="size-4" aria-hidden />
        {label}
      </button>
      <FinishDialog
        open={open}
        onClose={() => setOpen(false)}
        title={endDate ? "Tugatish sanasini o‘zgartirish" : "O‘qishni tugatish"}
        subtitle={name}
        initial={endDate ?? today}
        today={today}
        onSave={async (d) => (await finishStudent(studentId, d)).error ?? null}
      />
    </>
  );
}
