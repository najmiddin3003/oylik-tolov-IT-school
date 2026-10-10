import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, CalendarDays, Download, Info, Plus, UserCheck, UserRound, Users, Wallet } from "lucide-react";
import { PaidCell, StudentCell } from "@/components/cells";
import { SyncAlert } from "@/components/ShellParts";
import {
  btn,
  Card,
  CardHeader,
  Chip,
  cx,
  EmptyState,
  GroupChip,
  HeroKpiCard,
  KpiCard,
  PageHeader,
  PageSkeleton,
  Pagination,
  Progress,
  StatusBadge,
  td,
  th,
} from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import { getMonthOverview, listGroups } from "@/lib/data";
import { currentMonth, formatMoney, formatNumber, isValidMonth, monthLabel } from "@/lib/time";

const PAGE_SIZE = 10;

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await pageGuard();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const group = typeof sp.group === "string" ? sp.group : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ debtors, totals }, groups] = await Promise.all([getMonthOverview(month, group), listGroups()]);

  const planDone = totals.expected - totals.debt;
  const planPct = totals.expected ? Math.round((planDone / totals.expected) * 100) : 0;
  const paidPct = totals.students ? Math.round((totals.paid / totals.students) * 100) : 0;
  const debtorsCount = totals.unpaid + totals.partial;
  const pages = Math.max(1, Math.ceil(debtors.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = debtors.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ month, ...(group ? { group } : {}), ...extra }).toString();

  return (
    <>
      <PageHeader
        eyebrow="Moliyaviy ko‘rinish"
        title="Bosh sahifa"
        subtitle={`${monthLabel(month)} uchun to‘lovlar holati va asosiy ko‘rsatkichlar${group ? ` · ${group}` : ""}.`}
        actions={
          <>
            <a href={`/api/export/hisobot?${qs({})}`} className={btn.outline}>
              <Download className="size-[18px]" strokeWidth={1.8} aria-hidden />
              Hisobotni yuklash
            </a>
            <Link href={`/payments?${qs({})}#yangi-tolov`} className={btn.primary}>
              <Plus className="size-[18px]" strokeWidth={2.2} aria-hidden />
              To‘lov qo‘shish
            </Link>
          </>
        }
      />

      <Suspense fallback={null}>
        <SyncAlert />
      </Suspense>

      {groups.length > 1 ? (
        <div className="-mt-1 mb-5 flex flex-wrap gap-2" aria-label="Guruh bo‘yicha filtr">
          {["", ...groups].map((g) => (
            <Link
              key={g || "all"}
              href={`/?${new URLSearchParams({ month, ...(g ? { group: g } : {}) })}`}
              className={cx(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition",
                g === group ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-line hover:bg-slate-50",
              )}
            >
              {g || "Barcha guruhlar"}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <HeroKpiCard
          label="Jami tushum"
          value={formatNumber(totals.collected)}
          unit="so‘m"
          badge={`${planPct}%`}
          hint={`${totals.paymentCount} ta to‘lov qabul qilindi`}
          icon={Wallet}
        />
        <KpiCard
          label="Faol o‘quvchilar"
          value={totals.students}
          hint={totals.groups ? `${totals.groups} ta guruhda tahsil olmoqda` : "guruh belgilanmagan"}
          icon={Users}
        />
        <KpiCard
          label="To‘liq to‘laganlar"
          value={totals.paid}
          hint={
            <>
              <span className="font-semibold text-emerald-600">{paidPct}%</span> o‘quvchi to‘lovni yopgan
            </>
          }
          icon={UserCheck}
          tone="emerald"
        />
        <KpiCard label="Qarzdor o‘quvchilar" value={debtorsCount} hint={`Jami ${formatMoney(totals.debt)}`} icon={UserRound} tone="amber" />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Oylik to‘lov rejasi</h2>
            <Chip>{monthLabel(month)}</Chip>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <p className="num leading-none">
              <span className="text-[32px] font-bold tracking-[-0.02em] text-ink-900">{formatNumber(planDone)}</span>
              <span className="ml-1.5 text-lg font-medium text-ink-500">so‘m</span>
              <span className="ml-3 text-lg text-ink-400">/ {formatMoney(totals.expected)}</span>
            </p>
            <span className="num text-lg font-bold text-brand-600">{planPct}%</span>
          </div>
          <Progress value={planDone} max={totals.expected} className="mt-5 h-2" />
          <dl className="mt-6 grid gap-4 border-b border-line-soft pb-5 sm:grid-cols-3">
            <LegendItem dot="bg-ink-300" label="Oylik reja" value={formatMoney(totals.expected)} />
            <LegendItem dot="bg-brand-600" label="Rejaga tushdi" value={formatMoney(planDone)} />
            <LegendItem dot="bg-unpaid" label="Qolgan to‘lov" value={formatMoney(totals.debt)} />
          </dl>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-400">
            <Info className="size-3.5" aria-hidden />
            To‘lov kiritilganda ko‘rsatkichlar avtomatik yangilanadi.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">To‘lov holati</h2>
            <span className="text-sm text-ink-400">{totals.students} ta o‘quvchi</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5">
            <Donut
              total={totals.students}
              parts={[
                { value: totals.paid, color: "var(--color-paid)" },
                { value: totals.partial, color: "var(--color-partial)" },
                { value: totals.unpaid, color: "var(--color-unpaid)" },
              ]}
            />
            <ul className="min-w-[190px] flex-1 space-y-4">
              <StatusLine dot="bg-paid" label="To‘liq to‘lagan" value={totals.paid} />
              <StatusLine dot="bg-partial" label="Qisman to‘lagan" value={totals.partial} />
              <StatusLine dot="bg-unpaid" label="To‘lamagan" value={totals.unpaid} />
            </ul>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-400">
            <CalendarDays className="size-3.5" aria-hidden />
            {monthLabel(month)} uchun hisoblangan to‘lovlar
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="To‘lov kutilayotgan o‘quvchilar"
          count={debtors.length}
          right={
            <Link href={`/students?${new URLSearchParams({ tab: "debt", month })}`} className={btn.link}>
              Barchasini ko‘rish
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          }
        />
        {debtors.length === 0 ? (
          <div className="border-t border-line-soft">
            <EmptyState title={totals.students ? "Hamma to‘lagan 🎉" : "Hali o‘quvchi yo‘q"} icon={UserCheck}>
              {totals.students ? (
                `${monthLabel(month)} uchun barcha faol o‘quvchilar to‘lovni amalga oshirgan.`
              ) : (
                <Link href="/students/new" className="font-medium text-brand-600 hover:underline">
                  Birinchi o‘quvchini qo‘shing
                </Link>
              )}
            </EmptyState>
          </div>
        ) : (
          <div className="relative overflow-x-auto border-t border-line-soft">
            <table className="w-full min-w-[880px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className={th}>O‘quvchi</th>
                  <th className={th}>Guruh</th>
                  <th className={th}>To‘landi / oylik</th>
                  <th className={`${th} text-right`}>Qolgan to‘lov</th>
                  <th className={th}>Holat</th>
                  <th className={`${th} text-right`}>Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {pageRows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/50">
                    <td className={td}>
                      <StudentCell id={r.id} name={r.fullName} seq={r.seq} phone={r.phone} href={`/students/${r.id}?month=${month}`} />
                    </td>
                    <td className={td}>
                      <GroupChip name={r.group} />
                    </td>
                    <td className={td}>
                      <PaidCell paid={r.paid} fee={r.monthlyFee} />
                    </td>
                    <td className={`${td} num whitespace-nowrap text-right text-[15px] font-semibold text-ink-900`}>{formatMoney(r.debt)}</td>
                    <td className={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={`${td} text-right`}>
                      <Link href={`/payments?${new URLSearchParams({ month, student: r.id })}#yangi-tolov`} className={btn.sm}>
                        <Plus className="size-4" aria-hidden />
                        To‘lov
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-6 py-4 text-[13px] text-ink-400">
          <span>
            Jami {debtors.length} ta o‘quvchi · {monthLabel(month)}
          </span>
          <Pagination page={current} pages={pages} href={(p) => `/?${qs({ page: String(p) })}`} />
        </div>
      </Card>
    </>
  );
}

function LegendItem({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-[13px] text-ink-500">
        <span className={cx("size-2 rounded-sm", dot)} aria-hidden />
        {label}
      </dt>
      <dd className="num mt-1.5 text-[15px] font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function StatusLine({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className={cx("size-2 rounded-full", dot)} aria-hidden />
      <span className="flex-1 text-[15px] text-ink-600">{label}</span>
      <span className="num text-[15px] font-semibold text-ink-900">{value}</span>
    </li>
  );
}

function Donut({ total, parts }: { total: number; parts: { value: number; color: string }[] }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const segments = parts.reduce<{ len: number; offset: number; color: string }[]>((acc, p) => {
    if (!p.value || !total) return acc;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0;
    return [...acc, { len: (p.value / total) * c, offset, color: p.color }];
  }, []);
  return (
    <div className="relative size-[136px] shrink-0" role="img" aria-label={`${total} ta o‘quvchi`}>
      <svg viewBox="0 0 136 136" className="size-full -rotate-90" aria-hidden>
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth="15" />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="68"
            cy="68"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="15"
            strokeDasharray={`${s.len} ${c - s.len}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-[30px] font-bold leading-none tracking-[-0.02em] text-ink-900">{total}</span>
        <span className="mt-1 text-xs text-ink-400">o‘quvchi</span>
      </div>
    </div>
  );
}
