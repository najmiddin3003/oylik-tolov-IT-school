import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import {
  HeaderBreadcrumb,
  HeaderHistory,
  HeaderTools,
  HeaderToolsFallback,
  MobileNav,
  SidebarBody,
  SidebarSkeleton,
} from "@/components/ShellParts";
import { HistoryNavPlaceholder } from "@/components/HistoryNav";
import { PerfWatcher } from "@/components/PerfWatcher";
import { SidebarHotkeys, SidebarRailButton, SidebarResizer, SidebarToggleButton } from "@/components/Sidebar";
import { BreadcrumbFallback } from "@/components/TopBar";
import { BrandName, LogoMark } from "@/components/ui";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <SidebarHotkeys />
      <PerfWatcher />

      {/*
        Kompyuter: chap menyu (surib kengligini o'zgartirish, ixchamlashtirish yoki yopish mumkin).
        Ekran past bo'lsa ham to'liq ko'rinadi: logotip tepada, foydalanuvchi pastda, o'rtasi aylanadi.
      */}
      <aside className="sb-aside sb-anim fixed inset-y-0 left-0 z-30 hidden w-[var(--sb-w)] flex-col overflow-hidden border-r border-line bg-surface lg:flex">
        <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-5 sb-rail:flex-col sb-rail:gap-4 sb-rail:px-3">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Bosh sahifa">
            <LogoMark className="size-11 shrink-0" />
            <span className="min-w-0 leading-tight sb-rail:hidden">
              <BrandName className="block whitespace-nowrap text-[17px]" />
              <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">O‘quv markazi</span>
            </span>
          </Link>
          <SidebarRailButton className="ml-auto sb-rail:ml-0" />
        </div>
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarBody />
        </Suspense>
      </aside>
      <SidebarResizer />

      <div className="sb-anim lg:pl-[var(--sb-w)]">
        {/* Yuqori panel */}
        <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden" aria-label="Bosh sahifa">
              <LogoMark className="size-9 rounded-xl" />
              <BrandName className="hidden text-base sm:inline" />
            </Link>
            <SidebarToggleButton className="-ml-2" />
            {/* Kirilgan sahifalar orasida «Orqaga / Oldinga» (telefonda joy tor — ko'rsatilmaydi) */}
            <div className="hidden sm:block">
              <Suspense fallback={<HistoryNavPlaceholder />}>
                <HeaderHistory />
              </Suspense>
            </div>
            <div className="hidden min-w-0 lg:block">
              <Suspense fallback={<BreadcrumbFallback />}>
                <HeaderBreadcrumb />
              </Suspense>
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <Suspense fallback={<HeaderToolsFallback />}>
                <HeaderTools />
              </Suspense>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-10">
          {children}
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden />
              Ma’lumotlar xavfsiz bazada saqlanadi va har kuni Google Sheets bilan solishtiriladi.
            </span>
            <span>To‘lov nazorati / O‘quv markaz</span>
          </footer>
        </main>
      </div>

      {/* Telefon: pastki menyu */}
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
