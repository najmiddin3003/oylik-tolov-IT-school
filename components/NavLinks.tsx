"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { NavCounts } from "@/lib/data";
import type { Role } from "@/lib/session";
import { isActivePath, navFor } from "./nav";
import { cx, IconTile } from "./ui";

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

export function SidebarNav({ counts, role }: { counts: NavCounts | null; role: Role }) {
  const pathname = usePathname();
  const hrefFor = useHref();
  return (
    <>
      {navFor(role).map((item) => {
        const active = isActivePath(pathname, item.href);
        const byKey: Partial<Record<typeof item.key, number | undefined>> = {
          students: counts?.students,
          debtors: counts?.debtors,
          payments: counts?.payments,
          staff: counts?.staff,
        };
        const count = byKey[item.key];
        const dot = item.key === "sync" && counts?.sync ? SYNC_DOT[counts.sync] : null;
        return (
          <Link
            key={item.href}
            href={hrefFor(item.href, item.monthAware)}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={cx(
              "group relative flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] font-medium transition sb-rail:justify-center sb-rail:px-0",
              active ? "bg-brand-50/80 text-brand-800" : "text-ink-600 hover:bg-slate-50 hover:text-ink-900",
            )}
          >
            {active ? (
              <span className="absolute -left-5 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 sb-rail:-left-3" aria-hidden />
            ) : null}
            <IconTile icon={item.icon} tone={item.tone} variant={active ? "solid" : "soft"} size="sm" />
            <span className="min-w-0 flex-1 truncate whitespace-nowrap sb-rail:hidden">{item.label}</span>
            {count !== undefined ? (
              <span
                className={cx(
                  "num inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold sb-rail:hidden",
                  active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-ink-500",
                )}
              >
                {count}
              </span>
            ) : null}
            {dot ? (
              <span
                className={cx("mr-1.5 size-2 shrink-0 rounded-full sb-rail:absolute sb-rail:right-2 sb-rail:top-2 sb-rail:mr-0", dot.cls)}
                title={dot.label}
                aria-label={dot.label}
              />
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const hrefFor = useHref();
  return (
    <>
      {navFor(role).filter((item) => item.mobile !== false).map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={hrefFor(item.href, item.monthAware)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium",
              active ? "text-brand-700" : "text-ink-400",
            )}
          >
            <span
              className={cx(
                "inline-flex h-8 w-12 items-center justify-center rounded-full transition",
                active ? "bg-brand-50 text-brand-600" : "group-hover:bg-slate-50",
              )}
            >
              <Icon className="icon-wiggle size-5" strokeWidth={1.9} fill="currentColor" fillOpacity={active ? 0.18 : 0} aria-hidden />
            </span>
            <span className="max-w-full truncate px-0.5">{item.short}</span>
          </Link>
        );
      })}
    </>
  );
}
