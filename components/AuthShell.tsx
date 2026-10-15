// Kirish va ro'yxatdan o'tish sahifalarining umumiy ko'rinishi.
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { BrandName, LogoMark } from "./ui";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <span className="pointer-events-none absolute -left-40 -top-40 size-[480px] rounded-full bg-brand-100/50 blur-3xl" aria-hidden />
      <span className="pointer-events-none absolute -bottom-48 -right-32 size-[420px] rounded-full bg-brand-50 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-14 rounded-2xl" />
          <h1 className="mt-5 text-2xl">
            <BrandName />
          </h1>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-400">O‘quv markazi</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-card">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
          <p className="mb-6 mt-1 text-sm text-ink-500">{subtitle}</p>
          {children}
        </div>
        {footer ? <div className="mt-4">{footer}</div> : null}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-400">
          <ShieldCheck className="size-3.5" aria-hidden />
          Ma’lumotlar xavfsiz bazada saqlanadi
        </p>
      </div>
    </main>
  );
}
