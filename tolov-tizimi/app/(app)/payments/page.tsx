import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { deletePayment } from "@/app/actions/payments";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { PaymentForm } from "@/components/PaymentForm";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, CardHeader, EmptyState, PageHeader, PageSkeleton, Tag, td, th } from "@/components/ui";
import { listPaymentsForMonth, listStudentOptions } from "@/lib/data";
import { currentMonth, formatDate, formatMoney, isValidMonth, monthLabel, todayISO } from "@/lib/time";
import { pageGuard } from "@/lib/auth";

export const metadata: Metadata = { title: "To'lovlar" };

const METHOD_LABEL = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma" } as const;

export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}

async function Payments({ searchParams }: { searchParams: PageProps<"/payments">["searchParams"] }) {
  await pageGuard();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const [{ rows, total }, students] = await Promise.all([listPaymentsForMonth(month), listStudentOptions()]);

  const byMethod = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.method] = (acc[r.method] ?? 0) + r.amount;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="To'lovlar"
        subtitle={`${monthLabel(month)} oyi uchun kiritilgan to'lovlar`}
        actions={<MonthSwitcher month={month} basePath="/payments" />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader
            title={`${rows.length} ta to'lov`}
            right={
              <span className="num text-sm text-slate-500">
                Jami: <span className="font-semibold text-slate-900">{formatMoney(total)}</span>
                {Object.entries(byMethod).map(([m, sum]) => (
                  <span key={m} className="ml-3 hidden sm:inline">
                    {METHOD_LABEL[m as keyof typeof METHOD_LABEL]}: {formatMoney(sum)}
                  </span>
                ))}
              </span>
            }
          />
          {rows.length === 0 ? (
            <EmptyState title="Bu oy uchun to'lov kiritilmagan">O&apos;ngdagi forma orqali to&apos;lov qo&apos;shing.</EmptyState>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[540px]">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className={th}>Sana</th>
                    <th className={th}>O&apos;quvchi</th>
                    <th className={`${th} text-right`}>Summa</th>
                    <th className={th}>Usul</th>
                    <th className={th}>Izoh</th>
                    <th className={th}>
                      <span className="sr-only">Amal</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className={`${td} num`}>{formatDate(p.paidAt)}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {p.studentId ? (
                          <Link href={`/students/${p.studentId}`} className="font-medium text-slate-900 hover:text-brand-600">
                            {p.studentName}
                          </Link>
                        ) : (
                          <span className="text-slate-400">{p.studentName}</span>
                        )}
                      </td>
                      <td className={`${td} num whitespace-nowrap text-right font-medium text-slate-900`}>{formatMoney(p.amount)}</td>
                      <td className={td}>{METHOD_LABEL[p.method]}</td>
                      <td className={`${td} max-w-[160px] truncate text-slate-500`} title={p.note}>
                        {p.source === "sheets" ? <Tag tone="emerald">Sheets</Tag> : null} {p.note}
                      </td>
                      <td className={`${td} text-right`}>
                        <ConfirmAction
                          action={deletePayment.bind(null, p.id)}
                          confirmText={`${p.studentName}: ${formatMoney(p.amount)} to'lov o'chirilsinmi?`}
                          className={`${btn.ghost} text-rose-600 hover:bg-rose-50`}
                          pendingText="…"
                        >
                          O&apos;chirish
                        </ConfirmAction>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="order-first self-start xl:order-none">
          <CardHeader title="Yangi to'lov" />
          <div className="p-5">
            {students.length ? (
              <PaymentForm key={month} students={students} defaultMonth={month} today={todayISO()} />
            ) : (
              <p className="text-sm text-slate-500">
                Avval{" "}
                <Link href="/students/new" className="font-medium text-brand-600 hover:underline">
                  o&apos;quvchi qo&apos;shing
                </Link>
                .
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
