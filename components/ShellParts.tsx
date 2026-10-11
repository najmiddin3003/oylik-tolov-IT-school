// Ilova qobig'ining server qismlari (sessiya va ma'lumot o'qiydi — Suspense ichida ishlatiladi).
import Link from "next/link";
import { ArrowRight, BellRing, Building2, ChartColumnIncreasing, TriangleAlert } from "lucide-react";
import { pageGuard } from "@/lib/auth";
import { getNavCounts, getReminders, getSyncAlert } from "@/lib/data";
import { reminderTitle } from "@/lib/reminders";
import type { Role } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { currentMonth, formatDateTime, formatMoney, monthLabel } from "@/lib/time";
import { ROLE_INFO } from "./nav";
import { BottomNav, SidebarNav } from "./NavLinks";
import { NotificationBell, UnpaidButton } from "./Notifications";
import { HeaderMonth, HeaderSearch } from "./TopBar";
import { cx, IconTile, Skeleton } from "./ui";
import { UserMenu } from "./UserMenu";

/** Yon menyu tarkibi: rolga qarab bandlar, markaz nomi, foydalanuvchi. */
export async function SidebarBody() {
  const { role } = await pageGuard();
  const [counts, settings] = await Promise.all([getNavCounts(), getSettings()]);
  const info = ROLE_INFO[role];
  return (
    <>
      <div className="group mt-6 flex items-center gap-3 rounded-2xl border border-line px-3 py-3 sb-rail:hidden">
        <IconTile icon={Building2} tone="slate" size="sm" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate whitespace-nowrap text-[15px] font-semibold text-ink-900">{settings.centerName}</span>
          <span className="mt-0.5 block whitespace-nowrap text-xs text-ink-400">{role === "owner" ? "Boshqaruv maydoni" : "To‘lovlar bo‘limi"}</span>
        </span>
      </div>

      <p className="mb-3 mt-7 whitespace-nowrap px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400 sb-rail:hidden">Ish maydoni</p>
      <nav className="flex flex-col gap-1 sb-rail:mt-6 sb-rail:items-stretch" aria-label="Asosiy menyu">
        <SidebarNav counts={counts} role={role} />
      </nav>

      <div className="mt-auto pt-8">
        {role === "owner" ? (
          <div className="group relative overflow-hidden rounded-2xl border border-brand-100/70 bg-[linear-gradient(160deg,#f5f6ff_0%,#eceeff_100%)] p-4 sb-rail:hidden">
            <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full border-[14px] border-white/60" aria-hidden />
            <IconTile icon={ChartColumnIncreasing} tone="brand" variant="solid" size="sm" />
            <p className="relative mt-4 text-[15px] font-semibold text-ink-900">
              Har bir to‘lov muhim<span className="text-brand-600">.</span>
            </p>
            <p className="relative mt-1.5 text-[13px] leading-relaxed text-ink-500">O‘quvchilar va to‘lovlar — bitta tartibli maydonda.</p>
            <Link href="/sync" className="relative mt-3 inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-brand-600 hover:text-brand-800">
              Sheets bilan solishtirish
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 sb-rail:flex-col sb-rail:gap-2">
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-brand"
            title={`${info.name} · ${info.hint}`}
            aria-hidden
          >
            {info.letter}
          </span>
          <span className="min-w-0 flex-1 leading-tight sb-rail:hidden">
            <span className="block truncate whitespace-nowrap text-sm font-semibold text-ink-900">{info.name}</span>
            <span className="mt-0.5 block truncate whitespace-nowrap text-xs text-ink-400">{info.hint}</span>
          </span>
          <UserMenu role={role} placement="sidebar" />
        </div>
      </div>
    </>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="mt-6 grid gap-2" aria-hidden>
      <Skeleton className="h-16 rounded-2xl sb-rail:hidden" />
      <Skeleton className="mt-6 h-3 w-24 sb-rail:hidden" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 rounded-xl" />
      ))}
    </div>
  );
}

