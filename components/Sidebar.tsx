"use client";

// Yon menyu boshqaruvi: kengligini surib o'zgartirish, ixcham (faqat ikonkalar) yoki to'liq yopish.
// Holat <html data-sb> va --sb-w orqali CSS bilan ko'rsatiladi (React qayta chizmaydi) va localStorage'da saqlanadi.
import { useEffect, type KeyboardEvent, type PointerEvent } from "react";
import { PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  SIDEBAR_DEFAULT as DEFAULT,
  SIDEBAR_KEY as KEY,
  SIDEBAR_MAX as MAX,
  SIDEBAR_MIN as MIN,
  SIDEBAR_RAIL as RAIL,
} from "./sidebar-state";
import { cx } from "./ui";

type Mode = "full" | "rail" | "hidden";
type State = { mode: Mode; width: number; prev: "full" | "rail" };

const SNAP = 150; // shundan torroq surilsa — ixcham rejim

const clamp = (w: number) => Math.min(MAX, Math.max(MIN, Math.round(w)));

function read(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<State> | null;
    if (s && (s.mode === "full" || s.mode === "rail" || s.mode === "hidden")) {
      return { mode: s.mode, width: clamp(s.width ?? DEFAULT), prev: s.prev === "rail" ? "rail" : "full" };
    }
  } catch {
    // localStorage yopiq bo'lishi mumkin (maxfiy rejim) — standart holat
  }
  const attr = document.documentElement.dataset.sb;
  return { mode: attr === "rail" || attr === "hidden" ? attr : "full", width: DEFAULT, prev: "full" };
}

function widthOf(s: State) {
  return s.mode === "rail" ? RAIL : s.mode === "hidden" ? 0 : s.width;
}

function apply(s: State) {
  const d = document.documentElement;
  d.dataset.sb = s.mode;
  d.style.setProperty("--sb-w", `${widthOf(s)}px`);
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // saqlab bo'lmasa ham ishlayveradi
  }
}

/** To'liq yopish / qayta ochish (Ctrl+B). */
export function toggleSidebar() {
  const s = read();
  apply(s.mode === "hidden" ? { ...s, mode: s.prev } : { ...s, prev: s.mode, mode: "hidden" });
}

/** Ixcham (faqat ikonkalar) <-> to'liq. */
function toggleRail() {
  const s = read();
  apply(s.mode === "rail" ? { ...s, mode: "full", prev: "full" } : { ...s, mode: "rail", prev: "rail" });
}

/** Ctrl+B / Cmd+B — menyuni yopish/ochish. */
export function SidebarHotkeys() {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        const el = e.target as HTMLElement | null;
        if (el?.isContentEditable) return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

/** Yuqori paneldagi tugma: menyuni to'liq yopish/ochish (kompyuterda). */
export function SidebarToggleButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cx(
        "hidden size-10 shrink-0 items-center justify-center rounded-xl text-ink-500 transition hover:bg-slate-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-brand-600 lg:inline-flex",
        className,
      )}
      aria-label="Menyuni yopish yoki ochish (Ctrl+B)"
      title="Menyuni yopish / ochish (Ctrl+B)"
    >
      <PanelLeft className="size-5" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

/** Menyu ichidagi tugma: ixcham (faqat ikonkalar) <-> to'liq. */
export function SidebarRailButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={toggleRail}
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-slate-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-brand-600",
        className,
      )}
      aria-label="Menyuni ixchamlashtirish yoki kengaytirish"
      title="Ixcham / keng menyu"
    >
      <PanelLeftClose className="size-[18px] sb-rail:hidden" strokeWidth={1.8} aria-hidden />
      <PanelLeftOpen className="hidden size-[18px] sb-rail:block" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

/** Menyuning o'ng chetidagi tutqich: surib kengligini o'zgartirish; ikki marta bosilsa — standart kenglik. */
export function SidebarResizer() {
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const d = document.documentElement;
    const start = read();
    const startX = e.clientX;
    const startW = widthOf(start);
    let last: State = start;
    d.dataset.sbDrag = "1";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (ev: globalThis.PointerEvent) => {
      const w = startW + (ev.clientX - startX);
      last = w < SNAP ? { ...last, mode: "rail", prev: "rail" } : { ...last, mode: "full", prev: "full", width: clamp(w) };
      d.dataset.sb = last.mode;
      d.style.setProperty("--sb-w", `${widthOf(last)}px`);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      delete d.dataset.sbDrag;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      apply(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const s = read();
    if (s.mode === "rail") {
      // Ixcham rejimdan o'ngga — eng tor to'liq menyu
      if (e.key === "ArrowRight") apply({ ...s, mode: "full", prev: "full", width: MIN });
      return;
    }
    const w = widthOf(s) + (e.key === "ArrowRight" ? 16 : -16);
    // Eng tor kenglikdan ham chapga bosilsa — ixcham rejim
    apply(w < MIN ? { ...s, mode: "rail", prev: "rail" } : { ...s, mode: "full", prev: "full", width: clamp(w) });
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Menyu kengligi (surib o‘zgartiring, ikki marta bosing — asl holat)"
      title="Surib kengligini o‘zgartiring · ikki marta bosing — asl holat"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => apply({ mode: "full", width: DEFAULT, prev: "full" })}
      onKeyDown={onKeyDown}
      className="sb-anim group fixed inset-y-0 z-40 hidden w-3 -translate-x-1/2 cursor-col-resize focus:outline-none lg:block sb-hidden:hidden"
      style={{ left: "var(--sb-w)" }}
    >
      <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-transparent transition group-hover:bg-brand-300 group-focus-visible:bg-brand-400 group-active:bg-brand-500" />
    </div>
  );
}
