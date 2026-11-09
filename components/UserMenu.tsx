"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleUserRound, Crown, History, LogOut, Moon, Sun } from "lucide-react";
import { logout } from "@/app/actions/auth";
import type { Role } from "@/lib/session";
import { staffInitials } from "@/lib/staff-rules";
import { navFor, ROLE_INFO } from "./nav";
import { setTheme, useIsDark } from "./ThemeToggle";
import { cx, type Tone } from "./ui";

/** Menyudagi bo'lim ikonkasi rangi */
const TONE_TEXT: Record<Tone, string> = {
  slate: "text-ink-500",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  brand: "text-brand-600",
  sky: "text-sky-600",
  violet: "text-violet-600",
  teal: "text-teal-600",
  rose: "text-rose-500",
  orange: "text-orange-600",
};

/** Foydalanuvchi belgisi: rahbar — toj, xodim — ism bosh harflari. */
export function UserAvatar({ role, name, size = "md" }: { role: Role; name: string | null; size?: "sm" | "md" }) {
  const isOwner = role === "owner";
  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "size-8 text-xs" : "size-10 text-sm",
        isOwner
          ? "bg-linear-to-br from-amber-400 to-orange-600 shadow-[0_8px_16px_-8px_rgb(234_88_12/0.8)] ring-2 ring-amber-200 dark:ring-amber-400/30"
          : role === "teacher"
            ? "bg-linear-to-br from-brand-500 to-brand-700 shadow-brand"
            : "bg-linear-to-br from-emerald-400 to-emerald-600 shadow-[0_8px_16px_-8px_rgb(5_150_105/0.85)]",
      )}
      aria-hidden
    >
      {isOwner ? (
        <Crown className={size === "sm" ? "size-4" : "size-[18px]"} strokeWidth={2} fill="currentColor" fillOpacity={0.25} />
      ) : name ? (
        staffInitials(name)
      ) : (
        ROLE_INFO[role].letter
      )}
    </span>
  );
}

/**
 * Foydalanuvchi menyusi (yuqori panelda, bitta joyda): profil (rahbarda — menyuda «Profilim» yo'q), faoliyat tarixi, mavzu,
 * chiqish. Telefonda pastki menyuga sig'magan bo'limlar ham shu yerda (kompyuterda ular yon menyuda bor — takrorlanmaydi).
 */
export function UserMenu({ role, name }: { role: Role; name: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dark = useIsDark();

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
  const isOwner = role === "owner";
  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Foydalanuvchi menyusi"
        className={cx(
          "group inline-flex items-center gap-2 rounded-full p-0.5 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 xl:pr-3",
          open && "bg-slate-100",
        )}
      >
        <UserAvatar role={role} name={name} size="sm" />
        <span className="hidden min-w-0 text-left leading-tight xl:block">
          <span className="block max-w-36 truncate text-[13px] font-semibold text-ink-900">{name ?? info.name}</span>
          <span className={cx("block text-[11px]", isOwner ? "font-semibold text-amber-700" : "text-ink-400")}>{info.name}</span>
        </span>
        <ChevronDown className={cx("hidden size-4 text-ink-400 transition-transform xl:block", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className={cx(
            "pop-in absolute z-50 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-pop",
            "right-0 top-12",
          )}
        >
          <p className="px-3 pb-1.5 pt-1 text-xs text-ink-400">{name ? `${name} · ${info.name}` : `${info.name} · ${info.hint}`}</p>
          {/* Xodim va o'qituvchida «Profilim» menyuning o'zida bor */}
          {name && isOwner ? (
            <Link href="/me" role="menuitem" onClick={close} className={cx(item, "text-ink-700 hover:bg-slate-50")}>
              <CircleUserRound className="size-4 text-rose-500" aria-hidden />
              Profilim va parol
            </Link>
          ) : null}
          <Link href="/faoliyat" role="menuitem" onClick={close} className={cx(item, "text-ink-700 hover:bg-slate-50")}>
            <History className="size-4 text-brand-600" aria-hidden />
            Faoliyat tarixi
          </Link>
          {/* Telefonda pastki menyuga sig'magan bo'limlar (kompyuterda — yon menyuda) */}
          {navFor(role)
            .filter((n) => n.mobile === false)
            .map((n) => {
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} role="menuitem" onClick={close} className={cx(item, "text-ink-700 hover:bg-slate-50 lg:hidden")}>
                  <Icon className={cx("size-4", TONE_TEXT[n.tone])} aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          <button type="button" role="menuitem" onClick={() => setTheme(!dark)} className={cx(item, "text-ink-700 hover:bg-slate-50")}>
            {dark ? <Sun className="size-4 text-amber-500" aria-hidden /> : <Moon className="size-4 text-violet-500" aria-hidden />}
            {dark ? "Yorug‘ mavzu" : "Qorong‘i mavzu"}
          </button>
          <div className="my-1 border-t border-line-soft" />
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
