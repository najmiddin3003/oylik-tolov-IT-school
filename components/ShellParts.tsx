// Ilova qobig'ining server qismlari (sessiya va ma'lumot o'qiydi — Suspense ichida ishlatiladi).
import Link from "next/link";
import { ArrowRight, BellRing, Building2, ChartColumnIncreasing, TriangleAlert } from "lucide-react";
import { pageGuard } from "@/lib/auth";
import { getBellExtras, getNavCounts, getReminders, getSyncAlert, getTaskStatus } from "@/lib/data";
import { reminderTitle } from "@/lib/reminders";
import type { Role } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { currentMonth, formatDateTime, formatMoney, monthLabel } from "@/lib/time";
import { HistoryNav } from "./HistoryNav";
import { navFor, ROLE_INFO } from "./nav";
import { BottomNav, SidebarNav } from "./NavLinks";
import { NotificationBell, UnpaidButton } from "./Notifications";
import { SendTaskButton } from "./TaskButtons";
import { ThemeToggle } from "./ThemeToggle";
import { Breadcrumb, HeaderMonth, HeaderSearch } from "./TopBar";
import { cx, IconTile, Skeleton } from "./ui";
import { UserAvatar, UserMenu } from "./UserMenu";

/** Yon menyu tarkibi: o'rtasi (markaz, bo'limlar) aylanadi, foydalanuvchi bloki doim pastda ko'rinadi. */
export async function SidebarBody() {
  const { role, name } = await pageGuard();
  const [counts, settings] = await Promise.all([getNavCounts(), getSettings()]);
  const info = ROLE_INFO[role];
  const isOwner = role === "owner";
  return (
    <>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5 sb-rail:px-3">
        <div className="group mt-2 flex items-center gap-3 rounded-2xl border border-line px-3 py-3 sb-rail:hidden">
          <IconTile icon={Building2} tone="slate" size="sm" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate whitespace-nowrap text-[15px] font-semibold text-ink-900">{settings.centerName}</span>
            <span className="mt-0.5 block whitespace-nowrap text-xs text-ink-400">
              {isOwner ? "Rahbar boshqaruvi" : role === "teacher" ? "O‘qituvchi maydoni" : "To‘lovlar va kassa"}
            </span>
          </span>
        </div>

        <p className="mb-2.5 mt-6 whitespace-nowrap px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400 sb-rail:hidden">Ish maydoni</p>
        <nav className="flex flex-col gap-1 sb-rail:mt-4 sb-rail:items-stretch" aria-label="Asosiy menyu">
          <SidebarNav counts={counts} role={role} />
        </nav>

        {isOwner ? (
          // Ekran past bo'lsa — joy tejash uchun yashiriladi
          <div className="group relative mt-6 overflow-hidden rounded-2xl border border-brand-100/70 bg-[linear-gradient(160deg,#f5f6ff_0%,#eceeff_100%)] p-4 sb-rail:hidden dark:bg-[linear-gradient(160deg,#1b2046_0%,#151935_100%)] [@media(max-height:860px)]:hidden">
            <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full border-[14px] border-white/60 dark:border-white/5" aria-hidden />
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
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-5 py-3.5 sb-rail:flex-col sb-rail:gap-2 sb-rail:px-3">
        <span title={`${name ?? info.name} · ${info.hint}`}>
          <UserAvatar role={role} name={name} />
        </span>
        <span className="min-w-0 flex-1 leading-tight sb-rail:hidden">
          <span className="block truncate whitespace-nowrap text-sm font-semibold text-ink-900">{name ?? info.name}</span>
          <span className={cx("mt-0.5 block truncate whitespace-nowrap text-xs", isOwner ? "font-semibold text-amber-700" : "text-ink-400")}>
            {name ? info.name : info.hint}
          </span>
        </span>
        <UserMenu role={role} name={name} placement="sidebar" />
      </div>
    </>
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
      <ThemeToggle />
      <NotificationBell reminders={reminders} sync={sync} role={role} tasks={extras.tasks} handovers={extras.handovers} />
      <UserMenu role={role} name={name} placement="header" />
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

/**
 * Oxirgi Sheets tekshiruvida farq yoki xato bo'lsa — sahifa sarlavhasi ostida ogohlantirish (faqat rahbar,
 * o'zi Sozlamalarda o'chirmagan bo'lsa).
 */
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
      <span className="flex items-center gap-3">
        <Link href="/settings#funksiyalar" className="text-xs font-medium text-amber-800/70 underline-offset-4 hover:text-amber-900 hover:underline">
          O‘chirish
        </Link>
        <Link href="/sync" className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 transition hover:text-amber-950">
          {isError ? "Sozlash" : "Ko‘rish"}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </span>
    </div>
  );
}

/**
 * Oy oxiri eslatmasi: "Oy tugashiga 7 kun qoldi — 10 ta o'quvchi to'lov qilmadi".
 * Rahbarda — «Administratorga topshiriq yuborish», boshqalarda — ro'yxat.
 */
export async function ReminderBanner() {
  const { role } = await pageGuard();
  const reminders = await getReminders();
  if (!reminders.length) return null;
  const tasks = role === "owner" ? await getTaskStatus(reminders.map((r) => r.month)) : {};
  return (
    <div className="mb-6 grid gap-3">
      {reminders.map((r) => (
        <ReminderRow key={r.month} role={role} reminder={r} task={tasks[r.month] ?? null} />
      ))}
    </div>
  );
}

function ReminderRow({
  role,
  reminder: r,
  task,
}: {
  role: Role;
  reminder: Awaited<ReturnType<typeof getReminders>>[number];
  task: Awaited<ReturnType<typeof getTaskStatus>>[string] | null;
}) {
  const urgent = r.daysLeft === null || r.daysLeft <= 3;
  const listButton = cx(
    "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-surface px-4 text-sm font-semibold shadow-card ring-1 ring-inset transition sm:w-auto",
    urgent ? "text-rose-700 ring-rose-200 hover:bg-rose-50" : "text-amber-800 ring-amber-200 hover:bg-amber-50",
  );
  return (
    <div
      className={cx(
        "group flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5 sm:px-5",
        urgent ? "border-rose-200/80 bg-linear-to-r from-rose-50 to-amber-50/60" : "border-amber-200/80 bg-linear-to-r from-amber-50 to-orange-50/40",
      )}
      role="status"
    >
      <IconTile icon={BellRing} tone={urgent ? "rose" : "amber"} variant="solid" />
      <div className="min-w-[200px] flex-1 text-sm leading-relaxed">
        <p className={cx("font-semibold", urgent ? "text-rose-900" : "text-amber-900")}>
          {reminderTitle(r)}: {r.students.length} ta o‘quvchi to‘lov qilmadi
        </p>
        {/* <div>: ichida modal oyna (<dialog>) bor — <p> ichiga joylab bo'lmaydi */}
        <div className={cx("num flex flex-wrap items-center gap-x-2", urgent ? "text-rose-800/75" : "text-amber-800/75")}>
          {monthLabel(r.month)} · qolgan qarz {formatMoney(r.total)}
          {role === "owner" ? (
            <UnpaidButton
              month={r.month}
              students={r.students}
              role={role}
              className="font-semibold underline decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              ro‘yxat
            </UnpaidButton>
          ) : null}
        </div>
      </div>
      {role === "owner" ? (
        <SendTaskButton month={r.month} task={task} tone={urgent ? "rose" : "amber"} />
      ) : (
        <UnpaidButton month={r.month} students={r.students} role={role} className={listButton}>
          Ro‘yxatni ko‘rish
          <ArrowRight className="size-4" aria-hidden />
        </UnpaidButton>
      )}
    </div>
  );
}
