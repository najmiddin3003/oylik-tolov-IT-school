import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Banknote,
  CalendarSearch,
  CreditCard,
  Download,
  HandCoins,
  Hourglass,
  Landmark,
  Plus,
  ReceiptText,
  Sparkles,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { archivePayment, purgePayment, restorePayment } from "@/app/actions/payments";
import { FilterForm, SearchInput } from "@/components/FilterForm";
import { TodayLessons } from "@/components/Lessons";
import { UnpaidButton } from "@/components/Notifications";
import { PaymentForm } from "@/components/PaymentForm";
import { DatePicker, Select } from "@/components/pickers";
import { ReminderBanner, SyncAlert } from "@/components/ShellParts";
import { ConfirmAction } from "@/components/SubmitButton";
import { Avatar, btn, Card, CountBadge, cx, EmptyState, IconTile, PageHeader, PageSkeleton, Progress, Tag, type Tone } from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import {
  countArchivedPayments,
  getMonthOverview,
  getShareSummary,
  listArchivedPayments,
  listPayments,
  listStudentOptions,
  listUnpaid,
  type PaymentRow,
  type ShareSummary,
} from "@/lib/data";
import type { PaymentMethod } from "@/lib/models";
import { dayLabel } from "@/lib/reminders";
import type { Role } from "@/lib/session";
import { currentMonth, dateToISO, formatDate, formatDateTime, formatMoney, formatNumber, isoToDate, isValidMonth, MONTH_NAMES, monthLabel, nowMs, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "To‘lovlar" };

const METHOD: Record<PaymentMethod, { label: string; icon: LucideIcon; cls: string }> = {
  naqd: { label: "Naqd", icon: Banknote, cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  karta: { label: "Karta", icon: CreditCard, cls: "bg-brand-50 text-brand-700 ring-brand-100" },
  otkazma: { label: "O‘tkazma", icon: Landmark, cls: "bg-sky-50 text-sky-700 ring-sky-100" },
};

export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}

