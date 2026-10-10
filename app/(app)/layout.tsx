import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2, ChartColumn, ShieldCheck } from "lucide-react";
import { BottomNav } from "@/components/NavLinks";
import {
  BellFallback,
  HeaderBell,
  HeaderMonthServer,
  SidebarNavServer,
  StaticNav,
  UserMenu,
} from "@/components/ShellParts";
import { Breadcrumb, BreadcrumbFallback, HeaderSearch, MonthPillSkeleton } from "@/components/TopBar";
import { BrandName, LogoMark } from "@/components/ui";

const CENTER_NAME = process.env.CENTER_NAME || "Asosiy markaz";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen lg:pl-[264px]">
      {/* Kompyuter: chap menyu */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col overflow-y-auto border-r border-line bg-white px-6 pb-5 pt-7 lg:flex">
        <Link href="/" className="flex items-center gap-3.5">
          <LogoMark className="size-12" />
          <span className="leading-tight">
            <BrandName className="block text-lg" />
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">O‘quv markazi</span>
          </span>
        </Link>

        <div className="mt-7 flex items-center gap-3 rounded-2xl border border-line px-3 py-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-slate-50 text-ink-500" aria-hidden>
            <Building2 className="size-[18px]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold text-ink-900">{CENTER_NAME}</span>
            <span className="mt-0.5 block text-xs text-ink-400">Boshqaruv maydoni</span>
          </span>
        </div>

        <p className="mb-3 mt-8 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">Ish maydoni</p>
        <nav className="flex flex-col gap-1.5" aria-label="Asosiy menyu">
          <Suspense fallback={<StaticNav />}>
            <SidebarNavServer />
          </Suspense>
        </nav>

        <div className="mt-auto pt-8">
          <div className="relative overflow-hidden rounded-2xl border border-brand-100/70 bg-[linear-gradient(160deg,#f5f6ff_0%,#eceeff_100%)] p-4">
            <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full border-[14px] border-white/60" aria-hidden />
            <span className="relative inline-flex size-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card" aria-hidden>
              <ChartColumn className="size-[18px]" strokeWidth={1.8} />
            </span>
            <p className="relative mt-4 text-[15px] font-semibold text-ink-900">
              Har bir to‘lov muhim<span className="text-brand-600">.</span>
            </p>
            <p className="relative mt-1.5 text-[13px] leading-relaxed text-ink-500">O‘quvchilar va to‘lovlar — bitta tartibli maydonda.</p>
            <Link href="/sync" className="relative mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-800">
              Sheets bilan solishtirish
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-ink-700" aria-hidden>
              A
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-semibold text-ink-900">Administrator</span>
              <span className="mt-0.5 block truncate text-xs text-ink-400">Markaz boshqaruvchisi</span>
            </span>
            <UserMenu placement="sidebar" />
          </div>
        </div>
      </aside>

      {/* Yuqori panel */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 lg:hidden" aria-label="Bosh sahifa">
            <LogoMark className="size-9 rounded-xl" />
            <BrandName className="hidden text-base sm:inline" />
          </Link>
          <div className="hidden min-w-0 lg:block">
            <Suspense fallback={<BreadcrumbFallback />}>
              <Breadcrumb />
            </Suspense>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Suspense fallback={null}>
              <HeaderSearch />
            </Suspense>
            <span className="hidden h-7 w-px bg-line md:block" aria-hidden />
            <Suspense fallback={<MonthPillSkeleton />}>
              <HeaderMonthServer />
            </Suspense>
            <Suspense fallback={<BellFallback />}>
              <HeaderBell />
            </Suspense>
            <div className="lg:hidden">
              <UserMenu placement="header" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-10">
        {children}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden />
            Ma’lumotlar xavfsiz bazada saqlanadi va har kuni Google Sheets bilan solishtiriladi.
          </span>
          <span>To‘lov nazorati / O‘quv markaz</span>
        </footer>
      </main>

      {/* Telefon: pastki menyu */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Asosiy menyu">
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </nav>
    </div>
  );
}
