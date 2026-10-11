"use client";

// Oy oxiri eslatmalari: to'lamaganlar ro'yxati oynasi va yuqoridagi qo'ng'iroqcha.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, BellRing, FileSpreadsheet, Phone, Plus, X } from "lucide-react";
import type { Reminder, UnpaidStudent } from "@/lib/data";
import { reminderTitle } from "@/lib/reminders";
import type { Role } from "@/lib/session";
import { formatMoney, formatNumber, monthLabel } from "@/lib/time";
import { Avatar, btn, cx, IconTile } from "./ui";

/** To'lov qilmagan o'quvchilar ro'yxati (modal oyna). */
export function UnpaidDialog({
  open,
  onClose,
  month,
  students,
  role,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  students: UnpaidStudent[];
  role: Role;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const total = students.reduce((s, x) => s + x.debt, 0);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={`unpaid-${month}`}
      className="m-auto max-h-[min(720px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-white p-0 text-ink-700 shadow-pop"
    >
      {open ? (
        <div className="flex max-h-[min(720px,calc(100dvh-2rem))] flex-col">
          <div className="group flex items-start gap-3.5 border-b border-line-soft px-5 py-4 sm:px-6">
            <IconTile icon={BellRing} tone="amber" variant="solid" />
            <div className="min-w-0 flex-1">
              <h2 id={`unpaid-${month}`} className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
                {monthLabel(month)}: to‘lov qilmaganlar
              </h2>
              <p className="num mt-0.5 text-sm text-ink-500">
                {students.length} ta o‘quvchi · jami qarz {formatMoney(total)}
              </p>
            </div>
            <button type="button" onClick={onClose} className={btn.icon} aria-label="Yopish">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <ul className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto overscroll-contain">
            {students.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="num w-5 shrink-0 text-right text-xs text-ink-300">{i + 1}</span>
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  {role === "owner" ? (
                    <Link href={`/students/${s.id}?month=${month}`} onClick={onClose} className="block truncate text-[15px] font-medium text-ink-900 hover:text-brand-600">
                      {s.name}
                    </Link>
                  ) : (
                    <span className="block truncate text-[15px] font-medium text-ink-900">{s.name}</span>
                  )}
                  <p className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-400">
                    {s.phone ? (
                      <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                        <Phone className="size-3" aria-hidden />
                        {s.phone}
                      </a>
                    ) : null}
                    {s.status === "partial" ? <span className="text-brand-600">to‘ladi {formatNumber(s.paid)}</span> : null}
                  </p>
                </div>
                <span className="num shrink-0 text-right text-[15px] font-semibold text-ink-900">{formatNumber(s.debt)}</span>
                <Link
                  href={`/payments?${new URLSearchParams({ month, student: s.id })}#yangi-tolov`}
                  onClick={onClose}
                  className={cx(btn.sm, "shrink-0 px-2.5")}
                  aria-label={`${s.name}: to‘lov kiritish`}
                  title="To‘lov kiritish"
                >
                  <Plus className="size-4" aria-hidden />
                  <span className="hidden sm:inline">To‘lov</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-line-soft bg-slate-50/60 px-5 py-3 sm:px-6">
            <p className="text-xs text-ink-400">Qarz miqdori — shu oy uchun qolgan summa (so‘m).</p>
            <button type="button" onClick={onClose} className={cx(btn.outline, "h-10")}>
              Yopish
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/** Bosilganda to'lamaganlar ro'yxatini ochadigan tugma. */
export function UnpaidButton({
  month,
  students,
  role,
  className,
  children,
  title,
}: {
  month: string;
  students: UnpaidStudent[];
  role: Role;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title={title} disabled={!students.length}>
        {children}
      </button>
      <UnpaidDialog open={open} onClose={() => setOpen(false)} month={month} students={students} role={role} />
    </>
  );
}

type SyncAlertData = { unresolved: number; error: string; at: string } | null;

/** Yuqori paneldagi qo'ng'iroqcha: oy oxiri eslatmalari va (rahbarga) Sheets farqlari. */
export function NotificationBell({ reminders, sync, role }: { reminders: Reminder[]; sync: SyncAlertData; role: Role }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Reminder | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = reminders.length + (sync ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = count ? `Bildirishnomalar: ${count} ta` : "Bildirishnomalar: yangi xabar yo‘q";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={cx(btn.icon, "group relative size-10 text-ink-500", open && "bg-slate-100 text-ink-900")}
      >
        {count ? <BellRing className="icon-wiggle size-5" strokeWidth={1.8} aria-hidden /> : <Bell className="size-5" strokeWidth={1.8} aria-hidden />}
        {count ? (
          <span className="absolute right-1 top-1 flex size-[18px] items-center justify-center" aria-hidden>
            <span className="ping-soft absolute inset-0 rounded-full bg-rose-400" />
            <span className="num relative inline-flex size-[18px] items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
              {count}
            </span>
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="dialog" aria-label="Bildirishnomalar" className="pop-in absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-2 shadow-pop">
          <p className="px-3 pb-2 pt-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Bildirishnomalar</p>
          {count === 0 ? (
            <p className="px-3 pb-4 pt-2 text-sm text-ink-500">Yangi xabar yo‘q. Hammasi joyida ✓</p>
          ) : (
            <ul className="grid gap-1">
              {reminders.map((r) => (
                <li key={r.month}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setDialog(r);
                    }}
                    className="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-amber-50/70"
                  >
                    <IconTile icon={BellRing} tone="amber" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-900">{reminderTitle(r)}</span>
                      <span className="num mt-0.5 block text-[13px] text-ink-500">
                        {monthLabel(r.month)}: {r.students.length} ta o‘quvchi to‘lov qilmadi
                      </span>
                      <span className="mt-1 inline-block text-xs font-semibold text-amber-700">Ro‘yxatni ko‘rish →</span>
                    </span>
                  </button>
                </li>
              ))}
              {sync && role === "owner" ? (
                <li>
                  <Link href="/sync" onClick={() => setOpen(false)} className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-teal-50/70">
                    <IconTile icon={FileSpreadsheet} tone={sync.error ? "rose" : "teal"} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-900">
                        {sync.error ? "Sheets tekshiruvi bajarilmadi" : `Sheets bilan ${sync.unresolved} ta farq`}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-500">{sync.error || "Sayt va Google Sheets mos kelmadi"}</span>
                    </span>
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}

      {dialog ? (
        <UnpaidDialog open onClose={() => setDialog(null)} month={dialog.month} students={dialog.students} role={role} />
      ) : null}
    </div>
  );
}
