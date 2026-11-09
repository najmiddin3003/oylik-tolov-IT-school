// Ilova qobig'ining server qismlari (sessiya va ma'lumot o'qiydi — Suspense ichida ishlatiladi).
import { Building2 } from "lucide-react";
import { pageGuard } from "@/lib/auth";
import { getBellExtras, getNavCounts, getReminders, getSyncAlert } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { currentMonth } from "@/lib/time";
import { HistoryNav } from "./HistoryNav";
import { navFor } from "./nav";
import { BottomNav, SidebarNav } from "./NavLinks";
import { NotificationBell } from "./Notifications";
import { Breadcrumb, HeaderMonth, HeaderSearch } from "./TopBar";
import { IconTile, Skeleton } from "./ui";
import { UserMenu } from "./UserMenu";

/** Yon menyu tarkibi: markaz va bo'limlar (ekran past bo'lsa aylanadi). Akkaunt — yuqori panelda (bitta joyda). */
export async function SidebarBody() {
  const { role } = await pageGuard();
  const [counts, settings] = await Promise.all([getNavCounts(), getSettings()]);
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5 sb-rail:px-3">
      <div className="group mt-2 flex items-center gap-3 rounded-2xl border border-line px-3 py-3 sb-rail:hidden">
        <IconTile icon={Building2} tone="slate" size="sm" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate whitespace-nowrap text-[15px] font-semibold text-ink-900">{settings.centerName}</span>
          <span className="mt-0.5 block whitespace-nowrap text-xs text-ink-400">
            {role === "owner" ? "Rahbar boshqaruvi" : role === "teacher" ? "O‘qituvchi maydoni" : "To‘lovlar va o‘quvchilar"}
          </span>
        </span>
      </div>

      <p className="mb-2.5 mt-6 whitespace-nowrap px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400 sb-rail:hidden">Ish maydoni</p>
      <nav className="flex flex-col gap-1 sb-rail:mt-4 sb-rail:items-stretch" aria-label="Asosiy menyu">
        <SidebarNav counts={counts} role={role} />
      </nav>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="min-h-0 flex-1 px-5 sb-rail:px-3" aria-hidden>
      <div className="mt-2 grid gap-2">
        <Skeleton className="h-16 rounded-2xl sb-rail:hidden" />
        <Skeleton className="mt-6 h-3 w-24 sb-rail:hidden" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Yuqori panelning o'ng qismi: qidiruv (rahbar, o'qituvchi), oy tanlagich, mavzu, bildirishnomalar, foydalanuvchi. */
export async function HeaderTools() {
  const { role, name } = await pageGuard();
  const [reminders, sync, extras] = await Promise.all([getReminders(), getSyncAlert(), getBellExtras()]);
  const canSearch = role === "owner" || role === "teacher";
  return (
    <>
      {canSearch ? <HeaderSearch /> : null}
      <HeaderMonth fallbackMonth={currentMonth()} />
      <span className="mx-0.5 hidden h-6 w-px bg-line sm:block" aria-hidden />
      <NotificationBell reminders={reminders} sync={sync} role={role} tasks={extras.tasks} sent={extras.sent} />
      <UserMenu role={role} name={name} />
    </>
  );
}

export function HeaderToolsFallback() {
  return (
    <>
      <div className="skeleton h-10 w-44 rounded-full sm:w-52" aria-hidden />
      <div className="skeleton size-10 rounded-full" aria-hidden />
      <div className="skeleton size-9 rounded-full" aria-hidden />
    </>
  );
}

/** «Orqaga / Oldinga» tugmalari: tarix har xodimga alohida (bitta kompyuterdan bir necha kishi kirsa — aralashmaydi). */
export async function HeaderHistory() {
  const { role, staffId } = await pageGuard();
  return <HistoryNav storageKey={`tt-history:${staffId ?? role}`} role={role} />;
}

/** Yuqoridagi yo'l ko'rsatkich (rolga xos bo'lim nomlari bilan). */
export async function HeaderBreadcrumb() {
  const { role } = await pageGuard();
  return <Breadcrumb role={role} />;
}

/** Telefondagi pastki menyu (bo'limlar bittadan ko'p bo'lsa). */
export async function MobileNav() {
  const { role } = await pageGuard();
  if (navFor(role).length < 2) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Asosiy menyu">
      <BottomNav role={role} />
    </nav>
  );
}