async function Payments({ searchParams }: { searchParams: PageProps<"/payments">["searchParams"] }) {
  const { role } = await pageGuard();
  const isOwner = role === "owner";
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const view = isOwner && str("view") === "arxiv" ? "arxiv" : "list";
  const q = str("q").slice(0, 100);
  const method = str("method") in METHOD ? str("method") : "";
  const day = isoToDate(str("day")) ? str("day") : "";

  const [overview, list, students, archivedCount, archived] = await Promise.all([
    getMonthOverview(month),
    listPayments(month, { q, method, day }),
    listStudentOptions(month),
    isOwner ? countArchivedPayments() : Promise.resolve(0),
    view === "arxiv" ? listArchivedPayments() : Promise.resolve([] as PaymentRow[]),
  ]);
  const [share, unpaidList] = await Promise.all([
    isOwner ? getShareSummary(month, overview.totals.collected) : Promise.resolve(null),
    listUnpaid(month),
  ]);
  const { totals, debtors } = overview;
  const preselect = students.some((s) => s.id === str("student")) ? str("student") : undefined;
  // «Bugun darsga keladi»: jadvali bor o'quvchilar (tanlangan oy bo'yicha holati bilan)
  const scheduled = overview.rows
    .filter((r) => r.lessons.length)
    .map((r) => ({ id: r.id, name: r.fullName, phone: r.phone, fee: r.monthlyFee, paid: r.paid, debt: r.debt, status: r.status, lessons: r.lessons }));
  const unscheduled = debtors.filter((r) => !r.lessons.length).length;
  const planDone = totals.expected - totals.debt;
  const exportQs = new URLSearchParams({ month, ...(q ? { q } : {}), ...(method ? { method } : {}), ...(day ? { day } : {}) });

  return (
    <>
      <PageHeader
        eyebrow="To‘lovlar boshqaruvi"
        title="To‘lovlar"
        subtitle={`${monthLabel(month)}: kutilayotgan tushum, tushgan summa va qolgan qarz.`}
        actions={
          <a href={`/api/export/tolovlar?${exportQs}`} className={cx(btn.outline, "group")}>
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-600 text-white" aria-hidden>
              <Download className="icon-wiggle size-3.5" strokeWidth={2.4} />
            </span>
            Excel yuklash
          </a>
        }
      />

      {isOwner ? (
        <Suspense fallback={null}>
          <SyncAlert />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <ReminderBanner />
      </Suspense>

      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:gap-5">
        <MoneyCard
          label="Kutilayotgan tushum"
          value={totals.expected}
          icon={Target}
          tone="brand"
          hint={`${totals.students} ta o‘quvchining ${monthLabel(month)} uchun oylik to‘lovi`}
        />
        <MoneyCard
          label="Tushgan summa"
          value={totals.collected}
          icon={HandCoins}
          tone="emerald"
          hint={
            <span className="num">
              Naqd {formatNumber(totals.cash)} · Karta va o‘tkazma {formatNumber(totals.nonCash)}
            </span>
          }
        >
          {share ? <ShareBox share={share} month={month} /> : null}
        </MoneyCard>
        <MoneyCard
          label="Qolgan qarz"
          value={totals.debt}
          icon={Hourglass}
          tone="amber"
          hint={
            debtors.length ? (
              <UnpaidButton
                month={month}
                students={unpaidList}
                role={role}
                className="inline-flex items-center gap-1 font-semibold text-amber-700 underline-offset-4 transition hover:text-amber-900 hover:underline"
              >
                {debtors.length} ta o‘quvchi to‘lamagan — ro‘yxat
                <ArrowRight className="size-3.5" aria-hidden />
              </UnpaidButton>
            ) : totals.students ? (
              <span className="font-semibold text-emerald-600">Hamma to‘lagan 🎉</span>
            ) : (
              "Bu oyda o‘quvchi yo‘q"
            )
          }
        >
          <div className="mt-3">
            <Progress value={planDone} max={totals.expected} className="h-2" />
            <p className="num mt-1.5 text-xs text-ink-400">
              Reja bajarildi: {totals.expected ? Math.round((planDone / totals.expected) * 100) : 0}%
            </p>
          </div>
        </MoneyCard>
      </div>

      <TodayLessons students={scheduled} month={month} serverNow={nowMs()} role={role} unscheduled={unscheduled} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <Card className="min-w-0 self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
            {isOwner ? (
              <nav className="-mb-px flex gap-6" aria-label="Bo‘limlar">
                <TabLink href={`/payments?${new URLSearchParams({ month })}`} active={view === "list"} count={list.rows.length}>
                  To‘lovlar tarixi
                </TabLink>
                <TabLink href={`/payments?${new URLSearchParams({ month, view: "arxiv" })}`} active={view === "arxiv"} count={archivedCount}>
                  <Archive className="size-4" aria-hidden />
                  Arxiv
                </TabLink>
              </nav>
            ) : (
              <h2 className="flex items-center gap-2.5 pb-3 text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
                To‘lovlar tarixi
                <CountBadge n={list.rows.length} />
              </h2>
            )}
          </div>

          {view === "arxiv" ? (
            <ArchiveList rows={archived} month={month} />
          ) : (
            <>
              <FilterForm action="/payments" className="flex flex-wrap items-center gap-3 border-t border-line-soft px-6 py-5">
                <input type="hidden" name="month" value={month} />
                <SearchInput defaultValue={q} placeholder="Ism yoki izoh..." label="To‘lovni qidirish" />
                <Select
                  name="method"
                  defaultValue={method}
                  autoSubmit
                  aria-label="To‘lov usuli"
                  wrapperClassName="w-full sm:w-44"
                  options={[
                    { value: "", label: "Barcha usullar" },
                    ...(Object.keys(METHOD) as PaymentMethod[]).map((m) => {
                      const Icon = METHOD[m].icon;
                      return { value: m, label: METHOD[m].label, icon: <Icon className="size-4 text-ink-400" aria-hidden /> };
                    }),
                  ]}
                />
                <DatePicker
                  name="day"
                  defaultValue={day}
                  autoSubmit
                  clearable
                  max={todayISO()}
                  placeholder="Kun bo‘yicha"
                  aria-label="To‘lov kuni"
                  wrapperClassName="w-full sm:w-52"
                />
              </FilterForm>

              {day ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-line-soft bg-brand-50/40 px-6 py-2.5 text-sm text-brand-900">
                  <CalendarSearch className="size-4 text-brand-500" aria-hidden />
                  <span>
                    <b className="font-semibold">{dayLabel(day)}</b> kuni qabul qilingan barcha to‘lovlar (qaysi oy uchunligidan qat’i nazar)
                  </span>
                  <Link
                    href={`/payments?${new URLSearchParams({ month, ...(q ? { q } : {}), ...(method ? { method } : {}) })}`}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-brand-700 hover:bg-brand-100"
                    scroll={false}
                  >
                    <X className="size-3.5" aria-hidden />
                    Kunni tozalash
                  </Link>
                </div>
              ) : null}

              {list.rows.length === 0 ? (
                <EmptyPayments filtered={Boolean(q || method || day)} />
              ) : (
                <DayGroups rows={list.rows} month={month} role={role} />
              )}

              {list.rows.length ? (
                <div className="num flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-sm">
                  <span className="text-ink-500">
                    Jami{q || method || day ? " (filtr bo‘yicha)" : ""}: {list.rows.length} ta to‘lov
                  </span>
                  <span className="text-[17px] font-bold text-ink-900">{formatMoney(list.total)}</span>
                </div>
              ) : null}
            </>
          )}
        </Card>

        <Card id="yangi-tolov" className="order-first scroll-mt-24 self-start p-6 xl:order-none">
          <div className="group mb-6 flex items-center gap-3.5">
            <IconTile icon={Plus} tone="brand" variant="solid" />
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Yangi to‘lov</h2>
              <p className="mt-0.5 text-sm text-ink-500">To‘lov ma’lumotlarini kiriting</p>
            </div>
          </div>
          {students.length ? (
            <PaymentForm
              key={`${month}-${preselect ?? ""}`}
              students={students}
              defaultStudentId={preselect}
              defaultMonth={month}
              today={todayISO()}
              canPickDate={isOwner}
            />
          ) : (
            <p className="text-sm text-ink-500">
              {isOwner ? (
                <>
                  Avval{" "}
                  <Link href="/students/new" className="font-medium text-brand-600 hover:underline">
                    o‘quvchi qo‘shing
                  </Link>
                  .
                </>
              ) : (
                "Hali faol o‘quvchi yo‘q."
              )}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function MoneyCard({
  label,
  value,
  icon,
  tone,
  hint,
  children,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: Tone;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="group flex flex-col p-5 transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-medium text-ink-600">{label}</p>
        <IconTile icon={icon} tone={tone} />
      </div>
      <p className="num mt-2 text-[30px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
        {formatNumber(value)}
        <span className="ml-1 text-base font-semibold text-ink-400">so‘m</span>
      </p>
      {hint ? <div className="mt-1.5 text-[13px] text-ink-500">{hint}</div> : null}
      {children}
    </Card>
  );
}

/** Rahbar uchun: tushum ulushi, olingan oylik/avans va qolgani. */
function ShareBox({ share, month }: { share: ShareSummary; month: string }) {
  return (
    <dl className="num mt-3 grid gap-1 rounded-xl bg-linear-to-br from-brand-50 to-violet-50/70 px-3 py-2.5 text-[13px] ring-1 ring-inset ring-brand-100">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ink-500">Tushumning {share.percent}%</dt>
        <dd className="font-semibold text-ink-900">{formatMoney(share.share)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ink-500">
          <Link href={`/settings?${new URLSearchParams({ month })}#oylik`} className="underline-offset-4 hover:text-brand-700 hover:underline">
            Olindi (oylik/avans)
          </Link>
        </dt>
        <dd className="font-semibold text-ink-700">− {formatMoney(share.taken)}</dd>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-3 border-t border-brand-100 pt-1.5">
        <dt className="font-medium text-ink-700">Qoldi</dt>
        <dd className={cx("text-[15px] font-bold", share.left < 0 ? "text-rose-600" : "text-emerald-600")}>{formatMoney(share.left)}</dd>
      </div>
    </dl>
  );
}

function TabLink({ href, active, count, children }: { href: string; active: boolean; count: number; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative flex items-center gap-2 pb-3 text-[15px] font-semibold transition",
        active ? "text-brand-700 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600" : "text-ink-500 hover:text-ink-900",
      )}
    >
      {children}
      <CountBadge n={count} tone={active ? "brand" : "slate"} />
    </Link>
  );
}

/** "Oktabr uchun" (boshqa yil bo'lsa — "Dekabr 2025 uchun"). */
function forMonth(m: string, pageMonth: string): string {
  const name = MONTH_NAMES[Number(m.slice(5, 7)) - 1];
  return m.slice(0, 4) === pageMonth.slice(0, 4) ? name : `${name} ${m.slice(0, 4)}`;
}

function MethodBadge({ method }: { method: PaymentMethod }) {
  const m = METHOD[method];
  const Icon = m.icon;
  return (
    <span className={cx("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium ring-1 ring-inset", m.cls)}>
      <Icon className="size-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

/** To'lovlar tarixi: kunlar bo'yicha guruh — har kun sarlavhasida to'lovlar soni va jami summa. */
function DayGroups({ rows, month, role }: { rows: PaymentRow[]; month: string; role: Role }) {
  const groups: { day: string; rows: PaymentRow[]; total: number }[] = [];
  for (const r of rows) {
    const d = dateToISO(new Date(r.paidAt));
    const g = groups[groups.length - 1];
    if (g && g.day === d) {
      g.rows.push(r);
      g.total += r.amount;
    } else groups.push({ day: d, rows: [r], total: r.amount });
  }
  const today = todayISO();

  return (
    <div className="border-t border-line-soft">
      {groups.map((g) => (
        <section key={g.day} aria-label={dayLabel(g.day)}>
          <header className="flex items-center justify-between gap-3 border-b border-line-soft bg-slate-50/80 px-6 py-2.5">
            <h3 className="text-sm font-semibold text-ink-800 first-letter:uppercase">
              {dayLabel(g.day)}
              {g.day === today ? <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">bugun</span> : null}
            </h3>
            <p className="num text-[13px] text-ink-500">
              {g.rows.length} ta · <span className="font-semibold text-ink-900">{formatMoney(g.total)}</span>
            </p>
          </header>
          <ul className="divide-y divide-line-soft">
            {g.rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5 transition hover:bg-slate-50/50 sm:flex-nowrap">
                <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                  <Avatar name={p.studentName} />
                  <div className="min-w-0">
                    {p.studentId && role === "owner" ? (
                      <Link href={`/students/${p.studentId}?month=${p.month}`} className="block truncate text-[15px] font-semibold text-ink-900 hover:text-brand-600">
                        {p.studentName}
                      </Link>
                    ) : (
                      <span className="block truncate text-[15px] font-semibold text-ink-900">{p.studentName}</span>
                    )}
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-ink-500">
                      <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-px font-medium text-violet-700">{forMonth(p.month, month)} uchun</span>
                      {p.source === "sheets" ? <Tag tone="emerald">Sheets</Tag> : null}
                      {p.note ? (
                        <span className="truncate" title={p.note}>
                          {p.source === "sheets" ? p.note.replace(/^Google Sheets,?\s*/, "") : p.note}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3 pl-[52px] sm:pl-0">
                  <MethodBadge method={p.method} />
                  <span className="num w-32 whitespace-nowrap text-right text-[16px] font-bold text-ink-900">{formatMoney(p.amount)}</span>
                  <ConfirmAction
                    action={archivePayment.bind(null, p.id)}
                    confirmText={
                      role === "owner"
                        ? `${p.studentName}: ${formatMoney(p.amount)} to‘lov arxivga o‘tkazilsinmi? U hisob-kitoblardan chiqadi, arxivdan qaytarish mumkin.`
                        : `${p.studentName}: ${formatMoney(p.amount)} to‘lov o‘chirilsinmi?`
                    }
                    className={btn.iconDanger}
                    pendingText="…"
                    title={role === "owner" ? "Arxivga o‘tkazish" : "O‘chirish"}
                  >
                    <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                  </ConfirmAction>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Arxivlangan to'lovlar (faqat rahbar): ko'rish, tiklash, butunlay o'chirish. */
function ArchiveList({ rows, month }: { rows: PaymentRow[]; month: string }) {
  if (!rows.length) {
    return (
      <div className="border-t border-line-soft">
        <EmptyState title="Arxiv bo‘sh" icon={Archive} tone="slate">
          O‘chirilgan (arxivlangan) to‘lovlar shu yerda saqlanadi. Ular hech qayerda hisoblanmaydi.
        </EmptyState>
      </div>
    );
  }
  return (
    <>
      <p className="border-t border-line-soft bg-slate-50/70 px-6 py-2.5 text-[13px] text-ink-500">
        Arxivdagi to‘lovlar hech qayerda ko‘rinmaydi va hisoblanmaydi. Ularni faqat siz ko‘rasiz.
      </p>
      <ul className="divide-y divide-line-soft border-t border-line-soft">
        {rows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
            <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
              <Avatar name={p.studentName} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  {p.studentId ? (
                    <Link href={`/students/${p.studentId}?month=${p.month}`} className="truncate text-[15px] font-semibold text-ink-900 hover:text-brand-600">
                      {p.studentName}
                    </Link>
                  ) : (
                    <span className="truncate text-[15px] font-semibold text-ink-900">{p.studentName}</span>
                  )}
                  <span className="num text-[15px] font-bold text-ink-500 line-through decoration-rose-400/70">{formatMoney(p.amount)}</span>
                </p>
                <p className="num mt-0.5 text-[13px] text-ink-500">
                  {forMonth(p.month, month)} uchun · to‘langan {formatDate(p.paidAt)} · {METHOD[p.method].label}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
                <p className="num mt-0.5 text-xs text-rose-600/80">
                  Arxivlandi: {formatDateTime(p.archivedAt)} · {p.archivedBy === "admin" ? "administrator" : "siz"}
                  {p.createdBy === "admin" ? " · kiritgan: administrator" : p.createdBy === "system" ? " · Sheets’dan import" : ""}
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ConfirmAction
                action={restorePayment.bind(null, p.id)}
                confirmText={`${p.studentName}: ${formatMoney(p.amount)} to‘lov arxivdan qaytarilsinmi? U yana hisob-kitoblarga qo‘shiladi.`}
                className={cx(btn.sm, "text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800")}
                pendingText="…"
              >
                <ArchiveRestore className="size-4" aria-hidden />
                Tiklash
              </ConfirmAction>
              <ConfirmAction
                action={purgePayment.bind(null, p.id)}
                confirmText={`${p.studentName}: ${formatMoney(p.amount)} to‘lov butunlay o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.`}
                className={cx(btn.sm, "text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700")}
                pendingText="…"
              >
                <Trash2 className="size-4" aria-hidden />
                O‘chirish
              </ConfirmAction>
            </div>
          </li>
        ))}
      </ul>
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
          <p className="mt-1.5 max-w-sm text-sm text-ink-500">Qidiruv, usul yoki kun filtrini o‘zgartirib ko‘ring.</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-ink-900">Bu oy uchun to‘lov kiritilmagan</p>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">Birinchi to‘lovni forma orqali kiriting. Barcha hisob-kitoblar bir zumda yangilanadi.</p>
          <a href="#yangi-tolov" className={cx(btn.soft, "mt-6")}>
            <Plus className="size-[18px]" aria-hidden />
            Birinchi to‘lovni qo‘shish
          </a>
        </>
      )}
    </div>
  );
}
