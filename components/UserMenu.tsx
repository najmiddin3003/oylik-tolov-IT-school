"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, FileSpreadsheet, LogOut, Settings2 } from "lucide-react";
import { logout } from "@/app/actions/auth";
import type { Role } from "@/lib/session";
import { ROLE_INFO } from "./nav";
import { btn, cx } from "./ui";

/** Foydalanuvchi menyusi: sozlamalar (rahbar) va chiqish. */
export function UserMenu({ role, placement }: { role: Role; placement: "sidebar" | "header" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  const info = ROLE_INFO[role];
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Foydalanuvchi menyusi"
        className={
          placement === "sidebar"
            ? cx(btn.icon, open && "bg-slate-100 text-ink-900")
            : "inline-flex size-10 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-brand"
        }
      >
        {placement === "sidebar" ? <ChevronUp className={cx("size-[18px] transition-transform", !open && "rotate-180")} strokeWidth={1.8} aria-hidden /> : info.letter}
      </button>
      {open ? (
        <div
          role="menu"
          className={cx(
            "pop-in absolute z-50 w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop",
            placement === "sidebar" ? "bottom-12 right-0 sb-rail:left-0 sb-rail:right-auto" : "right-0 top-12",
          )}
        >
          <p className="px-3 pb-1.5 pt-1 text-xs text-ink-400">
            {info.name} · {info.hint}
          </p>
          {role === "owner" ? (
            <>
              <Link href="/settings" role="menuitem" onClick={() => setOpen(false)} className={cx(item, "text-ink-700 hover:bg-slate-50")}>
                <Settings2 className="size-4 text-amber-600" aria-hidden />
                Sozlamalar
              </Link>
              <Link href="/sync" role="menuitem" onClick={() => setOpen(false)} className={cx(item, "text-ink-700 hover:bg-slate-50")}>
                <FileSpreadsheet className="size-4 text-teal-600" aria-hidden />
                Google Sheets
              </Link>
            </>
          ) : null}
          <form action={logout}>
            <button type="submit" role="menuitem" className={cx(item, "text-rose-600 hover:bg-rose-50")}>
              <LogOut className="size-4" aria-hidden />
              Chiqish
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
