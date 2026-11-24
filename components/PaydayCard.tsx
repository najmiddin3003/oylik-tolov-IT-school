"use client";

// Umumiy oylik kunlari (Xodimlar sahifasi, rahbar): har oy oyligi hamma xodimga qaysi kuni berilgani. Shu kungacha
// (shu kun ham) tushgan to'lovlar o'sha oy oyligiga, keyingilari — keyingi oyga. Rahbar «oylik» yozganda o'zi qo'yiladi,
// shu yerda aniq sanaga o'zgartiriladi.
import { useState, useTransition } from "react";
import { CalendarCheck, Check, Loader2, Pencil, X } from "lucide-react";
import { setPayday } from "@/app/actions/staff";
import type { Payday } from "@/lib/salary-cycle";
import { formatDate, monthLabel, shiftMonth } from "@/lib/time";
import { DatePicker } from "./pickers";
import { btn, cx, IconTile } from "./ui";

export function PaydayCard({ months, paydays, today }: { months: string[]; paydays: Payday[]; today: string }) {
  const by = new Map(paydays.map((p) => [p.month, p]));
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="group flex items-start gap-3.5 border-b border-line-soft px-5 py-4 sm:px-6">
        <IconTile icon={CalendarCheck} tone="emerald" variant="solid" />
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Oylik berilgan kunlar</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Barcha xodimlar uchun bitta kun: shu kungacha (shu kun ham) tushgan to‘lovlar o‘sha oy oyligiga, keyingilari — keyingi oyga. Siz «oylik»
            yozganingizda o‘zi qo‘yiladi, bu yerda aniq kunga o‘zgartirasiz.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-line-soft">
        {months.map((m) => (
          <PaydayRow key={m} month={m} payday={by.get(m) ?? null} today={today} />
        ))}
      </ul>
    </section>
  );
}

function PaydayRow({ month, payday, today }: { month: string; payday: Payday | null; today: string }) {
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState(payday?.date ?? today);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = (value: string) =>
    start(async () => {
      const res = await setPayday(month, value).catch(() => ({ error: "Tarmoq xatosi — qayta urinib ko‘ring" }) as { error?: string; message?: string });
      if (res.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: res.message ?? "Saqlandi" });
        setEdit(false);
      }
    });
  return (
    <li className="px-5 py-3.5 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-[180px] flex-1">
          <p className="text-[15px] font-semibold text-ink-900">{monthLabel(month)} oyligi</p>
          <p className="num text-[13px] text-ink-500">
            {payday ? (
              <>
                <b className="font-semibold text-ink-800">{formatDate(payday.date)}</b> da berilgan
                {payday.exact ? " · aniq belgilangan" : " · rahbar yozgan «oylik» sanasidan"}
                {` · keyingi to‘lovlar — ${monthLabel(shiftMonth(month, 1))}`}
              </>
            ) : (
              "Hali berilmagan — to‘lovlar shu oy oyligiga qo‘shilmoqda"
            )}
          </p>
        </div>
        {edit ? null : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEdit(true)} className={btn.sm}>
              <Pencil className="size-3.5" aria-hidden />
              {payday ? "O‘zgartirish" : "Belgilash"}
            </button>
            {payday?.exact ? (
              <button type="button" disabled={pending} onClick={() => save("")} className={cx(btn.sm, "text-ink-500")} title="Aniq sanani olib tashlash">
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        )}
      </div>
      {edit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DatePicker value={date} onChange={setDate} min={`${month}-01`} max={today} aria-label={`${monthLabel(month)} oyligi berilgan kun`} wrapperClassName="w-60" />
          <button type="button" disabled={pending} onClick={() => save(date)} className={cx(btn.primary, "h-10 px-4 text-sm")}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Saqlash
          </button>
          <button type="button" onClick={() => setEdit(false)} className="h-10 rounded-lg px-3 text-sm text-ink-500 hover:bg-slate-100">
            Bekor qilish
          </button>
        </div>
      ) : null}
      {msg ? <p className={cx("mt-2 text-xs", msg.ok ? "text-emerald-700" : "text-rose-700")}>{msg.ok ? "✓ " : ""}{msg.text}</p> : null}
    </li>
  );
}
