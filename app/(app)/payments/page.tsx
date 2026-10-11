import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Banknote, CreditCard, Download, Landmark, Plus, ReceiptText, Search, Sparkles, Trash2, Wallet, type LucideIcon } from "lucide-react";
import { deletePayment } from "@/app/actions/payments";
import { FilterForm } from "@/components/FilterForm";
import { PaymentForm } from "@/components/PaymentForm";
import { SyncAlert } from "@/components/ShellParts";
import { ConfirmAction } from "@/components/SubmitButton";
import { Avatar, btn, Card, CardHeader, Chip, cx, inputCls, MiniStat, NoteCell, PageHeader, PageSkeleton, selectCls, td, th } from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import { shareOf, sharePercent } from "@/lib/share";
import { listPayments, listStudentOptions } from "@/lib/data";
import type { PaymentMethod } from "@/lib/models";
import { currentMonth, formatDate, formatMoney, formatNumber, isValidMonth, monthLabel, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "To‘lovlar" };

const METHOD: Record<PaymentMethod, { label: string; icon: LucideIcon; cls: string }> = {
  naqd: { label: "Naqd", icon: Banknote, cls: "bg-emerald-50 text-emerald-700" },
  karta: { label: "Karta", icon: CreditCard, cls: "bg-brand-50 text-brand-700" },
  otkazma: { label: "O‘tkazma", icon: Landmark, cls: "bg-sky-50 text-sky-700" },
};

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
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const q = str("q").slice(0, 100);
  const method = str("method") in METHOD ? str("method") : "";
  const [{ rows, totals }, students] = await Promise.all([listPayments(month, { q, method }), listStudentOptions(month)]);
  const preselect = students.some((s) => s.id === str("student")) ? str("student") : undefined;
  const filtered = Boolean(q || method);
  const pct = sharePercent();
  const shownTotal = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageHeader
        eyebrow="To‘lovlar boshqaruvi"
        title="To‘lovlar"
        subtitle="Tushumlarni qayd eting va to‘lovlar tarixini kuzating."
        actions={
          <a href={`/api/export/tolovlar?${new URLSearchParams({ month, ...(q ? { q } : {}), ...(method ? { method } : {}) })}`} className={btn.outline}>
            <Download className="size-[18px]" strokeWidth={1.8} aria-hidden />
            CSV yuklash
          </a>
        }
      />

      <Suspense fallback={null}>
        <SyncAlert />
      </Suspense>

      <div className="mb-6 grid gap-4 sm:grid-cols-3 xl:gap-5">
        <MiniStat
          label="Jami tushum"
          value={formatNumber(totals.total)}
          unit="so‘m"
          hint={
            <>
              Tushumning {pct}%: <span className="font-semibold text-ink-800">{formatMoney(shareOf(totals.total, pct))}</span>
            </>
          }
          icon={Wallet}
          tone="slate"
        />
        <MiniStat label="Naqd to‘lovlar" value={formatNumber(totals.cash)} unit="so‘m" icon={Banknote} tone="emerald" />
        <MiniStat label="Karta va o‘tkazma" value={formatNumber(totals.nonCash)} unit="so‘m" icon={CreditCard} tone="brand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <Card className="min-w-0">
          <CardHeader
            title="To‘lovlar tarixi"
            count={totals.count}
            subtitle={`${monthLabel(month)} uchun kiritilgan to‘lovlar`}
            right={<Chip>{rows.length} ta yozuv</Chip>}
          />
          <FilterForm action="/payments" className="flex flex-wrap items-center gap-3 border-t border-line-soft px-6 py-5">
            <input type="hidden" name="month" value={month} />
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">To‘lovni qidirish</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" strokeWidth={1.8} aria-hidden />
              <input name="q" type="search" defaultValue={q} placeholder="To‘lovni qidirish..." className={cx(inputCls, "pl-11")} />
            </label>
            <select name="method" defaultValue={method} className={selectCls} aria-label="To‘lov usuli">
              <option value="">Barcha usullar</option>
              {(Object.keys(METHOD) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD[m].label}
                </option>
              ))}
            </select>
          </FilterForm>

          {rows.length === 0 ? (
            <EmptyPayments filtered={filtered} />
          ) : (
            <div className="relative overflow-x-auto border-t border-line-soft">
              <table className="w-full min-w-[720px]">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className={th}>Sana</th>
                    <th className={th}>O‘quvchi</th>
                    <th className={cx(th, "text-right")}>Summa</th>
                    <th className={th}>Usul</th>
                    <th className={th}>Izoh</th>
                    <th className={th}>
                      <span className="sr-only">Amal</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((p) => {
                    const m = METHOD[p.method];
                    const Icon = m.icon;
                    return (
                      <tr key={p.id} className="transition hover:bg-slate-50/50">
                        <td className={cx(td, "num whitespace-nowrap pr-2 text-ink-500")}>{formatDate(p.paidAt)}</td>
                        <td className={td}>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={p.studentName} />
                            <div className="min-w-0">
                              {p.studentId ? (
                                <Link href={`/students/${p.studentId}?month=${month}`} className="block truncate text-[15px] font-medium text-ink-900 hover:text-brand-600">
                                  {p.studentName}
                                </Link>
                              ) : (
                                <span className="block truncate text-[15px] text-ink-400">{p.studentName}</span>
                              )}
                              <span className="block truncate text-[13px] text-ink-400">{p.studentGroup || "guruh belgilanmagan"}</span>
                            </div>
                          </div>
                        </td>
                        <td className={cx(td, "num whitespace-nowrap text-right text-[15px] font-semibold text-ink-900")}>{formatMoney(p.amount)}</td>
                        <td className={td}>
                          <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium", m.cls)}>
                            <Icon className="size-3.5" aria-hidden />
                            {m.label}
                          </span>
                        </td>
                        <td className={cx(td, "max-w-[170px] text-ink-500")}>
                          <NoteCell note={p.note} source={p.source} />
                        </td>
                        <td className={cx(td, "text-right")}>
                          <ConfirmAction
                            action={deletePayment.bind(null, p.id)}
                            confirmText={`${p.studentName}: ${formatMoney(p.amount)} to‘lov o‘chirilsinmi?`}
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
          {rows.length ? (
            <dl className="num border-t border-line px-6 py-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">Jami{filtered ? " (filtr bo‘yicha)" : ""}</dt>
                <dd className="text-[15px] font-semibold text-ink-900">{formatMoney(shownTotal)}</dd>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <dt className="text-ink-500">Tushumning {pct}%</dt>
                <dd className="text-[15px] font-semibold text-brand-700">{formatMoney(shareOf(shownTotal, pct))}</dd>
              </div>
            </dl>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-6 py-4 text-[13px] text-ink-400">
            <span>{rows.length} ta yozuv ko‘rsatilmoqda</span>
            <span>{monthLabel(month)}</span>
          </div>
        </Card>

        <Card id="yangi-tolov" className="order-first scroll-mt-24 self-start p-6 xl:order-none">
          <div className="mb-6 flex items-center gap-3.5">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600" aria-hidden>
              <Plus className="size-5" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Yangi to‘lov</h2>
              <p className="mt-0.5 text-sm text-ink-500">To‘lov ma’lumotlarini kiriting</p>
            </div>
          </div>
          {students.length ? (
            <PaymentForm key={`${month}-${preselect ?? ""}`} students={students} defaultStudentId={preselect} defaultMonth={month} today={todayISO()} />
          ) : (
            <p className="text-sm text-ink-500">
              Avval{" "}
              <Link href="/students/new" className="font-medium text-brand-600 hover:underline">
                o‘quvchi qo‘shing
              </Link>
              .
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function EmptyPayments({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center border-t border-line-soft px-6 py-14 text-center">
      <div className="relative mb-7 h-36 w-48" aria-hidden>
        <span className="absolute inset-x-6 inset-y-1 rounded-full bg-brand-50/70" />
        <span className="absolute left-9 top-5 h-28 w-24 -rotate-12 rounded-2xl border border-line bg-slate-50" />
        <span className="absolute left-[60px] top-2 flex h-28 w-24 rotate-6 flex-col rounded-2xl border border-line bg-white p-3.5 shadow-card">
          <ReceiptText className="size-6 text-brand-600" strokeWidth={1.8} />
          <span className="mt-4 h-1.5 w-14 rounded-full bg-line" />
          <span className="mt-2 h-1.5 w-10 rounded-full bg-line" />
        </span>
        <span className="absolute bottom-6 right-11 inline-flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-brand">
          <Plus className="size-4" strokeWidth={2.4} />
        </span>
        <Sparkles className="absolute bottom-9 left-5 size-4 text-amber-400" />
        <span className="absolute right-8 top-3 size-1.5 rounded-full bg-brand-300" />
      </div>
      {filtered ? (
        <>
          <p className="text-base font-semibold text-ink-900">Hech narsa topilmadi</p>
          <p className="mt-1.5 max-w-sm text-sm text-ink-500">Qidiruv yoki usul filtrini o‘zgartirib ko‘ring.</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-ink-900">Bu oy uchun to‘lov kiritilmagan</p>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">Birinchi to‘lovni forma orqali kiriting. Barcha hisob-kitoblar bir zumda yangilanadi.</p>
          <a href="#yangi-tolov" className={cx(btn.soft, "mt-6")}>
            <Plus className="size-[18px]" aria-hidden />
            Birinchi to‘lovni qo‘shish
          </a>
          <ol className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[13px] text-ink-400">
            {["O‘quvchi", "Summa", "Saqlash"].map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                {i > 0 ? (
                  <span className="text-ink-300" aria-hidden>
                    ›
                  </span>
                ) : null}
                <span className="num inline-flex size-5 items-center justify-center rounded-full border border-line text-[11px]">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
