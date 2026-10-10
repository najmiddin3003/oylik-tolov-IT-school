// Ilova qobig'ining server qismlari (ma'lumot o'qiydi — Suspense ichida ishlatiladi).
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Bell, LogOut, Settings, Sheet, TriangleAlert } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { pageGuard } from "@/lib/auth";
import { getNavCounts, getSyncAlert } from "@/lib/data";
import { currentMonth, formatDateTime } from "@/lib/time";
import { NAV } from "./nav";
import { SidebarNav } from "./NavLinks";
import { HeaderMonth } from "./TopBar";
import { btn, cx } from "./ui";

export async function SidebarNavServer() {
  await pageGuard();
  const counts = await getNavCounts();
  return <SidebarNav counts={counts} />;
}

/** Ma'lumot yuklanguncha ko'rinadigan oddiy menyu (hook'larsiz). */
export function StaticNav() {
  return (
    <>
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="flex h-12 items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium text-ink-600">
            <Icon className="size-5 text-ink-400" strokeWidth={1.8} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export async function HeaderMonthServer() {
  await connection();
  return <HeaderMonth fallbackMonth={currentMonth()} />;
}

function BellLink({ alert }: { alert: { unresolved: number; error: string } | null }) {
  const label = !alert
    ? "Bildirishnomalar: yangi xabar yo‘q"
    : alert.error
      ? "Bildirishnoma: Sheets tekshiruvi bajarilmadi"
      : `Bildirishnoma: Sheets bilan ${alert.unresolved} ta farq`;
  return (
    <Link href="/sync" className={cx(btn.icon, "relative size-10 text-ink-500")} aria-label={label} title={label}>
      <Bell className="size-5" strokeWidth={1.8} aria-hidden />
      {alert ? <span className="absolute right-2 top-2 size-2 rounded-full bg-unpaid ring-2 ring-white" aria-hidden /> : null}
    </Link>
  );
}

export function BellFallback() {
  return <BellLink alert={null} />;
}

export async function HeaderBell() {
  await pageGuard();
  return <BellLink alert={await getSyncAlert()} />;
}

/** Oxirgi Sheets tekshiruvida farq yoki xato bo'lsa — sahifa sarlavhasi ostida ogohlantirish. */
export async function SyncAlert() {
  await pageGuard();
  const alert = await getSyncAlert();
  if (!alert) return null;
  const isError = Boolean(alert.error);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 sm:px-5" role="status">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600" aria-hidden>
        <TriangleAlert className="size-[18px]" strokeWidth={2} />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-relaxed">
        <span className="font-semibold text-amber-900">
          {isError ? "Google Sheets tekshiruvi bajarilmadi" : `Sayt va Google Sheets o‘rtasida ${alert.unresolved} ta farq bor`}
        </span>
        <span className="ml-2 text-amber-800/75">{isError ? alert.error : `Oxirgi tekshiruv: ${formatDateTime(alert.at)}`}</span>
      </p>
      <Link href="/sync" className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 transition hover:text-amber-950">
        {isError ? "Sozlash" : "Ko‘rish"}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

/** Foydalanuvchi menyusi: sozlamalar va chiqish. */
export function UserMenu({ placement }: { placement: "sidebar" | "header" }) {
  return (
    <details className="group relative">
      <summary
        className={cx(
          "list-none [&::-webkit-details-marker]:hidden",
          placement === "sidebar"
            ? cx(btn.icon, "cursor-pointer")
            : "inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-ink-700",
        )}
        aria-label="Foydalanuvchi menyusi"
      >
        {placement === "sidebar" ? <Settings className="size-[18px]" strokeWidth={1.8} aria-hidden /> : "A"}
      </summary>
      <div
        className={cx(
          "absolute z-40 w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop",
          placement === "sidebar" ? "bottom-11 right-0" : "right-0 top-12",
        )}
      >
        <Link href="/sync#sozlamalar" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-slate-50">
          <Sheet className="size-4 text-ink-400" aria-hidden />
          Sheets sozlamalari
        </Link>
        <form action={logout}>
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50">
            <LogOut className="size-4" aria-hidden />
            Chiqish
          </button>
        </form>
      </div>
    </details>
  );
}
