import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Banknote, CalendarDays, CreditCard, HandCoins, Landmark, Pencil, Plus, Trash2, Wallet, type LucideIcon } from "lucide-react";
import { deletePayment } from "@/app/actions/payments";
import { deleteStudent } from "@/app/actions/students";
import { PaidCell } from "@/components/cells";
import { PaymentForm } from "@/components/PaymentForm";
import { ConfirmAction } from "@/components/SubmitButton";
import {
  Avatar,
  btn,
  Card,
  CardHeader,
  cx,
  EmptyState,
  GroupChip,
  MiniStat,
  NoteCell,
  PageSkeleton,
  StatusBadge,
  studentCode,
  Tag,
  td,
  th,
} from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import { getStudent, getStudentPayments } from "@/lib/data";
import type { PaymentMethod } from "@/lib/models";
import { compareMonths, currentMonth, formatDate, formatMoney, formatNumber, isValidMonth, monthLabel, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "O‘quvchi profili" };

const METHOD: Record<PaymentMethod, { label: string; icon: LucideIcon; cls: string }> = {
  naqd: { label: "Naqd", icon: Banknote, cls: "bg-emerald-50 text-emerald-700" },
  karta: { label: "Karta", icon: CreditCard, cls: "bg-brand-50 text-brand-700" },
  otkazma: { label: "O‘tkazma", icon: Landmark, cls: "bg-sky-50 text-sky-700" },
};

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
  const { payments, months, totalDebt, totalPaid } = await getStudentPayments(student);

  const now = currentMonth();
  // To'lov formasi uchun standart oy: URL dagi oy, bo'lmasa eng eski qarzdor oy, bo'lmasa joriy oy
  const oldestDebt = [...months].reverse().find((m) => m.status !== "paid" && compareMonths(m.month, now) <= 0);
  const formMonth = isValidMonth(sp.month) ? sp.month : oldestDebt?.month ?? now;
  const option = {
    id: student.id,
    name: student.fullName,
    group: student.group,
    fee: student.monthlyFee,
    paid: Object.fromEntries(months.map((m) => [m.month, m.paid])),
  };
  const code = studentCode(student.seq);

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={student.fullName} size="lg" />
          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">O‘quvchi profili</p>
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink-900 sm:text-[30px]">{student.fullName}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              {code ? <span className="num font-medium text-ink-400">{code}</span> : null}
              <GroupChip name={student.group} />
              {student.active ? <Tag tone="emerald">Faol</Tag> : <Tag>Nofaol</Tag>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/students/${student.id}/edit`} className={btn.outline}>
            <Pencil className="size-[17px]" strokeWidth={1.8} aria-hidden />
            Tahrirlash
          </Link>
          <ConfirmAction
            action={deleteStudent.bind(null, student.id, "/students")}
            confirmText={`${student.fullName} va uning barcha to‘lovlari o‘chirib yuborilsinmi? Bu amalni qaytarib bo‘lmaydi.`}
            className={btn.danger}
            pendingText="O‘chirilmoqda…"
          >
            <Trash2 className="size-[17px]" strokeWidth={1.8} aria-hidden />
            O‘chirish
          </ConfirmAction>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MiniStat label="Oylik to‘lov" value={formatNumber(student.monthlyFee)} unit="so‘m" icon={Wallet} tone="slate" />
        <MiniStat label="Jami to‘langan" value={formatNumber(totalPaid)} unit="so‘m" icon={HandCoins} tone="emerald" />
        <MiniStat label="Qarz" value={formatNumber(totalDebt)} unit="so‘m" icon={Banknote} tone={totalDebt ? "amber" : "emerald"} />
        <MiniStat label="O‘qishni boshlagan" value={formatDate(student.startDate)} icon={CalendarDays} tone="brand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              title="Oylar bo‘yicha holat"
              right={
                totalDebt > 0 ? (
                  <span className="num text-sm font-semibold text-amber-700">Jami qarz: {formatMoney(totalDebt)}</span>
                ) : (
                  <span className="text-sm font-semibold text-emerald-600">Qarz yo‘q ✓</span>
                )
              }
            />
            <div className="relative overflow-x-auto border-t border-line-soft">
              <table className="w-full min-w-[560px]">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className={th}>Oy</th>
                    <th className={th}>To‘landi / oylik</th>
                    <th className={cx(th, "text-right")}>Qarz</th>
                    <th className={th}>Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {months.map((m) => {
                    const future = compareMonths(m.month, now) > 0;
                    const debt = Math.max(0, student.monthlyFee - m.paid);
                    return (
                      <tr key={m.month} className="transition hover:bg-slate-50/50">
                        <td className={cx(td, "whitespace-nowrap font-medium text-ink-900")}>
                          {monthLabel(m.month)}
                          {future ? <span className="ml-2 text-xs font-normal text-ink-400">oldindan</span> : null}
                        </td>
                        <td className={td}>
                          <PaidCell paid={m.paid} fee={student.monthlyFee} />
                        </td>
                        <td className={cx(td, "num whitespace-nowrap text-right font-semibold", debt && !future ? "text-ink-900" : "text-ink-300")}>
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
            <CardHeader title="To‘lovlar tarixi" count={payments.length} />
            {payments.length === 0 ? (
              <div className="border-t border-line-soft">
                <EmptyState title="Hali to‘lov yo‘q">O‘ngdagi forma orqali birinchi to‘lovni kiriting.</EmptyState>
              </div>
            ) : (
              <div className="relative overflow-x-auto border-t border-line-soft">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className={th}>Sana</th>
                      <th className={th}>Oy uchun</th>
                      <th className={cx(th, "text-right")}>Summa</th>
                      <th className={th}>Usul</th>
                      <th className={th}>Izoh</th>
                      <th className={th}>
                        <span className="sr-only">Amal</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {payments.map((p) => {
                      const m = METHOD[p.method];
                      const Icon = m.icon;
                      return (
                        <tr key={p.id} className="transition hover:bg-slate-50/50">
                          <td className={cx(td, "num whitespace-nowrap text-ink-500")}>{formatDate(p.paidAt)}</td>
                          <td className={cx(td, "whitespace-nowrap")}>{monthLabel(p.month)}</td>
                          <td className={cx(td, "num whitespace-nowrap text-right font-semibold text-ink-900")}>{formatMoney(p.amount)}</td>
                          <td className={td}>
                            <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium", m.cls)}>
                              <Icon className="size-3.5" aria-hidden />
                              {m.label}
                            </span>
                          </td>
                          <td className={cx(td, "max-w-[180px] text-ink-500")}>
                            <NoteCell note={p.note} source={p.source} />
                          </td>
                          <td className={cx(td, "text-right")}>
                            <ConfirmAction
                              action={deletePayment.bind(null, p.id)}
                              confirmText={`${monthLabel(p.month)} uchun ${formatMoney(p.amount)} to‘lov o‘chirilsinmi?`}
                              className={btn.iconDanger}
                              pendingText="…"
                              title="To‘lovni o‘chirish"
                            >
                              <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                            </ConfirmAction>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="order-first flex min-w-0 flex-col gap-6 xl:order-none">
          <Card id="tolov" className="scroll-mt-24 p-6">
            <div className="mb-6 flex items-center gap-3.5">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600" aria-hidden>
                <Plus className="size-5" strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Yangi to‘lov</h2>
                <p className="mt-0.5 text-sm text-ink-500">{student.fullName} uchun</p>
              </div>
            </div>
            <PaymentForm key={formMonth} students={[option]} fixedStudentId={student.id} defaultMonth={formMonth} today={todayISO()} />
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Ma’lumotlar</h2>
            <dl className="grid gap-3.5 text-sm">
              <Info label="Telefon" value={student.phone ? <Phone value={student.phone} /> : "—"} />
              <Info label="Ota-ona telefoni" value={student.parentPhone ? <Phone value={student.parentPhone} /> : "—"} />
              <Info label="Guruh" value={student.group || "—"} />
              <Info label="Boshlagan sana" value={formatDate(student.startDate)} />
              {student.note ? <Info label="Izoh" value={<span className="whitespace-pre-wrap">{student.note}</span>} /> : null}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Phone({ value }: { value: string }) {
  return (
    <a className="num text-ink-900 hover:text-brand-600" href={`tel:${value.replace(/[^\d+]/g, "")}`}>
      {value}
    </a>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2">
      <dt className="text-ink-400">{label}</dt>
      <dd className="min-w-0 text-ink-900">{value}</dd>
    </div>
  );
}
