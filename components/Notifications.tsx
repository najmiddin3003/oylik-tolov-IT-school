"use client";

// Oy oxiri eslatmalari: to'lamaganlar ro'yxati oynasi va yuqoridagi qo'ng'iroqcha.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, BellRing, CalendarClock, ClipboardList, FileSpreadsheet, Phone, Plus, X } from "lucide-react";
import type { Reminder, UnpaidStudent } from "@/lib/data";
import { reminderTitle } from "@/lib/reminders";
import { minutesUntil, nextLesson, nextLessonLabel, scheduleLabel, tashkentClock } from "@/lib/schedule";
import type { Role } from "@/lib/session";
import type { TaskRow } from "@/lib/tasks";
import { formatMoney, formatNumber, monthLabel } from "@/lib/time";
import { LiveDot } from "./Lessons";
import { Avatar, btn, cx, IconTile } from "./ui";
import { useDialog } from "./Modal";
import { SendTaskButton } from "./TaskButtons";
import { useNow } from "./useNow";

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
  const { ref, present } = useDialog(open);

  const total = students.reduce((s, x) => s + x.debt, 0);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={`unpaid-${month}`}
      className="m-auto max-h-[min(720px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink-700 shadow-pop"
    >
      {present ? (
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

          <UnpaidList students={students} month={month} role={role} onClose={onClose} />

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

/**
 * Ro'yxat qatorlari. Dars jadvali kiritilganlar — keyingi darsi yaqinligi bo'yicha (hozir darsdagilar birinchi):
 * to'lovni o'quvchi kelgan vaqtda yig'ish uchun. Jadvalsizlar — oxirida, avvalgi tartibda.
 */
function UnpaidList({ students, month, role, onClose }: { students: UnpaidStudent[]; month: string; role: Role; onClose: () => void }) {
  const now = useNow();
  const clock = tashkentClock(now);
  const rows = students
    .map((s, i) => {
      const next = nextLesson(s.lessons, clock);
      return { s, i, next, wait: minutesUntil(next, clock) };
    })
    .sort((a, b) => a.wait - b.wait || a.i - b.i);

  return (
    <ul className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto overscroll-contain">
      {rows.map(({ s, next }, i) => (
        <li key={s.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
          <span className="num w-5 shrink-0 text-right text-xs text-ink-300">{i + 1}</span>
          <Avatar name={s.name} />
          <div className="min-w-0 flex-1">
            {role !== "admin" ? (
              <Link href={`/students/${s.id}?month=${month}`} onClick={onClose} className="block truncate text-[15px] font-medium text-ink-900 hover:text-brand-600">
                {s.name}
              </Link>
            ) : (
              <span className="block truncate text-[15px] font-medium text-ink-900">{s.name}</span>
            )}
            <p className="num mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[13px] text-ink-400">
              {next ? (
                <span
                  className={cx("inline-flex items-center gap-1 font-medium", next.now ? "text-emerald-700" : next.inDays === 0 ? "text-brand-700" : "text-ink-600")}
                  title={scheduleLabel(s.lessons)}
                >
                  {next.now ? <LiveDot /> : <CalendarClock className="size-3" aria-hidden />}
                  {nextLessonLabel(next)}
                </span>
              ) : null}
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
          {role !== "teacher" ? (
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
          ) : null}
        </li>
      ))}
    </ul>
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

/**
 * Yuqori paneldagi qo'ng'iroqcha (barcha ogohlantirishlar shu yerda — sahifalarda alohida banner yo'q): oy oxiri
 * eslatmalari (rahbarga — administratorga topshiriq yuborish tugmasi bilan), rahbarga — Sheets farqlari,
 * administratorga — rahbardan kelgan topshiriqlar.
 */
export function NotificationBell({
  reminders,
  sync,
  role,
  tasks = [],
  sent = {},
}: {
  reminders: Reminder[];
  sync: SyncAlertData;
  role: Role;
  tasks?: TaskRow[];
  /** Rahbar: eslatma oyi -> administratorga yuborilgan oxirgi topshiriq */
  sent?: Record<string, TaskRow>;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Reminder | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = reminders.length + (sync ? 1 : 0) + tasks.length;

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
        className={cx(btn.icon, "group relative size-10 rounded-full text-ink-500", open && "bg-slate-100 text-ink-900")}
      >
        {count ? <BellRing className="icon-wiggle size-5" strokeWidth={1.8} aria-hidden /> : <Bell className="size-5" strokeWidth={1.8} aria-hidden />}
        {count ? (
          <span className="absolute right-1 top-1 flex size-[18px] items-center justify-center" aria-hidden>
            <span className="ping-soft absolute inset-0 rounded-full bg-rose-400" />
            <span className="num relative inline-flex size-[18px] items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-surface">
              {count}
            </span>
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="dialog" aria-label="Bildirishnomalar" className="pop-in absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-pop">
          <p className="px-3 pb-2 pt-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Bildirishnomalar</p>
          {count === 0 ? (
            <p className="px-3 pb-4 pt-2 text-sm text-ink-500">Yangi xabar yo‘q. Hammasi joyida ✓</p>
          ) : (
            <ul className="grid max-h-[min(480px,calc(100dvh-8rem))] gap-1 overflow-y-auto overscroll-contain">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href="/payments#topshiriqlar"
                    onClick={() => setOpen(false)}
                    className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-brand-50/70"
                  >
                    <IconTile icon={ClipboardList} tone="brand" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-900">Rahbardan topshiriq</span>
                      <span className="num mt-0.5 block text-[13px] text-ink-500">
                        To‘lovlarni yig‘ing: {monthLabel(t.month)} uchun {t.count} ta o‘quvchi to‘lov qilmabdi
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {reminders.map((r) => (
                <li key={r.month} className="rounded-xl transition hover:bg-amber-50/70">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setDialog(r);
                    }}
                    className="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left"
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
                  {role === "owner" ? (
                    <div className="pb-2.5 pl-14 pr-3">
                      <SendTaskButton month={r.month} task={sent[r.month] ?? null} tone={r.daysLeft === null || r.daysLeft <= 3 ? "rose" : "amber"} compact />
                    </div>
                  ) : null}
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
