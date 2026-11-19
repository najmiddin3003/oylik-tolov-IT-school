"use client";

// Ochiladigan karta: uzun ro'yxatlar (mos kelmagan to'lovlar, kelmaganlar, SMS tarixi va h.k.) sahifani egallab
// turmasligi uchun. Sarlavhada — nomi, soni va yopiq holatda qisqa ko'rinish; bosilsa liquid-glass bilan ochiladi
// (globals.css → details). Holat o'zida saqlanadi: ro'yxat o'zgarsa (masalan, farq hal qilinsa) yopilib/ochilib ketmaydi.
// Manzilda `#id` bo'lsa (masalan, /davomat#sabab) — o'zi ochiladi.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./ui";

const TONES = {
  slate: "bg-slate-100 text-ink-500",
  brand: "bg-brand-100 text-brand-700",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-700",
  emerald: "bg-emerald-100 text-emerald-700",
} as const;

export type AccordionTone = keyof typeof TONES;

export function AccordionCard({
  id,
  title,
  icon,
  count,
  tone = "slate",
  subtitle,
  preview,
  toolbar,
  defaultOpen = false,
  inset = false,
  className,
  children,
}: {
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  count?: number;
  /** Son belgisining rangi (masalan, kelmaganlar — qizil) */
  tone?: AccordionTone;
  subtitle?: ReactNode;
  /** Yopiq holatda sarlavha ostida qisqa ko'rinish (ismlar, turlar bo'yicha soni) */
  preview?: ReactNode;
  /** Ochilganda ro'yxat tepasidagi tugmalar qatori (sarlavhaga tugma qo'yilmaydi — bosilganda ochilib-yopilmasligi uchun) */
  toolbar?: ReactNode;
  defaultOpen?: boolean;
  /** Bo'lim ichidagi kichik blok (soyasiz, ixcham sarlavha) — masalan, Sozlamalardagi SMS tarixi */
  inset?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Heading = inset ? "h3" : "h2";
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDetailsElement>(null);

  // /davomat#sabab kabi havola bilan kelinsa — ochiladi
  useEffect(() => {
    if (!id) return;
    const check = () => {
      if (window.location.hash === `#${id}` && ref.current && !ref.current.open) setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);

  return (
    <section id={id} className={cx("scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface", !inset && "shadow-card", className)}>
      <details ref={ref} open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="accordion">
        <summary
          className={cx(
            "flex cursor-pointer select-none items-start gap-3 transition-colors hover:bg-slate-50/60",
            inset ? "bg-slate-50/70 px-4 py-3" : "px-5 py-4 sm:px-6 sm:py-5",
          )}
        >
          {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Heading className={inset ? "text-sm font-semibold text-ink-700" : "text-[17px] font-semibold tracking-[-0.01em] text-ink-900"}>{title}</Heading>
              {count !== undefined ? (
                <span className={cx("num inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold", TONES[tone])}>{count}</span>
              ) : null}
            </div>
            {subtitle ? <p className={cx("text-ink-500", inset ? "mt-0.5 text-xs" : "mt-1 text-sm")}>{subtitle}</p> : null}
            {!open && preview ? <p className={cx("truncate text-ink-600", inset ? "mt-1 text-xs" : "mt-1.5 text-[13px]")}>{preview}</p> : null}
          </div>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-500">
            <span className="hidden sm:inline">{open ? "Yopish" : "Ko‘rsatish"}</span>
            <ChevronDown className="accordion-chevron size-[18px] text-ink-400" aria-hidden />
          </span>
        </summary>
        <div className="border-t border-line-soft">
          {toolbar ? <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-slate-50/60 px-5 py-3 sm:px-6">{toolbar}</div> : null}
          {children}
        </div>
      </details>
    </section>
  );
}
