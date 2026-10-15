import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, CodeXml, Languages, Monitor, Palette, ReceiptText, Sigma, type LucideIcon } from "lucide-react";
import type { PayStatus } from "@/lib/data";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export const btn = {
  primary: `inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-[15px] font-semibold text-white shadow-brand transition hover:bg-brand-700 disabled:opacity-60 ${focus}`,
  outline: `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px] font-medium text-ink-800 shadow-card transition hover:border-ink-300/60 hover:bg-slate-50 disabled:opacity-60 ${focus}`,
  soft: `inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-50 px-5 text-[15px] font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60 ${focus}`,
  danger: `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-surface px-4 text-[15px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 ${focus}`,
  sm: `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 ${focus}`,
  icon: `inline-flex size-9 items-center justify-center rounded-lg text-ink-400 transition hover:bg-slate-100 hover:text-ink-900 disabled:opacity-60 ${focus}`,
  iconDanger: `inline-flex size-9 items-center justify-center rounded-lg text-ink-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 ${focus}`,
  link: "inline-flex items-center gap-1.5 text-[15px] font-medium text-brand-600 transition hover:text-brand-800",
};

export const inputCls =
  "block h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink-900 shadow-card transition placeholder:text-ink-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 aria-invalid:border-rose-400";

export const labelCls = "mb-2 block text-sm font-medium text-ink-700";

export const th = "px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-400";
export const td = "px-6 py-4 text-sm text-ink-700";