/** Yuqori panelning o'ng qismi: qidiruv (rahbar), oy tanlagich, bildirishnomalar, menyu (telefonda). */
export async function HeaderTools() {
  const { role } = await pageGuard();
  const [reminders, sync] = await Promise.all([getReminders(), getSyncAlert()]);
  return (
    <>
      {role === "owner" ? <HeaderSearch /> : null}
      {role === "owner" ? <span className="hidden h-7 w-px bg-line md:block" aria-hidden /> : null}
      <HeaderMonth fallbackMonth={currentMonth()} />
      <NotificationBell reminders={reminders} sync={sync} role={role} />
      <div className="lg:hidden">
        <UserMenu role={role} placement="header" />
      </div>
    </>
  );
}

export function HeaderToolsFallback() {
  return (
    <>
      <div className="skeleton h-11 w-48 rounded-xl sm:h-12 sm:w-52" aria-hidden />
      <div className="skeleton size-10 rounded-xl" aria-hidden />
    </>
  );
}

/** Telefondagi pastki menyu (administratorda bitta bo'lim — ko'rsatilmaydi). */
export async function MobileNav() {
  const { role } = await pageGuard();
  if (role !== "owner") return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Asosiy menyu">
      <BottomNav role={role} />
    </nav>
  );
}

/** Oxirgi Sheets tekshiruvida farq yoki xato bo'lsa — sahifa sarlavhasi ostida ogohlantirish (faqat rahbar). */
export async function SyncAlert() {
  await pageGuard();
  const alert = await getSyncAlert();
  if (!alert) return null;
  const isError = Boolean(alert.error);
  return (
    <div className="group mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 sm:px-5" role="status">
      <IconTile icon={TriangleAlert} tone="amber" size="sm" />
      <p className="min-w-[200px] flex-1 text-sm leading-relaxed">
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

/** Oy oxiri eslatmasi: "Oy tugashiga 7 kun qoldi — 10 ta o'quvchi to'lov qilmadi" (bosilsa — ro'yxat). */
export async function ReminderBanner() {
  const { role } = await pageGuard();
  const reminders = await getReminders();
  if (!reminders.length) return null;
  return (
    <div className="mb-6 grid gap-3">
      {reminders.map((r) => (
        <ReminderRow key={r.month} role={role} reminder={r} />
      ))}
    </div>
  );
}

function ReminderRow({ role, reminder: r }: { role: Role; reminder: Awaited<ReturnType<typeof getReminders>>[number] }) {
  const urgent = r.daysLeft === null || r.daysLeft <= 3;
  return (
    <div
      className={cx(
        "group flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5 sm:px-5",
        urgent ? "border-rose-200/80 bg-linear-to-r from-rose-50 to-amber-50/60" : "border-amber-200/80 bg-linear-to-r from-amber-50 to-orange-50/40",
      )}
      role="status"
    >
      <IconTile icon={BellRing} tone={urgent ? "rose" : "amber"} variant="solid" />
      <p className="min-w-[200px] flex-1 text-sm leading-relaxed">
        <span className={cx("block font-semibold", urgent ? "text-rose-900" : "text-amber-900")}>
          {reminderTitle(r)}: {r.students.length} ta o‘quvchi to‘lov qilmadi
        </span>
        <span className={cx("num block", urgent ? "text-rose-800/75" : "text-amber-800/75")}>
          {monthLabel(r.month)} · qolgan qarz {formatMoney(r.total)}
        </span>
      </p>
      <UnpaidButton
        month={r.month}
        students={r.students}
        role={role}
        className={cx(
          "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold shadow-card ring-1 ring-inset transition sm:w-auto",
          urgent ? "text-rose-700 ring-rose-200 hover:bg-rose-50" : "text-amber-800 ring-amber-200 hover:bg-amber-50",
        )}
      >
        Ro‘yxatni ko‘rish
        <ArrowRight className="size-4" aria-hidden />
      </UnpaidButton>
    </div>
  );
}
