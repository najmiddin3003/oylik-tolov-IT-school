"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, House, Search } from "lucide-react";
import { monthLabel, shiftMonth } from "@/lib/time";
import { pageTitle } from "./nav";
import { cx } from "./ui";

export function Breadcrumb() {
  const pathname = usePathname();
  const t = pageTitle(pathname);
  return (
    <nav className="flex min-w-0 items-center gap-2.5 text-[15px]" aria-label="Yo‘l">
      <House className="size-[18px] shrink-0 text-ink-500" strokeWidth={1.8} aria-hidden />
      <span className="text-ink-400">Ish maydoni</span>
      <span className="text-ink-300" aria-hidden>
        /
      </span>
      {t.page ? (
        <>
          <Link href={t.sectionHref} className="truncate text-ink-400 hover:text-ink-700">
            {t.section}
          </Link>
          <span className="text-ink-300" aria-hidden>
            /
          </span>
          <span className="truncate font-medium text-ink-800">{t.page}</span>
        </>
      ) : (
        <span className="truncate font-medium text-ink-800">{t.section}</span>
      )}
    </nav>
  );
}

export function BreadcrumbFallback() {
  return (
    <span className="flex items-center gap-2.5 text-[15px] text-ink-400">
      <House className="size-[18px] text-ink-500" strokeWidth={1.8} aria-hidden />
      Ish maydoni
    </span>
  );
}

/** "/" tugmasi bilan fokuslanadigan o'quvchi qidiruvi (O'quvchilar sahifasiga olib boradi). */
export function HeaderSearch() {
  const params = useSearchParams();
  const pathname = usePathname();
  const ref = useRef<HTMLInputElement>(null);
  const month = params.get("month");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/students" role="search" className="group relative hidden w-72 items-center md:flex">
      <Search className="pointer-events-none absolute left-0 size-[18px] text-ink-400" strokeWidth={1.8} aria-hidden />
      <input
        ref={ref}
        name="q"
        defaultValue={pathname === "/students" ? params.get("q") ?? "" : ""}
        placeholder="O‘quvchi qidirish..."
        aria-label="O‘quvchi qidirish"
        className="h-10 w-full bg-transparent pl-8 pr-9 text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
      />
      {month ? <input type="hidden" name="month" value={month} /> : null}
      <kbd className="pointer-events-none absolute right-0 inline-flex size-6 items-center justify-center rounded-md border border-line text-xs text-ink-400 group-focus-within:hidden">
        /
      </kbd>
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
    return `${pathname}?${sp.toString()}`;
  };
  const arrow = "inline-flex size-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-slate-100 hover:text-ink-900 sm:size-9";

  return (
    <div className="inline-flex h-11 items-center gap-0.5 rounded-xl border border-line bg-white px-0.5 shadow-card sm:h-12 sm:px-1">
      <Link href={href(shiftMonth(month, -1))} className={arrow} aria-label="Oldingi oy" scroll={false}>
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <label className="relative flex cursor-pointer items-center gap-2 px-1 text-sm font-semibold text-ink-900 sm:px-3 sm:text-[15px]">
        <CalendarDays className="hidden size-[18px] text-ink-500 sm:block" strokeWidth={1.8} aria-hidden />
        <span className="num whitespace-nowrap">{monthLabel(month)}</span>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && router.push(href(e.target.value), { scroll: false })}
          className="picker-overlay absolute inset-0 cursor-pointer opacity-0"
          aria-label="Oyni tanlash"
        />
      </label>
      <Link href={href(shiftMonth(month, 1))} className={arrow} aria-label="Keyingi oy" scroll={false}>
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

export function MonthPillSkeleton() {
  return <div className={cx("skeleton h-12 w-52 rounded-xl")} aria-hidden />;
}
