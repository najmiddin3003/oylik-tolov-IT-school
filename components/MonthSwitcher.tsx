"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { monthLabel, shiftMonth } from "@/lib/time";

/** Oyni almashtirish: ‹ Oktabr 2026 › va oy tanlagich. Boshqa query parametrlari saqlanadi. */
export function MonthSwitcher({
  month,
  basePath,
  params = {},
}: {
  month: string;
  basePath: string;
  params?: Record<string, string>;
}) {
  const router = useRouter();
  const href = (m: string) => {
    const sp = new URLSearchParams({ ...params, month: m });
    for (const [k, v] of [...sp.entries()]) if (!v) sp.delete(k);
    return `${basePath}?${sp.toString()}`;
  };
  const arrow =
    "inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900";

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <Link href={href(shiftMonth(month, -1))} className={arrow} aria-label="Oldingi oy">
        ‹
      </Link>
      <label className="relative cursor-pointer px-2 text-sm font-semibold text-slate-900">
        <span className="pointer-events-none">{monthLabel(month)}</span>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && router.push(href(e.target.value))}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Oyni tanlash"
        />
      </label>
      <Link href={href(shiftMonth(month, 1))} className={arrow} aria-label="Keyingi oy">
        ›
      </Link>
    </div>
  );
}
