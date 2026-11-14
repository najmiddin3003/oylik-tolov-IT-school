import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  Banknote,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  HandCoins,
  Hourglass,
  Landmark,
  Pencil,
  Phone as PhoneIcon,
  Plus,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { archivePayment } from "@/app/actions/payments";
import { deleteStudent } from "@/app/actions/students";
import { PaidCell } from "@/components/cells";
import { NextLessonCell } from "@/components/Lessons";
import { EditedMark, EditPaymentButton } from "@/components/PaymentEdit";
import { ReceiptLink } from "@/components/ReceiptActions";
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
  IconTile,
  NoteCell,
  PageSkeleton,
  StatusBadge,
  studentCode,
  Tag,
  type Tone,
} from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { canPickPaymentDate, getStudent, getStudentAttendance, getStudentPayments, type StudentAttendanceRow } from "@/lib/data";
import { ATTENDANCE_LABEL } from "@/lib/attendance-rules";
import { discountAt, discountLabel } from "@/lib/discounts";
import type { PaymentMethod } from "@/lib/models";
import { compareMonths, currentMonth, formatDate, formatMoney, formatNumber, isValidMonth, monthLabel, monthOfDate, nowMs, todayISO } from "@/lib/time";

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
  const { role } = await roleGuard(["owner", "teacher"]);
  // O'qituvchi — faqat o'z o'quvchisini ko'radi (o'zgartirish, to'lov kiritish va o'chirish yo'q)
  const readOnly = role !== "owner";
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const student = await getStudent(id);
  if (!student) notFound();
  const [{ payments, months, totalDebt, totalPaid }, pickDate, attendance] = await Promise.all([
    getStudentPayments(student),
    canPickPaymentDate(role),
    getStudentAttendance(student.id),
  ]);

  const now = currentMonth();
  const currentDiscount = discountAt(student.discountHistory, now);
  // To'lov formasi uchun standart oy: URL dagi oy, bo'lmasa eng eski qarzdor oy, bo'lmasa joriy oy
  const oldestDebt = [...months].reverse().find((m) => m.status !== "paid" && compareMonths(m.month, now) <= 0);
  const formMonth = isValidMonth(sp.month) ? sp.month : oldestDebt?.month ?? now;
  const option = {
    id: student.id,
    name: student.fullName,
    group: student.group,
    monthlyFee: student.monthlyFee,
    feeHistory: student.feeHistory,
    discountHistory: student.discountHistory,
    paid: Object.fromEntries(months.map((m) => [m.month, m.paid])),
  };
  const feeSteps = [
    { from: monthOfDate(new Date(student.startDate)), fee: student.monthlyFee },
    ...student.feeHistory,
  ];
  const code = studentCode(student.seq);
  // To'lovlar oylar bo'yicha (har oy qatori ochilsa — shu oy to'lovlari)
  const byMonth = new Map<string, typeof payments>();
  for (const p of payments) byMonth.set(p.month, [...(byMonth.get(p.month) ?? []), p]);
  const listFeeNow = feeSteps.filter((f) => compareMonths(f.from, now) <= 0).at(-1)?.fee ?? student.monthlyFee;
  const att = { present: 0, absent: 0, excused: 0 };
  for (const r of attendance) att[r.status]++;
  const attPct = attendance.length ? Math.round((att.present / attendance.length) * 100) : null;
  const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;

  return (
    <>
      {/* Sarlavha: ism, kurs/o'qituvchi/holat va tez amallar (qo'ng'iroq, to'lov, tahrirlash) */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={student.fullName} size="lg" />
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">O‘quvchi profili{code ? ` · ${code}` : ""}</p>
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.025em] text-ink-900 sm:text-[30px]">{student.fullName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <GroupChip name={student.group} />
              {student.teacherName ? (
                <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50/70 px-2.5 text-[13px] font-medium text-brand-800">
                  <GraduationCap className="size-3.5 shrink-0 text-brand-500" aria-hidden />
                  <span className="truncate">{student.teacherName}</span>
                </span>
              ) : null}
              {student.active ? <Tag tone="emerald">Faol</Tag> : <Tag>Nofaol</Tag>}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {student.phone ? (
            <a href={tel(student.phone)} className={cx(btn.outline, "px-3")} title={`O‘quvchi: ${student.phone}`}>
              <PhoneIcon className="size-4" aria-hidden />
              <span className="sm:hidden xl:inline">O‘quvchi</span>
            </a>
          ) : null}
          {student.parentPhone ? (
            <a href={tel(student.parentPhone)} className={cx(btn.outline, "px-3")} title={`Ota-ona: ${student.parentPhone}`}>
              <PhoneIcon className="size-4" aria-hidden />
              <span className="sm:hidden xl:inline">Ota-ona</span>
            </a>
          ) : null}
          <Link href={`/students/${student.id}/edit`} className={cx(btn.outline, "px-3")} title="Tahrirlash">
            <Pencil className="size-4" strokeWidth={1.8} aria-hidden />
            Tahrirlash
          </Link>
          {readOnly ? null : (
            <>
              <a href="#tolov" className={cx(btn.primary, "px-4 xl:hidden")}>
                <Plus className="size-4" aria-hidden />
                To‘lov
              </a>
              <ConfirmAction
                action={deleteStudent.bind(null, student.id, "/students")}
                confirmText={`${student.fullName} va uning barcha to‘lovlari o‘chirib yuborilsinmi? Bu amalni qaytarib bo‘lmaydi.`}
                className={cx(btn.iconDanger, "size-11 rounded-xl border border-line bg-surface")}
                pendingText="…"
                title="O‘quvchini o‘chirish"
              >
                <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </ConfirmAction>
            </>
          )}
        </div>
      </div>

      {/* Asosiy ko'rsatkichlar: telefonda 2×2 */}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
        <Stat
          icon={Wallet}
          tone="violet"
          label="Oylik to‘lov"
          value={formatNumber(student.currentFee)}
          hint={
            currentDiscount ? (
              <>
                <span className="line-through">{formatNumber(listFeeNow)}</span> · {currentDiscount.name} {discountLabel(currentDiscount)}
              </>
            ) : (
              `${monthLabel(feeSteps.at(-1)!.from)} dan`
            )
          }
        />
        <Stat icon={HandCoins} tone="emerald" label="Jami to‘langan" value={formatNumber(totalPaid)} hint={`${payments.length} ta to‘lov`} />
        <Stat
          icon={Hourglass}
          tone={totalDebt ? "amber" : "emerald"}
          label="Qarz"
          value={formatNumber(totalDebt)}
          hint={totalDebt ? (oldestDebt ? `${monthLabel(oldestDebt.month)} dan` : "") : "Qarz yo‘q ✓"}
        />
        <Stat
          icon={ClipboardCheck}
          tone={attPct === null ? "slate" : attPct >= 80 ? "emerald" : attPct >= 60 ? "amber" : "rose"}
          label="Davomat"
          value={attPct === null ? "—" : `${attPct}%`}
          hint={attendance.length ? `kelmadi ${att.absent} · sababli ${att.excused}` : "hali qilinmagan"}
          unit=""
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Oylar bo'yicha holat va to'lovlar — bitta ro'yxat: oy qatori ochilsa, shu oy to'lovlari */}
          <Card className="overflow-hidden">
            <CardHeader
              title="To‘lovlar"
              subtitle="Oy qatorini bossangiz — shu oy to‘lovlari ochiladi"
              right={
                totalDebt > 0 ? (
                  <span className="num text-sm font-semibold text-amber-700">Jami qarz: {formatMoney(totalDebt)}</span>
                ) : (
                  <span className="text-sm font-semibold text-emerald-600">Qarz yo‘q ✓</span>
                )
              }
            />
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {months.map((m) => {
                const future = compareMonths(m.month, now) > 0;
                const debt = Math.max(0, m.fee - m.paid);
                const list = byMonth.get(m.month) ?? [];
                return (
                  <li key={m.month}>
                    <details className="accordion" open={m.month === now || m.month === formMonth}>
                      <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-slate-50/60 sm:grid-cols-[9.5rem_minmax(0,1fr)_7.5rem_7rem_1.25rem] sm:px-6">
                        <span className="min-w-0">
                          <span className="block font-medium text-ink-900">{monthLabel(m.month)}</span>
                          <span className="num block text-xs text-ink-400">
                            {list.length ? `${list.length} ta to‘lov` : "to‘lov yo‘q"}
                            {future ? " · oldindan" : ""}
                          </span>
                        </span>
                        <span className="hidden sm:block">
                          <PaidCell paid={m.paid} fee={m.fee} />
                        </span>
                        <span className={cx("num whitespace-nowrap text-right text-sm font-semibold", debt && !future ? "text-ink-900" : "text-ink-300")}>
                          {debt && !future ? formatMoney(debt) : "—"}
                        </span>
                        <span className="justify-self-end">
                          <StatusBadge status={m.status} />
                        </span>
                        <ChevronDown className="accordion-chevron hidden size-4 text-ink-400 sm:block" aria-hidden />
                      </summary>
                      <div className="border-t border-line-soft bg-slate-50/50 px-4 py-2 sm:px-6">
                        <p className="num py-1.5 text-[13px] text-ink-500 sm:hidden">
                          To‘landi {formatNumber(m.paid)} / {formatNumber(m.fee)}
                        </p>
                        {list.length ? (
                          <ul className="divide-y divide-line-soft">
                            {list.map((p) => {
                              const meth = METHOD[p.method];
                              const Icon = meth.icon;
                              return (
                                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                                  <span className="num w-24 shrink-0 text-sm text-ink-500">{formatDate(p.paidAt)}</span>
                                  <span className="num min-w-24 text-[15px] font-semibold text-ink-900">
                                    {formatMoney(p.amount)}
                                    <EditedMark payment={p} className="mt-0.5" />
                                  </span>
                                  <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium", meth.cls)}>
                                    <Icon className="size-3.5" aria-hidden />
                                    {meth.label}
                                  </span>
                                  <span className="min-w-0 flex-1 text-sm text-ink-500">
                                    <NoteCell note={p.note} source={p.source} />
                                  </span>
                                  <span className="ml-auto flex items-center gap-0.5">
                                    <ReceiptLink paymentId={p.id} />
                                    {readOnly ? null : (
                                      <>
                                        <EditPaymentButton payment={p} />
                                        <ConfirmAction
                                          action={archivePayment.bind(null, p.id)}
                                          confirmText={`${monthLabel(p.month)} uchun ${formatMoney(p.amount)} to‘lov arxivga o‘tkazilsinmi? U hisob-kitoblardan chiqadi, «To‘lovlar → Arxiv» dan qaytarish mumkin.`}
                                          className={btn.iconDanger}
                                          pendingText="…"
                                          title="Arxivga o‘tkazish"
                                        >
                                          <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                                        </ConfirmAction>
                                      </>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="py-2.5 text-sm text-ink-500">
                            Bu oy uchun to‘lov yo‘q.{" "}
                            {readOnly || future ? null : (
                              <Link href={`/students/${student.id}?month=${m.month}#tolov`} className="font-medium text-brand-600 hover:underline">
                                To‘lov kiritish
                              </Link>
                            )}
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
            {!months.length ? <EmptyState title="Hali to‘lov yo‘q">To‘lov formasi orqali birinchi to‘lovni kiriting.</EmptyState> : null}
          </Card>

          <AttendanceCard rows={attendance} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {readOnly ? null : (
            <Card id="tolov" className="scroll-mt-24 p-5 sm:p-6">
              <div className="group mb-5 flex items-center gap-3.5">
                <IconTile icon={Plus} tone="brand" variant="solid" />
                <div>
                  <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Yangi to‘lov</h2>
                  <p className="mt-0.5 text-sm text-ink-500">{student.fullName} uchun</p>
                </div>
              </div>
              {/* Kalit faqat URL dagi oy bo'yicha: to'lovdan keyin forma qayta yaralmaydi va "saqlandi" xabari ko'rinib turadi */}
              <PaymentForm
                key={isValidMonth(sp.month) ? sp.month : "auto"}
                students={[option]}
                fixedStudentId={student.id}
                defaultMonth={formMonth}
                today={todayISO()}
                canPickDate={pickDate}
              />
            </Card>
          )}

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Ma’lumotlar</h2>
            <dl className="grid gap-3.5 text-sm">
              <Info label="Telefon" value={student.phone ? <Phone value={student.phone} /> : <span className="text-ink-400">kiritilmagan</span>} />
              <Info label="Ota-ona" value={student.parentPhone ? <Phone value={student.parentPhone} /> : <span className="text-ink-400">kiritilmagan</span>} />
              <Info
                label="Dars vaqti"
                value={
                  student.lessons.length ? (
                    <NextLessonCell lessons={student.lessons} serverNow={nowMs()} muted={!student.active} away={student.away} fluid />
                  ) : (
                    <Link href={`/students/${student.id}/edit`} className="font-medium text-brand-600 hover:underline">
                      Kiritish
                    </Link>
                  )
                }
              />
              <Info label="Boshlagan" value={formatDate(student.startDate)} />
              <Info
                label="Oylik narx"
                value={
                  <ul className="grid gap-0.5">
                    {feeSteps.map((f) => (
                      <li key={f.from} className="num">
                        {formatMoney(f.fee)} <span className="text-ink-400">· {monthLabel(f.from)} dan</span>
                      </li>
                    ))}
                  </ul>
                }
              />
              {student.discounts ? (
                <Info
                  label="Chegirma"
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      {currentDiscount ? (
                        <Tag tone="amber">{`${currentDiscount.name} · ${discountLabel(currentDiscount)} · ${monthLabel(currentDiscount.from)} dan`}</Tag>
                      ) : (
                        <span className="text-ink-400">yo‘q</span>
                      )}
                      {readOnly ? null : (
                        <Link href="/chegirmalar" className="text-xs font-medium text-brand-600 hover:underline">
                          O‘zgartirish
                        </Link>
                      )}
                    </span>
                  }
                />
              ) : null}
              {student.note ? <Info label="Izoh" value={<span className="whitespace-pre-wrap">{student.note}</span>} /> : null}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Ixcham ko'rsatkich (telefonda 2×2 sig'adi). */
function Stat({ icon: Icon, tone, label, value, hint, unit = "so‘m" }: { icon: LucideIcon; tone: Tone; label: string; value: string; hint?: ReactNode; unit?: string }) {
  return (
    <Card className="group flex min-w-0 items-start gap-3 p-3.5 sm:p-5">
      {/* Telefonda belgisiz — raqam to'liq sig'ishi uchun */}
      <span className="hidden sm:block">
        <IconTile icon={Icon} tone={tone} size="md" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-ink-500 sm:text-sm">{label}</p>
        <p className="num mt-0.5 truncate text-[19px] font-bold leading-tight tracking-[-0.02em] text-ink-900 sm:text-[24px]">
          {value}
          {unit && value !== "—" ? <span className="ml-1 text-xs font-medium text-ink-400 sm:text-sm">{unit}</span> : null}
        </p>
        {hint ? <p className="num mt-1 truncate text-xs text-ink-500">{hint}</p> : null}
      </div>
    </Card>
  );
}

function Phone({ value }: { value: string }) {
  return (
    <a className="num inline-flex items-center gap-1.5 text-ink-900 hover:text-brand-600" href={`tel:${value.replace(/[^\d+]/g, "")}`}>
      <PhoneIcon className="size-3.5 text-ink-400" aria-hidden />
      {value}
    </a>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2">
      <dt className="text-ink-400">{label}</dt>
      <dd className="min-w-0 text-ink-900">{value}</dd>
    </div>
  );
}

/** Davomat: oxirgi darslar rangli nuqtalar qatori (eskisidan yangisiga) va kelmagan / sababli kunlar izohi bilan. */
function AttendanceCard({ rows }: { rows: StudentAttendanceRow[] }) {
  const count = (st: StudentAttendanceRow["status"]) => rows.filter((r) => r.status === st).length;
  const misses = rows.filter((r) => r.status !== "present");
  const DOT = { present: "bg-emerald-500", absent: "bg-rose-500", excused: "bg-amber-400" } as const;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Davomat" subtitle={rows.length ? `Oxirgi ${rows.length} ta dars` : undefined} />
      {rows.length ? (
        <div className="border-t border-line-soft px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Oxirgi darslar">
            {[...rows].reverse().map((r) => (
              <span
                key={r.date}
                className={cx("size-3.5 rounded-full ring-2 ring-surface", DOT[r.status])}
                title={`${formatDate(r.date)}${r.start ? ` ${r.start}` : ""} — ${ATTENDANCE_LABEL[r.status]}${r.note ? `: ${r.note}` : ""}`}
              />
            ))}
          </div>
          <p className="num mt-3 flex flex-wrap gap-1.5">
            <Tag tone="emerald">Keldi: {count("present")}</Tag>
            <Tag tone="rose">Kelmadi: {count("absent")}</Tag>
            <Tag tone="amber">Sababli: {count("excused")}</Tag>
          </p>
          {misses.length ? (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {misses.slice(0, 12).map((r) => (
                <li key={r.date} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="num w-24 shrink-0 text-ink-500">{formatDate(r.date)}</span>
                  <span className={cx("font-medium", r.status === "absent" ? "text-rose-600" : "text-amber-700")}>{ATTENDANCE_LABEL[r.status]}</span>
                  {r.note ? <span className="min-w-0 text-ink-600">— {r.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-emerald-700">Barcha darslarga kelgan ✓</p>
          )}
        </div>
      ) : (
        <p className="border-t border-line-soft px-6 py-5 text-sm text-ink-400">Hali davomat qilinmagan.</p>
      )}
    </Card>
  );
}
