import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { NAV, NavIcon } from "@/components/nav";
import { NavLinks } from "@/components/NavLinks";
import { SyncAlert } from "@/components/SyncAlert";
import { LogoMark } from "@/components/ui";

function StaticNav() {
  // usePathname tayyor bo'lguncha ko'rinadigan oddiy menyu
  return (
    <>
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
          <NavIcon d={item.icon} />
          {item.label}
        </Link>
      ))}
    </>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen lg:pl-60">
      {/* Kompyuter: chap menyu */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 py-5">
          <LogoMark />
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-slate-900">To&apos;lov nazorati</span>
            <span className="block text-xs text-slate-500">O&apos;quv markaz</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Asosiy menyu">
          <Suspense fallback={<StaticNav />}>
            <NavLinks variant="side" />
          </Suspense>
        </nav>
        <form action={logout} className="border-t border-slate-100 p-3">
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <NavIcon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            Chiqish
          </button>
        </form>
      </aside>

      {/* Telefon: yuqori panel */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="size-8" />
          <span className="text-sm font-semibold text-slate-900">To&apos;lov nazorati</span>
        </Link>
        <form action={logout}>
          <button type="submit" className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Chiqish
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
        <Suspense fallback={null}>
          <SyncAlert />
        </Suspense>
        {children}
      </main>

      {/* Telefon: pastki menyu */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Asosiy menyu">
        <Suspense fallback={null}>
          <NavLinks variant="bottom" />
        </Suspense>
      </nav>
    </div>
  );
}
