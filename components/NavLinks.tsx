"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isActivePath, NAV, type NavCounts } from "./nav";
import { cx } from "./ui";

const SYNC_DOT = {
  ok: { cls: "bg-paid", label: "Sheets bilan bir xil" },
  warn: { cls: "bg-unpaid", label: "Sheets bilan farq bor" },
  error: { cls: "bg-rose-500", label: "Sheets tekshiruvida xato" },
  off: { cls: "bg-ink-300", label: "Sheets ulanmagan" },
};

/** Tanlangan oyni (?month=) boshqa bo'limlarga o'tganda ham saqlab qoladi. */
function useHref() {
  const params = useSearchParams();
  const month = params.get("month");
  return (href: string, monthAware: boolean) => (monthAware && month ? `${href}?month=${month}` : href);
}

export function SidebarNav({ counts }: { counts: NavCounts | null }) {
  const pathname = usePathname();
  const hrefFor = useHref();
  return (
    <>
      {NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        const count = item.key === "students" ? counts?.students : item.key === "payments" ? counts?.payments : undefined;
        const dot = item.key === "sync" && counts ? SYNC_DOT[counts.sync] : null;
        return (
          <Link
            key={item.href}
            href={hrefFor(item.href, item.monthAware)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative flex h-12 items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium transition",
              active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-slate-50 hover:text-ink-900",
              active && "before:absolute before:-left-6 before:top-1/2 before:h-7 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-brand-600",
            )}
          >
            <Icon className={cx("size-5 shrink-0", active ? "text-brand-600" : "text-ink-400")} strokeWidth={1.8} aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {count !== undefined ? (
              <span
                className={cx(
                  "num inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
                  active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-ink-500",
                )}
              >
                {count}
              </span>
            ) : null}
            {dot ? <span className={cx("mr-1.5 size-2 rounded-full", dot.cls)} title={dot.label} aria-label={dot.label} /> : null}
          </Link>
        );
      })}
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const hrefFor = useHref();
  return (
    <>
      {NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={hrefFor(item.href, item.monthAware)}
            aria-current={active ? "page" : undefined}
            className={cx("flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-brand-600" : "text-ink-400")}
          >
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
            {item.short}
          </Link>
        );
      })}
    </>
  );
}
