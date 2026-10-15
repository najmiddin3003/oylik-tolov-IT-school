"use client";

// To'lovlar tarixi: o'z ichida aylanadi (sahifa cho'zilib ketmaydi), 10 tadan ochiladi — pastga yetganda keyingi 10 tasi.
// Kunlar bo'yicha guruh, eng yangilari tepada.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Banknote, ChevronDown, CreditCard, Landmark, Trash2, type LucideIcon } from "lucide-react";
import { archivePayment } from "@/app/actions/payments";
import type { PaymentRow } from "@/lib/data";
import type { PaymentMethod } from "@/lib/models";
import { dayLabel } from "@/lib/reminders";
import type { Role } from "@/lib/session";
import { dateToISO, formatMoney, MONTH_NAMES, todayISO } from "@/lib/time";
import { ConfirmAction } from "./SubmitButton";
import { Avatar, btn, cx, Tag } from "./ui";

const STEP = 10;

const METHOD: Record<PaymentMethod, { label: string; icon: LucideIcon; cls: string }> = {
  naqd: { label: "Naqd", icon: Banknote, cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  karta: { label: "Karta", icon: CreditCard, cls: "bg-brand-50 text-brand-700 ring-brand-100" },
  otkazma: { label: "O‘tkazma", icon: Landmark, cls: "bg-sky-50 text-sky-700 ring-sky-100" },
};

/** "Oktabr uchun" (boshqa yil bo'lsa — "Dekabr 2025 uchun"). */
function forMonth(m: string, pageMonth: string): string {
  const name = MONTH_NAMES[Number(m.slice(5, 7)) - 1];
  return m.slice(0, 4) === pageMonth.slice(0, 4) ? name : `${name} ${m.slice(0, 4)}`;
}

export function PaymentHistory({ rows, month, role, readOnly }: { rows: PaymentRow[]; month: string; role: Role; readOnly: boolean }) {
  const [shown, setShown] = useState(STEP);
  // Ro'yxat o'zgarsa (filtr, yangi to'lov) — yana birinchi 10 tasidan
  const [seen, setSeen] = useState(rows);
  if (seen !== rows) {
    setSeen(rows);
    setShown(STEP);
  }
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const more = shown < rows.length;

  // Pastga yetganda keyingi 10 tasi
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + STEP);
      },
      { root: scrollRef.current, rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);

  const visible = rows.slice(0, shown);
  const groups: { day: string; rows: PaymentRow[]; total: number; count: number }[] = [];
  for (const r of visible) {
    const d = dateToISO(new Date(r.paidAt));
    const g = groups[groups.length - 1];
    if (g && g.day === d) g.rows.push(r);
    else groups.push({ day: d, rows: [r], total: 0, count: 0 });
  }
  // Kun sarlavhasidagi jami — o'sha kunning hamma to'lovlari bo'yicha (hali ochilmaganlari ham)
  for (const g of groups) {
    const all = rows.filter((r) => dateToISO(new Date(r.paidAt)) === g.day);
    g.total = all.reduce((s, r) => s + r.amount, 0);
    g.count = all.length;
  }
  const today = todayISO();

  return (
    <div ref={scrollRef} className="scroll-thin max-h-[min(760px,calc(100dvh-13rem))] overflow-y-auto overscroll-contain border-t border-line-soft">
      {groups.map((g) => (
        <section key={g.day} aria-label={dayLabel(g.day)}>
          <header className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-b border-line-soft bg-slate-50/95 px-6 py-2.5 backdrop-blur">
            <h3 className="text-sm font-semibold text-ink-800 first-letter:uppercase">
              {dayLabel(g.day)}
              {g.day === today ? <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">bugun</span> : null}
            </h3>
            <p className="num text-[13px] text-ink-500">
              {g.count} ta · <span className="font-semibold text-ink-900">{formatMoney(g.total)}</span>
            </p>
          </header>
          <ul className="divide-y divide-line-soft">
            {g.rows.map((p) => {
              const m = METHOD[p.method];
              const Icon = m.icon;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5 transition hover:bg-slate-50/50 sm:flex-nowrap">
                  <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                    <Avatar name={p.studentName} />
                    <div className="min-w-0">
                      {p.studentId && role !== "admin" ? (
                        <Link href={`/students/${p.studentId}?month=${p.month}`} className="block truncate text-[15px] font-semibold text-ink-900 hover:text-brand-600">
                          {p.studentName}
                        </Link>
                      ) : (
                        <span className="block truncate text-[15px] font-semibold text-ink-900">{p.studentName}</span>
                      )}
                      <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-ink-500">
                        <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-px font-medium text-violet-700">{forMonth(p.month, month)} uchun</span>
                        {p.studentGroup ? <span className="hidden shrink-0 truncate text-ink-400 md:inline">{p.studentGroup}</span> : null}
                        {p.source === "sheets" ? <Tag tone="emerald">Sheets</Tag> : null}
                        {p.note ? (
                          <span className="truncate" title={p.note}>
                            {p.source === "sheets" ? p.note.replace(/^Google Sheets,?\s*/, "") : p.note}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3 pl-[52px] sm:pl-0">
                    <span className={cx("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium ring-1 ring-inset", m.cls)}>
                      <Icon className="size-3.5" aria-hidden />
                      {m.label}
                    </span>
                    <span className="num w-32 whitespace-nowrap text-right text-[16px] font-bold text-ink-900">{formatMoney(p.amount)}</span>
                    {readOnly ? null : (
                      <ConfirmAction
                        action={() => archivePayment(p.id)}
                        confirmText={
                          role === "owner"
                            ? `${p.studentName}: ${formatMoney(p.amount)} to‘lov arxivga o‘tkazilsinmi? U hisob-kitoblardan chiqadi, arxivdan qaytarish mumkin.`
                            : `${p.studentName}: ${formatMoney(p.amount)} to‘lov o‘chirilsinmi?`
                        }
                        className={btn.iconDanger}
                        pendingText="…"
                        title={role === "owner" ? "Arxivga o‘tkazish" : "O‘chirish"}
                      >
                        <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                      </ConfirmAction>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {more ? (
        <div ref={sentinelRef} className="flex justify-center px-6 py-4">
          <button type="button" onClick={() => setShown((n) => n + STEP)} className={cx(btn.sm, "text-ink-600")}>
            <ChevronDown className="size-4" aria-hidden />
            Yana {Math.min(STEP, rows.length - shown)} ta ({rows.length - shown} ta qoldi)
          </button>
        </div>
      ) : rows.length > STEP ? (
        <p className="px-6 py-4 text-center text-xs text-ink-400">Hammasi ko‘rsatildi · {rows.length} ta to‘lov</p>
      ) : null}
    </div>
  );
}