// ---------- Sahifa tuzilmasi ----------

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{eyebrow}</p>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-ink-900 sm:text-[34px]">{title}</h1>
        {subtitle ? <p className="mt-2.5 text-[15px] text-ink-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("rounded-2xl border border-line bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function CountBadge({ n, tone = "slate" }: { n: number | string; tone?: "slate" | "brand" }) {
  return (
    <span
      className={cx(
        "num inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
        tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-ink-500",
      )}
    >
      {n}
    </span>
  );
}

export function CardHeader({
  title,
  count,
  subtitle,
  right,
}: {
  title: ReactNode;
  count?: number;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
          {title}
          {count !== undefined ? <CountBadge n={count} /> : null}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink-500">
      {children}
    </span>
  );
}

// ---------- Holat belgilari ----------

const STATUS: Record<PayStatus, { label: string; cls: string; dot: string }> = {
  paid: { label: "To‘lagan", cls: "bg-emerald-50 text-emerald-700", dot: "bg-paid" },
  partial: { label: "Qisman", cls: "bg-brand-50 text-brand-700", dot: "bg-partial" },
  unpaid: { label: "To‘lamagan", cls: "bg-amber-50 text-amber-700", dot: "bg-unpaid" },
};

export function StatusBadge({ status }: { status: PayStatus }) {
  const s = STATUS[status];
  return (
    <span className={cx("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium", s.cls)}>
      <span className={cx("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

export function Tag({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "brand" | "amber" | "rose" | "emerald" }) {
  const tones = {
    slate: "bg-slate-100 text-ink-600",
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

// ---------- O'quvchi: avatar va guruh ----------

const AVATAR_TONES = [
  "bg-brand-50 text-brand-600",
  "bg-orange-50 text-orange-600",
  "bg-violet-50 text-violet-600",
  "bg-emerald-50 text-emerald-600",
  "bg-sky-50 text-sky-600",
  "bg-rose-50 text-rose-600",
];

export function initials(name: string): string {
  const parts = name.replace(/[ʻʼ'`‘’]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "lg" ? "size-14 text-lg" : "size-10 text-sm",
        AVATAR_TONES[h % AVATAR_TONES.length],
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function GroupIcon({ group }: { group: string }) {
  const g = group.toLowerCase();
  const cls = "size-3.5 shrink-0 text-ink-400";
  if (/web|dastur|front|backend|python|java|kod/.test(g)) return <CodeXml className={cls} aria-hidden />;
  if (/dizayn|grafik|design/.test(g)) return <Palette className={cls} aria-hidden />;
  if (/kompyuter|savod|\bks\b/.test(g)) return <Monitor className={cls} aria-hidden />;
  if (/ingliz|english|til|rus/.test(g)) return <Languages className={cls} aria-hidden />;
  if (/matem|math/.test(g)) return <Sigma className={cls} aria-hidden />;
  return <BookOpen className={cls} aria-hidden />;
}

export function GroupChip({ name }: { name: string }) {
  if (!name) return <span className="text-ink-300">—</span>;
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-line bg-slate-50/70 px-2.5 text-[13px] font-medium text-ink-600">
      <GroupIcon group={name} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** To'lov izohi: Sheets'dan import qilinganida takrorlanuvchi "Google Sheets, " qismi olib tashlanadi. */
export function NoteCell({ note, source }: { note: string; source: "site" | "sheets" }) {
  const text = source === "sheets" ? note.replace(/^Google Sheets,?\s*/, "") : note;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {source === "sheets" ? <Tag tone="emerald">Sheets</Tag> : null}
      <span className="truncate" title={note}>
        {text || (source === "sheets" ? "" : "—")}
      </span>
    </span>
  );
}

export function studentCode(seq: number | null | undefined): string {
  return seq ? `#${String(seq).padStart(3, "0")}` : "";
}

export function Progress({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full bg-line-soft", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- Jonli ikonkalar ----------

/** Ikonka rangi (bo'limlar: bosh sahifa — brand, o'quvchilar — violet, to'lovlar — emerald, Sheets — teal, sozlamalar — amber). */
export type Tone = "slate" | "emerald" | "amber" | "brand" | "sky" | "violet" | "teal" | "rose" | "orange";

const TILE_SOFT: Record<Tone, string> = {
  slate: "bg-linear-to-br from-slate-50 to-slate-100 text-ink-600 ring-slate-200/70",
  emerald: "bg-linear-to-br from-emerald-50 to-emerald-100/80 text-emerald-600 ring-emerald-200/60",
  amber: "bg-linear-to-br from-amber-50 to-amber-100/80 text-amber-600 ring-amber-200/60",
  brand: "bg-linear-to-br from-brand-50 to-brand-100/80 text-brand-600 ring-brand-200/60",
  sky: "bg-linear-to-br from-sky-50 to-sky-100/80 text-sky-600 ring-sky-200/60",
  violet: "bg-linear-to-br from-violet-50 to-violet-100/80 text-violet-600 ring-violet-200/60",
  teal: "bg-linear-to-br from-teal-50 to-teal-100/80 text-teal-600 ring-teal-200/60",
  rose: "bg-linear-to-br from-rose-50 to-rose-100/80 text-rose-600 ring-rose-200/60",
  orange: "bg-linear-to-br from-orange-50 to-orange-100/80 text-orange-600 ring-orange-200/60",
};

const TILE_SOLID: Record<Tone, string> = {
  slate: "bg-linear-to-br from-slate-500 to-slate-700 text-white ring-white/10 shadow-[0_8px_16px_-8px_rgb(51_65_85/0.8)]",
  emerald: "bg-linear-to-br from-emerald-400 to-emerald-600 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(5_150_105/0.85)]",
  amber: "bg-linear-to-br from-amber-400 to-orange-500 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(234_88_12/0.8)]",
  brand: "bg-linear-to-br from-brand-400 to-brand-700 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(43_58_255/0.85)]",
  sky: "bg-linear-to-br from-sky-400 to-sky-600 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(2_132_199/0.85)]",
  violet: "bg-linear-to-br from-violet-400 to-violet-600 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(124_58_237/0.85)]",
  teal: "bg-linear-to-br from-teal-400 to-emerald-600 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(13_148_136/0.85)]",
  rose: "bg-linear-to-br from-rose-400 to-rose-600 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(225_29_72/0.85)]",
  orange: "bg-linear-to-br from-orange-400 to-orange-600 text-white ring-white/15 shadow-[0_8px_16px_-8px_rgb(234_88_12/0.85)]",
};

const TILE_SIZE = {
  sm: { box: "size-8 rounded-[10px]", icon: "size-[17px]" },
  md: { box: "size-10 rounded-xl", icon: "size-5" },
  lg: { box: "size-12 rounded-2xl", icon: "size-6" },
  xl: { box: "size-14 rounded-2xl", icon: "size-7" },
};

/**
 * Rangli ikonka plitkasi: yumshoq gradient fon, ikki tusli (duotone) ikonka va
 * kursor kelganda yengil "jonlanish" (guruh ichida — `group` sinfi bo'lsa).
 */
export function IconTile({
  icon: Icon,
  tone = "brand",
  variant = "soft",
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  tone?: Tone;
  variant?: "soft" | "solid";
  size?: keyof typeof TILE_SIZE;
  className?: string;
}) {
  const s = TILE_SIZE[size];
  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-inset transition-[transform,box-shadow] duration-300",
        s.box,
        variant === "solid" ? TILE_SOLID[tone] : TILE_SOFT[tone],
        className,
      )}
      aria-hidden
    >
      {/* yuqori chap burchakdagi yaltiroq */}
      <span className="pointer-events-none absolute -left-1/4 -top-1/2 h-full w-[150%] rotate-[-18deg] bg-white/25 dark:bg-white/[0.06]" />
      <Icon
        className={cx("icon-wiggle relative", s.icon)}
        strokeWidth={1.9}
        fill="currentColor"
        fillOpacity={variant === "solid" ? 0.22 : 0.16}
      />
    </span>
  );
}

// ---------- Statistik kartalar ----------

/** Katta raqamli karta (bosh sahifa). */
export function KpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="group flex min-h-[148px] flex-col p-5 transition hover:shadow-pop sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-medium text-ink-600">{label}</p>
        <IconTile icon={icon} tone={tone} />
      </div>
      <p className="num mt-3 text-[32px] font-bold leading-none tracking-[-0.02em] text-ink-900">
        {value}
        {unit ? <span className="ml-1 text-lg font-semibold text-ink-500">{unit}</span> : null}
      </p>
      {hint ? <div className="mt-auto pt-3 text-[13px] text-ink-500">{hint}</div> : null}
    </Card>
  );
}

export type ShareLine = { label: string; value: string; strong?: boolean; negative?: boolean };

/** Ko'k asosiy karta ("Jami tushum"). Ostida ulush qatorlari (faqat rahbarga): 40%, olindi, qoldi. */
export function HeroKpiCard({
  label,
  value,
  unit,
  badge,
  hint,
  share,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  badge?: string;
  hint?: ReactNode;
  share?: ShareLine[];
  icon: LucideIcon;
}) {
  return (
    <section className="group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#3b49ff_0%,#2534ee_55%,#1d27c9_100%)] p-5 text-white shadow-brand sm:p-6">
      <span className="pointer-events-none absolute -right-12 -top-20 h-64 w-40 rotate-[35deg] rounded-[44px] bg-white/[0.08]" aria-hidden />
      <span className="pointer-events-none absolute -bottom-28 right-24 h-56 w-36 rotate-[35deg] rounded-[40px] bg-white/[0.06]" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[15px] font-medium text-white/85">{label}</p>
        <span className="relative inline-flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-inset ring-white/20" aria-hidden>
          <Icon className="icon-wiggle size-5" strokeWidth={1.9} fill="currentColor" fillOpacity={0.25} />
        </span>
      </div>
      <p className="num relative mt-3 text-[32px] font-bold leading-none tracking-[-0.02em]">
        {value}
        {unit ? <span className="ml-1 text-lg font-semibold text-white/85">{unit}</span> : null}
      </p>
      {share?.length ? (
        <dl className="relative mt-3 grid gap-1 rounded-xl bg-white/[0.12] px-3 py-2 text-[13px] ring-1 ring-inset ring-white/10">
          {share.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2">
              <dt className="min-w-0 truncate whitespace-nowrap text-white/80">{s.label}</dt>
              <dd className={cx("num whitespace-nowrap", s.strong ? "font-bold text-white" : "font-semibold text-white/95", s.negative && "text-[#fecdd3]")}>{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="relative mt-auto flex items-center gap-2 pt-3 text-[13px] text-white/80">
        {badge ? <span className="num rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-semibold text-white">{badge}</span> : null}
        {hint}
      </p>
    </section>
  );
}

/** Ixcham karta: chapda ikonka, o'ngda nom va qiymat (o'quvchilar / to'lovlar sahifasi). */
export function MiniStat({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** Qiymat ostidagi qo'shimcha qator */
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="group flex items-center gap-4 p-5 transition hover:shadow-pop">
      <IconTile icon={icon} tone={tone} size="lg" />
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-500">{label}</p>
        <p className="num mt-0.5 truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
          {value}
          {unit ? <span className="ml-1 text-sm font-medium text-ink-400">{unit}</span> : null}
        </p>
        {hint ? <div className="num mt-1 truncate text-[13px] text-ink-500">{hint}</div> : null}
      </div>
    </Card>
  );
}

// ---------- Bo'sh holat, skelet, sahifalash ----------

export function EmptyState({
  title,
  children,
  icon = ReceiptText,
  tone = "brand",
}: {
  title: string;
  children?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="group flex flex-col items-center px-6 py-14 text-center">
      <IconTile icon={icon} tone={tone} size="xl" className="mb-4" />
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {children ? <div className="mt-1.5 max-w-sm text-sm text-ink-500">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      <Skeleton className="mb-3 h-3 w-36" />
      <Skeleton className="mb-3 h-9 w-64" />
      <Skeleton className="mb-8 h-4 w-96 max-w-full" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) {
    return (
      <span className="flex items-center gap-2 text-[13px] text-ink-400">
        1-sahifa
        <span className="num inline-flex size-8 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-700">1</span>
      </span>
    );
  }
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  return (
    <nav className="flex items-center gap-1.5 text-[13px] text-ink-400" aria-label="Sahifalar">
      <span className="mr-1">{page}-sahifa</span>
      {nums.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - nums[i - 1] > 1 ? <span aria-hidden>…</span> : null}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cx(
              "num inline-flex size-8 items-center justify-center rounded-lg text-sm font-semibold transition",
              p === page ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-slate-100",
            )}
          >
            {p}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function LogoMark({ className = "size-12" }: { className?: string }) {
  return (
    <span className={cx("flex items-center justify-center rounded-[14px] bg-brand-600 text-white shadow-brand", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[52%]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
        <path d="M9 9.5l2 2 4-4" />
        <path d="M9 15h6" />
      </svg>
    </span>
  );
}

export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={cx("font-bold tracking-[-0.02em] text-ink-900", className)}>
      To‘lov nazorati<span className="text-brand-600">.</span>
    </span>
  );
}
