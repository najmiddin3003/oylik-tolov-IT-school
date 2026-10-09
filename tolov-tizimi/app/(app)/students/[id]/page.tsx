import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { deletePayment } from "@/app/actions/payments";
import { deleteStudent } from "@/app/actions/students";
import { PaymentForm } from "@/components/PaymentForm";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, CardHeader, EmptyState, PageHeader, PageSkeleton, StatusBadge, Tag, td, th } from "@/components/ui";
import { getStudent, getStudentPayments } from "@/lib/data";
import { compareMonths, currentMonth, formatDate, formatMoney, isValidMonth, monthLabel, todayISO } from "@/lib/time";
import { pageGuard } from "@/lib/auth";

export const metadata: Metadata = { title: "O'quvchi" };

const METHOD_LABEL = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma" } as const;

export default function StudentPage({ params, searchParams }: PageProps<"/students/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function StudentView({
  params,
  searchParams,
}: {
  params: PageProps<"/students/[id]">["params"];
  searchParams: PageProps<"/students/[id]">["searchParams"];
}) {
  await pageGuard();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const student = await getStudent(id);
  if (!student) notFound();
  const { payments, months, totalDebt } = await getStudentPayments(student);

  const now = currentMonth();
  // To'lov formasi uchun standart oy: URL dagi oy, bo'lmasa eng eski qarzdor oy, bo'lmasa joriy oy
  const oldestDebt = [...months].reverse().find((m) => m.status !== "paid" && compareMonths(m.month, now) <= 0);
  const formMonth = isValidMonth(sp.month) ? sp.month : oldestDebt?.month ?? now;
  const formMonthPaid = months.find((m) => m.month === formMonth)?.paid ?? 0;
  const formAmount = Math.max(0, student.monthlyFee - formMonthPaid) || student.monthlyFee;

  return (
    <>
      <div className="mb-3 text-sm">
        <Link href="/students" className="text-slate-500 hover:text-slate-900">
          ← O&apos;quvchilar
        </Link>
      </div>
      <PageHeader
        title={student.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {student.group ? <Tag tone="brand">{student.group}</Tag> : null}
            {student.active ? <Tag tone="emerald">Faol</Tag> : <Tag>Nofaol</Tag>}
            <span className="num">· {formatMoney(student.monthlyFee)} / oy</span>
          </span>
        }
        actions={
          <>
            <Link href={`/students/${student.id}/edit`} className={btn.secondary}>
              Tahrirlash
            </Link>
            <ConfirmAction
              action={deleteStudent.bind(null, student.id, "/students")}
              confirmText={`${student.fullName} va uning barcha to'lovlari o'chirib yuborilsinmi? Bu amalni qaytarib bo'lmaydi.`}
              className={`${btn.danger} py-2`}
              pendingText="O'chirilmoqda…"
            >
              O&apos;chirish
            </ConfirmAction>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              title="Oylar bo'yicha holat"
              right={
                totalDebt > 0 ? (
                  <span className="num text-sm font-medium text-rose-600">Jami qarz: {formatMoney(totalDebt)}</span>
                ) : (
                  <span className="text-sm font-medium text-emerald-600">Qarz yo&apos;q</span>
                )
              }
            />
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className={th}>Oy</th>
                    <th className={`${th} text-right`}>To&apos;landi</th>
                    <th className={`${th} text-right`}>Qarz</th>
                    <th className={th}>Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {months.map((m) => {
                    const future = compareMonths(m.month, now) > 0;
                    const debt = Math.max(0, student.monthlyFee - m.paid);
                    return (
                      <tr key={m.month}>
                        <td className={`${td} font-medium text-slate-900`}>
                          {monthLabel(m.month)}
                          {future ? <span className="ml-2 text-xs font-normal text-slate-400">oldindan</span> : null}
                        </td>
                        <td className={`${td} num whitespace-nowrap text-right`}>{m.paid ? formatMoney(m.paid) : "—"}</td>
                        <td className={`${td} num whitespace-nowrap text-right ${debt && !future ? "text-rose-600" : "text-slate-400"}`}>
                          {debt && !future ? formatMoney(debt) : "—"}
                        </td>
                        <td className={td}>
                          <StatusBadge status={m.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title={`To'lovlar tarixi (${payments.length})`} />
            {payments.length === 0 ? (
              <EmptyState title="Hali to'lov yo'q" />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className={th}>Sana</th>
                      <th className={th}>Oy uchun</th>
                      <th className={`${th} text-right`}>Summa</th>
                      <th className={th}>Usul</th>
                      <th className={th}>Izoh</th>
                      <th className={th}>
                        <span className="sr-only">Amal</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className={`${td} num`}>{formatDate(p.paidAt)}</td>
                        <td className={td}>{monthLabel(p.month)}</td>
                        <td className={`${td} num whitespace-nowrap text-right font-medium text-slate-900`}>{formatMoney(p.amount)}</td>
                        <td className={td}>{METHOD_LABEL[p.method]}</td>
                        <td className={`${td} max-w-[220px] truncate text-slate-500`} title={p.note}>
                          {p.source === "sheets" ? <Tag tone="emerald">Sheets</Tag> : null} {p.note}
                        </td>
                        <td className={`${td} text-right`}>
                          <ConfirmAction
                            action={deletePayment.bind(null, p.id)}
                            confirmText={`${monthLabel(p.month)} uchun ${formatMoney(p.amount)} to'lov o'chirilsinmi?`}
                            className={`${btn.ghost} text-rose-600 hover:bg-rose-50`}
                            pendingText="…"
                            title="To'lovni o'chirish"
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
        </div>

        <div className="order-first flex min-w-0 flex-col gap-6 md:grid md:grid-cols-2 md:items-start xl:order-none xl:flex">
          <Card>
            <div id="tolov" className="scroll-mt-24" />
            <CardHeader title="To'lov qo'shish" />
            <div className="p-5">
              <PaymentForm studentId={student.id} defaultMonth={formMonth} defaultAmount={formAmount} today={todayISO()} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Ma'lumotlar" />
            <dl className="grid gap-3 p-5 text-sm">
              <Info label="Telefon" value={student.phone ? <a className="num hover:text-brand-600" href={`tel:${student.phone.replace(/[^\d+]/g, "")}`}>{student.phone}</a> : "—"} />
              <Info label="Ota-ona telefoni" value={student.parentPhone ? <a className="num hover:text-brand-600" href={`tel:${student.parentPhone.replace(/[^\d+]/g, "")}`}>{student.parentPhone}</a> : "—"} />
              <Info label="Boshlagan sana" value={formatDate(student.startDate)} />
              <Info label="Oylik to'lov" value={<span className="num">{formatMoney(student.monthlyFee)}</span>} />
              {student.note ? <Info label="Izoh" value={<span className="whitespace-pre-wrap">{student.note}</span>} /> : null}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-900">{value}</dd>
    </div>
  );
}
