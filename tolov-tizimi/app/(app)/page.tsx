import Link from "next/link";
import { Suspense } from "react";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { btn, Card, CardHeader, EmptyState, PageHeader, PageSkeleton, StatCard, StatusBadge, td, th } from "@/components/ui";
import { getMonthOverview, listGroups, type StudentRow } from "@/lib/data";
import { currentMonth, formatMoney, isValidMonth, monthLabel } from "@/lib/time";
import { pageGuard } from "@/lib/auth";

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
  const [{ rows, totals }, groups] = await Promise.all([getMonthOverview(month, group), listGroups()]);

  const debtors = rows
    .filter((r) => r.status !== "paid")
    .sort((a, b) => (a.status === b.status ? a.fullName.localeCompare(b.fullName) : a.status === "unpaid" ? -1 : 1));
  const paid = rows.filter((r) => r.status === "paid");
  const pct = totals.expected ? Math.min(100, Math.round(((totals.expected - totals.debt) / totals.expected) * 100)) : 0;
  const groupHref = (g: string) => `/?${new URLSearchParams({ month, ...(g ? { group: g } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Bosh sahifa"
        subtitle={`${monthLabel(month)} oyi uchun to'lovlar holati${group ? ` · ${group}` : ""}`}
        actions={<MonthSwitcher month={month} basePath="/" params={{ group }} />}
      />

      {groups.length > 1 ? (
        <div className="-mt-2 mb-5 flex flex-wrap gap-1.5" aria-label="Guruh bo'yicha filtr">
          {["", ...groups].map((g) => {
            const active = g === group;
            return (
              <Link
                key={g || "all"}
                href={groupHref(g)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                  active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {g || "Barcha guruhlar"}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Faol o'quvchilar" value={totals.students} hint={`${monthLabel(month)} holatiga`} />
        <StatCard label="To'lagan" value={totals.paid} hint={totals.students ? `${Math.round((totals.paid / totals.students) * 100)}% o'quvchi` : "—"} tone="emerald" />
        <StatCard label="To'lamagan" value={totals.unpaid + totals.partial} hint={totals.partial ? `shundan ${totals.partial} ta qisman` : "to'liq qarzdorlar"} tone="rose" />
        <StatCard label="Yig'ildi" value={formatMoney(totals.collected)} hint={`${totals.paymentCount} ta to'lov`} tone="brand" />
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-slate-700">Oylik reja bajarilishi</span>
          <span className="num text-slate-500">
            {formatMoney(totals.expected - totals.debt)} / {formatMoney(totals.expected)}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Reja bajarilishi">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="num mt-2 text-xs text-slate-500">
          {pct}% bajarildi · Umumiy qarz: <span className="font-medium text-rose-600">{formatMoney(totals.debt)}</span>
        </p>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title={
            <>
              To&apos;lov qilmaganlar <span className="ml-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{debtors.length}</span>
            </>
          }
          right={<Link href="/students/new" className={btn.ghost}>+ O&apos;quvchi qo&apos;shish</Link>}
        />
        {debtors.length === 0 ? (
          <EmptyState title={rows.length ? "Hamma to'lagan 🎉" : "Hali o'quvchi yo'q"}>
            {rows.length ? (
              `${monthLabel(month)} uchun barcha faol o'quvchilar to'lovni amalga oshirgan.`
            ) : (
              <Link href="/students/new" className="font-medium text-brand-600 hover:underline">
                Birinchi o&apos;quvchini qo&apos;shing
              </Link>
            )}
          </EmptyState>
        ) : (
          <StudentTable rows={debtors} month={month} showAction />
        )}
      </Card>

      {paid.length ? (
        <Card>
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
              <span>
                To&apos;laganlar <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{paid.length}</span>
              </span>
              <span className="text-xs font-normal text-slate-500">ko&apos;rsatish ▾</span>
            </summary>
            <div className="border-t border-slate-100">
              <StudentTable rows={paid} month={month} />
            </div>
          </details>
        </Card>
      ) : null}
    </>
  );
}

function StudentTable({ rows, month, showAction = false }: { rows: StudentRow[]; month: string; showAction?: boolean }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead className="bg-slate-50/70">
          <tr>
            <th className={th}>O&apos;quvchi</th>
            <th className={th}>Guruh</th>
            <th className={`${th} text-right`}>To&apos;landi / oylik</th>
            <th className={`${th} text-right`}>Qarz</th>
            <th className={th}>Holat</th>
            {showAction ? <th className={th}><span className="sr-only">Amal</span></th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <td className={`${td} whitespace-nowrap`}>
                <Link href={`/students/${r.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                  {r.fullName}
                </Link>
                {r.phone ? (
                  <a href={`tel:${r.phone.replace(/[^d+]/g, "")}`} className="num block text-xs text-slate-500 hover:text-brand-600">
                    {r.phone}
                  </a>
                ) : null}
              </td>
              <td className={`${td} text-slate-500`}>{r.group || "—"}</td>
              <td className={`${td} num whitespace-nowrap text-right`}>
                {r.paid ? formatMoney(r.paid) : "—"}
                <span className="block text-xs text-slate-400">/ {formatMoney(r.monthlyFee)}</span>
              </td>
              <td className={`${td} num whitespace-nowrap text-right font-medium ${r.debt ? "text-rose-600" : "text-slate-400"}`}>{r.debt ? formatMoney(r.debt) : "—"}</td>
              <td className={td}>
                <StatusBadge status={r.status} />
              </td>
              {showAction ? (
                <td className={`${td} text-right`}>
                  <Link href={`/students/${r.id}?month=${month}#tolov`} className={`${btn.ghost} whitespace-nowrap text-brand-600 hover:bg-brand-50 hover:text-brand-700`}>
                    + To&apos;lov
                  </Link>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
