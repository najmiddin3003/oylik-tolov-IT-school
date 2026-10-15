"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, CornerDownLeft, History, House, LayoutDashboard, LoaderCircle, Search } from "lucide-react";
import { quickSearch } from "@/app/actions/search";
import { shiftMonth } from "@/lib/time";
import type { Role } from "@/lib/session";
import { isActivePath, navFor, NAV, pageTitle } from "./nav";
import { MonthPicker } from "./pickers";
import { Avatar, cx, IconTile, studentCode } from "./ui";

/** Yuqori panel chap qismi: bo'lim ikonkasi, yo'l (Ish maydoni › Bo'lim) va sahifa nomi. */
export function Breadcrumb({ role }: { role?: Role }) {
  const pathname = usePathname();
  const t = pageTitle(pathname, role);
  const item = (role ? navFor(role) : NAV).find((n) => isActivePath(pathname, n.href));
  const icon = pathname.startsWith("/faoliyat") ? History : (item?.icon ?? LayoutDashboard);
  const tone = pathname.startsWith("/faoliyat") ? "brand" : (item?.tone ?? "brand");
  return (
    <nav className="group flex min-w-0 items-center gap-3" aria-label="Yo‘l">
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1 text-xs text-ink-400">
          <House className="size-3" strokeWidth={2} aria-hidden />
          Ish maydoni
          {t.page ? (
            <>
              <ChevronRight className="size-3 text-ink-300" aria-hidden />
              <Link href={t.sectionHref} className="truncate hover:text-ink-700">
                {t.section}
              </Link>
            </>
          ) : null}
        </span>
        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-900">{t.page ?? t.section}</span>
      </span>
    </nav>
  );
}

export function BreadcrumbFallback() {
  return (
    <span className="flex items-center gap-3">
      <span className="skeleton size-8 rounded-[10px]" aria-hidden />
      <span className="grid gap-1.5">
        <span className="skeleton h-2.5 w-20" aria-hidden />
        <span className="skeleton h-3.5 w-32" aria-hidden />
      </span>
    </span>
  );
}

type QuickResult = Awaited<ReturnType<typeof quickSearch>>[number];

/** O'quvchini tezkor qidirish ("/" tugmasi bilan fokuslanadi): yozilishi bilan natijalar chiqadi. */
export function HeaderSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reqId = useRef(0);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<QuickResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const onChange = (value: string) => {
    setQ(value);
    setOpen(true);
    clearTimeout(timer.current);
    if (!value.trim()) {
      reqId.current++;
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => {
      const id = ++reqId.current;
      startTransition(async () => {
        const found = await quickSearch(value);
        if (id === reqId.current) {
          setResults(found);
          setActive(0);
        }
      });
    }, 220);
  };

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    setResults(null);
    ref.current?.blur();
    router.push(href);
  };

  const showPanel = open && q.trim().length > 0;

  return (
    <form
      ref={rootRef}
      role="search"
      action="/students"
      onSubmit={(e) => {
        e.preventDefault();
        const r = results?.[active];
        if (r && showPanel) go(`/students/${r.id}`);
        else if (q.trim()) go(`/students?${new URLSearchParams({ q: q.trim() })}`);
      }}
      className="group relative hidden h-10 w-56 items-center rounded-full bg-slate-100/80 ring-1 ring-transparent transition focus-within:bg-surface focus-within:ring-brand-300 hover:bg-slate-100 md:flex xl:w-72"
    >
      <Search className="pointer-events-none absolute left-3.5 size-[17px] text-ink-400" strokeWidth={1.9} aria-hidden />
      <input
        ref={ref}
        name="q"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!results?.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="O‘quvchi qidirish..."
        aria-label="O‘quvchi qidirish"
        autoComplete="off"
        className="h-10 w-full rounded-full bg-transparent pl-10 pr-10 text-[14px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
      />
      {pending ? (
        <LoaderCircle className="absolute right-3.5 size-4 animate-spin text-ink-400" aria-hidden />
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 inline-flex size-6 items-center justify-center rounded-md border border-line bg-surface text-xs text-ink-400 group-focus-within:hidden">
          /
        </kbd>
      )}

      {showPanel ? (
        <div className="pop-in absolute left-0 top-full z-50 mt-3 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-pop">
          {results === null ? (
            <p className="px-3 py-4 text-sm text-ink-400">Qidirilmoqda…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-500">«{q}» bo‘yicha o‘quvchi topilmadi</p>
          ) : (
            <ul role="listbox" aria-label="Topilgan o‘quvchilar">
              {results.map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onPointerEnter={() => setActive(i)}
                    onClick={() => go(`/students/${r.id}`)}
                    className={cx("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", i === active ? "bg-brand-50" : "hover:bg-slate-50")}
                  >
                    <Avatar name={r.fullName} />
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-[15px] font-medium", r.active ? "text-ink-900" : "text-ink-400")}>{r.fullName}</span>
                      <span className="num block truncate text-xs text-ink-400">
                        {[studentCode(r.seq), r.phone, r.active ? "" : "nofaol"].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    {i === active ? <CornerDownLeft className="size-4 shrink-0 text-brand-500" aria-hidden /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            className="mt-1 flex w-full items-center justify-between rounded-xl border-t border-line-soft px-3 pb-1.5 pt-2.5 text-left text-[13px] font-medium text-brand-600 hover:text-brand-800"
          >
            «{q.trim()}» — barcha natijalar
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** Umumiy oy tanlagich: joriy sahifaning ?month= parametrini o'zgartiradi. */
export function HeaderMonth({ fallbackMonth }: { fallbackMonth: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const hidden = pathname.startsWith("/sync") || pathname.startsWith("/students/new") || /^\/students\/[^/]+\/edit/.test(pathname);
  if (hidden) return null;

  const raw = params.get("month");
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : fallbackMonth;
  const href = (m: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("month", m);
    sp.delete("page");
    sp.delete("day");
    return `${pathname}?${sp.toString()}`;
  };
  const arrow = "inline-flex size-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-slate-100 hover:text-ink-900";

  return (
    <div className="inline-flex h-10 items-center gap-0.5 rounded-full border border-line bg-surface px-1 shadow-card">
      <Link href={href(shiftMonth(month, -1))} className={arrow} aria-label="Oldingi oy" scroll={false}>
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <MonthPicker variant="bare" value={month} onChange={(m) => router.push(href(m), { scroll: false })} aria-label="Oyni tanlash" />
      <Link href={href(shiftMonth(month, 1))} className={arrow} aria-label="Keyingi oy" scroll={false}>
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

export function MonthPillSkeleton() {
  return <div className={cx("skeleton h-12 w-52 rounded-xl")} aria-hidden />;
}
