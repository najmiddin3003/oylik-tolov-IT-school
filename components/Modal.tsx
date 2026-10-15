"use client";

// Modal oyna: brauzerning <dialog> elementi (fokus, Esc, orqa fon) + ochilish/yopilish animatsiyasi (globals.css).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { btn, cx, IconTile, type Tone } from "./ui";

/** Yopilish animatsiyasi davomiyligi (globals.css dagi dialog transition bilan bir xil). */
const EXIT_MS = 240;

/**
 * <dialog> ni `open` bo'yicha ochadi/yopadi. `present` — ichki qism chizilishi kerakmi:
 * yopilgandan keyin ham animatsiya tugaguncha true bo'lib turadi (oyna bo'sh holda so'nmasligi uchun).
 */
export function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (open) return;
    const t = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);
  return { ref, present: open || present };
}

export function Modal({
  open,
  onClose,
  labelledBy,
  size = "md",
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const { ref, present } = useDialog(open);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={labelledBy}
      className={cx(
        "m-auto max-h-[min(780px,calc(100dvh-2rem))] w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink-700 shadow-pop",
        size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-xl",
        className,
      )}
    >
      {present ? <div className="flex max-h-[min(780px,calc(100dvh-2rem))] flex-col">{children}</div> : null}
    </dialog>
  );
}

export function ModalHeader({
  id,
  icon,
  tone = "brand",
  title,
  subtitle,
  onClose,
}: {
  id: string;
  icon: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="group flex items-start gap-3.5 border-b border-line-soft px-5 py-4 sm:px-6">
      <IconTile icon={icon} tone={tone} variant="solid" />
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      <button type="button" onClick={onClose} className={btn.icon} aria-label="Yopish">
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** Modal tanasi (aylantiriladigan qism). */
export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6", className)}>{children}</div>;
}
