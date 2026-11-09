import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowRight, Crown, HandCoins, History, KeyRound, PiggyBank, Wallet } from "lucide-react";
import { changeMyPassword } from "@/app/actions/auth";
import { ActivityList } from "@/components/ActivityList";
import { PayMonths } from "@/components/PayMonths";
import { PayPlanPanel } from "@/components/PayPlan";
import { SalaryCycleNote } from "@/components/SalaryCycleNote";
import { OwnerPasswordForm } from "@/components/SettingsForms";
import { HeaderMonth } from "@/components/TopBar";
import { btn, Card, cx, EmptyState, IconTile, PageHeader, PageSkeleton, Tag, type Tone } from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import { getMyActivity, getMyProfile } from "@/lib/data";
import { formatUzPhone } from "@/lib/phone";
import { payLabel, ROLE_LABEL, staffInitials } from "@/lib/staff-rules";
import { currentMonth, formatDate, formatMoney, isValidMonth, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Profilim" };

export default function MePage({ searchParams }: PageProps<"/me">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Me searchParams={searchParams} />
    </Suspense>
  );
}

async function Me({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  const session = await pageGuard();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const [me, activity] = await Promise.all([session.staffId ? getMyProfile(month) : Promise.resolve(null), getMyActivity({ limit: 6 })]);

  if (!me) {
    return (
      <>
        <PageHeader eyebrow="Profil" title="Profilim" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card>
            <EmptyState title="Siz umumiy parol bilan kirgansiz" icon={KeyRound} tone="amber">
              Shaxsiy profil xodim sifatida ro‘yxatdan o‘tganda paydo bo‘ladi.{" "}
              {session.role === "owner" ? (
                <Link href="/staff" className="font-medium text-brand-600 hover:underline">
                  «Xodimlar» bo‘limida o‘zingizni qo‘shing
                </Link>
              ) : null}
            </EmptyState>
          </Card>
          <RecentActivity activity={activity} />
        </div>
      </>
    );
  }

  const { staff, pay } = me;
  const isOwner = staff.role === "owner";
  const fixed = pay.kind === "fixed";
  const showPay = staff.role !== "owner" || pay.percent > 0 || me.salaries.length > 0;

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-4">
        <span
          className={cx(
            "inline-flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white",
            isOwner ? "bg-linear-to-br from-amber-400 to-orange-600" : staff.role === "teacher" ? "bg-linear-to-br from-brand-500 to-brand-700 shadow-brand" : "bg-linear-to-br from-emerald-400 to-emerald-600",
          )}
          aria-hidden
        >
          {isOwner ? <Crown className="size-6" fill="currentColor" fillOpacity={0.25} /> : staffInitials(staff.name)}
        </span>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Profilim</p>
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink-900 sm:text-[30px]">{staff.name}</h1>
          <p className="num mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <Tag tone={isOwner ? "amber" : staff.role === "teacher" ? "brand" : "emerald"}>{ROLE_LABEL[staff.role]}</Tag>
            {formatUzPhone(staff.phone)}
            {staff.role === "teacher" ? <span>· {me.students} ta o‘quvchi</span> : null}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 gap-6 self-start">
          {showPay ? (
            <Card id="oylik" className="scroll-mt-24 p-6">
              <SectionTitle
                icon={PiggyBank}
                tone="emerald"
                title="Mening oyligim"
                right={<HeaderMonth fallbackMonth={currentMonth()} />}
                subtitle={
                  fixed
                    ? `${pay.share ? "Belgilangan oylik — har oy bir xil summa." : "Oylik hali belgilanmagan — rahbar «Xodimlar» bo‘limida belgilaydi."} Olingan oylik va avanslar ayiriladi.`
                    : `${staff.shareBase === "center" ? "Butun markaz tushumidan" : "O‘quvchilaringiz to‘lagan pullardan (o‘tgan oylar qarzi uchun to‘langani ham)"} ${pay.percent}%. Oy «Oylik» olindi deb yozilguncha yopilmaydi — shungacha tushgan to‘lovlar shu oyga qo‘shiladi. Olingan oylik va avanslar ayiriladi.`
                }
              />
              {me.plan ? (
                <PayPlanPanel
                  plan={me.plan}
                  month={month}
                  center={staff.shareBase === "center"}
                  debtHref={`/students?${new URLSearchParams({ ...(staff.shareBase === "center" ? {} : { teacher: staff.id }), tab: "debt", month })}`}
                />
              ) : null}
              <SalaryCycleNote
                cycle={pay.cycle}
                month={month}
                thisMonth={currentMonth()}
                who={isOwner ? "owner" : "self"}
                href={pay.cycle ? `/me?${new URLSearchParams({ month: pay.cycle.current })}` : undefined}
                className="mb-6"
              />
              <div className={cx("mb-6 grid gap-3", fixed ? "sm:grid-cols-3" : "sm:grid-cols-2 2xl:grid-cols-4")}>
                {fixed ? null : <Figure label={staff.shareBase === "center" ? "Markaz tushumi" : "O‘quvchilarim tushumi"} value={formatMoney(pay.base)} />}
                <Figure label={payLabel(pay)} value={formatMoney(pay.share)} tone="brand" />
                <Figure label="Olindi (oylik/avans)" value={`− ${formatMoney(pay.taken)}`} tone="amber" />
                <Figure label="Qoldi" value={formatMoney(pay.left)} tone={pay.left < 0 ? "rose" : "emerald"} strong />
              </div>
              <div className="overflow-hidden rounded-2xl border border-line">
                <p className="flex items-center justify-between gap-3 border-b border-line-soft bg-slate-50/70 px-4 py-2.5 text-sm font-semibold text-ink-700">
                  {monthLabel(month)} uchun olganlarim
                  <span className="num text-ink-500">{me.salaries.length} ta</span>
                </p>
                {me.salaries.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-ink-400">Bu oy uchun hali oylik yoki avans yozilmagan.</p>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {me.salaries.map((x) => (
                      <li key={x.id} className="group flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                        <IconTile icon={x.kind === "oylik" ? Wallet : HandCoins} tone={x.kind === "oylik" ? "emerald" : "orange"} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold text-ink-900">
                            {x.kind === "oylik" ? "Oylik" : "Avans"} <span className="num ml-1">{formatMoney(x.amount)}</span>
                          </p>
                          <p className="num text-[13px] text-ink-500">
                            {formatDate(x.date)} da{x.note ? ` · ${x.note}` : ""}
                          </p>
                        </div>
                        <Tag tone={x.selfReported ? "brand" : "slate"}>{x.selfReported ? "o‘zim yozganman" : "rahbar yozgan"}</Tag>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {isOwner ? null : (
                <Link href="/olinganlar" className={cx(btn.soft, "mt-4 h-10")}>
                  <HandCoins className="size-4" aria-hidden />
                  Olgan avans/oyligimni yozish va tarix
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </Card>
          ) : null}
          {showPay ? (
            <PayMonths
              rows={me.history}
              selected={month}
              current={currentMonth()}
              basePath="/me"
              baseLabel={fixed ? null : staff.shareBase === "center" ? "Markaz tushumi" : "O‘quvchilarim tushumi"}
            />
          ) : null}
          <RecentActivity activity={activity} />
        </div>

        <div className="grid gap-6 self-start">
          <Card className="p-6">
            <SectionTitle icon={KeyRound} tone="amber" title="Parolni almashtirish" subtitle="Telefon raqamingiz va shu parol bilan kirasiz. Boshqa qurilmalarda qayta kirish kerak bo‘ladi." />
            <OwnerPasswordForm action={changeMyPassword} />
          </Card>
        </div>
      </div>
    </>
  );
}

function RecentActivity({ activity }: { activity: Awaited<ReturnType<typeof getMyActivity>> }) {
  return (
    <Card className="self-start p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <SectionTitle icon={History} tone="brand" title="So‘nggi faoliyatim" subtitle="Tizimga kirishlar va qilgan amallaringiz. Faqat sizga ko‘rinadi." compact />
        <Link href="/faoliyat" className={cx(btn.link, "text-sm")}>
          Hammasi
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ActivityList rows={activity} compact />
    </Card>
  );
}

function SectionTitle({
  icon,
  tone,
  title,
  subtitle,
  compact,
  right,
}: {
  icon: typeof Wallet;
  tone: Tone;
  title: string;
  subtitle?: string;
  compact?: boolean;
  right?: ReactNode;
}) {
  const head = (
    <div className={cx("group flex min-w-0 flex-1 items-start gap-3.5", !compact && !right && "mb-6", right ? "basis-72" : null)}>
      <IconTile icon={icon} tone={tone} variant="solid" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{subtitle}</p> : null}
      </div>
    </div>
  );
  if (!right) return head;
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", !compact && "mb-6")}>
      {head}
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function Figure({ label, value, tone = "slate", strong }: { label: string; value: string; tone?: "slate" | "brand" | "amber" | "emerald" | "rose"; strong?: boolean }) {
  const tones = {
    slate: "bg-slate-50 ring-line-soft text-ink-900",
    brand: "bg-brand-50/70 ring-brand-100 text-brand-800",
    amber: "bg-amber-50/70 ring-amber-100 text-amber-800",
    emerald: "bg-emerald-50/70 ring-emerald-100 text-emerald-700",
    rose: "bg-rose-50/70 ring-rose-100 text-rose-700",
  };
  return (
    <div className={cx("rounded-xl px-4 py-3 ring-1 ring-inset", tones[tone])}>
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className={cx("num mt-1 leading-tight", strong ? "text-[20px] font-bold" : "text-[17px] font-semibold")}>{value}</p>
    </div>
  );
}
