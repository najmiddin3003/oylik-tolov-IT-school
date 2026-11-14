import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Banknote,
  CalendarSearch,
  ClipboardList,
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
import { purgePayment, restorePayment } from "@/app/actions/payments";
import { FilterForm, SearchInput } from "@/components/FilterForm";
import { TodayLessons } from "@/components/Lessons";
import { UnpaidButton } from "@/components/Notifications";
import { PaymentForm } from "@/components/PaymentForm";
import { PaymentHistory } from "@/components/PaymentHistory";
import { DatePicker, Select } from "@/components/pickers";
import { QuickStudentButton } from "@/components/QuickStudent";
import { ConfirmAction } from "@/components/SubmitButton";
import { CompleteTaskButton } from "@/components/TaskButtons";
import { Avatar, btn, Card, CountBadge, cx, EmptyState, IconTile, PageHeader, PageSkeleton, Progress, Tag, type Tone } from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import {
  canPickPaymentDate,
  countArchivedPayments,
  getMonthOverview,
  getMyTasks,
  getStaffPay,
  listArchivedPayments,
  listCourses,
  listPayments,
  listScheduleTemplates,
  listStudentOptions,
  listTeacherChoices,
  listUnpaid,
  type PaymentRow,
  type PayView,
} from "@/lib/data";
import type { PaymentMethod } from "@/lib/models";
import { dayLabel } from "@/lib/reminders";
import { currentMonth, formatDate, formatDateTime, formatMoney, formatNumber, isoToDate, isValidMonth, MONTH_NAMES, monthLabel, nowMs, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "To‘lovlar" };

const METHOD: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  naqd: { label: "Naqd", icon: Banknote },
  karta: { label: "Karta", icon: CreditCard },
  otkazma: { label: "O‘tkazma", icon: Landmark },
};

export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}

async function Payments({ searchParams }: { searchParams: PageProps<"/payments">["searchParams"] }) {
  const { role, staffId } = await pageGuard();
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  // O'qituvchi faqat ko'radi: to'lov kiritmaydi, o'chirmaydi
  const readOnly = role === "teacher";
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const view = isOwner && str("view") === "arxiv" ? "arxiv" : "list";
  const q = str("q").slice(0, 100);
  const method = str("method") in METHOD ? str("method") : "";
  const day = isoToDate(str("day")) ? str("day") : "";
  // Tarix: tanlangan oy uchun yoki barcha oylar (administratorda standart — hammasi, yangilari tepada)
  const scope = str("scope") === "month" || str("scope") === "all" ? str("scope") : isAdmin ? "all" : "month";

  const [overview, list, students, archivedCount, archived, pickDate, courses] = await Promise.all([
    getMonthOverview(month),
    listPayments(month, { q, method, day, all: scope === "all" }),
    readOnly ? Promise.resolve([]) : listStudentOptions(month),
    isOwner ? countArchivedPayments() : Promise.resolve(0),
    view === "arxiv" ? listArchivedPayments() : Promise.resolve([] as PaymentRow[]),
    canPickPaymentDate(role),
    readOnly ? Promise.resolve([]) : listCourses(),
  ]);
  const [share, unpaidList, admin, teacherChoices] = await Promise.all([
    // O'qituvchiga — o'z oyligi (o'quvchilari tushumidan foiz)
    readOnly && staffId ? getStaffPay(staffId, month) : Promise.resolve(null),
    listUnpaid(month),
    isAdmin ? adminExtras() : Promise.resolve(null),
    // «Bugun darsga keladi» blokidagi o'qituvchi filtri uchun (o'qituvchi faqat o'z o'quvchilarini ko'radi)
    readOnly ? Promise.resolve([]) : listTeacherChoices(),
  ]);
  const { totals, debtors } = overview;
  const preselect = students.some((s) => s.id === str("student")) ? str("student") : undefined;
  // «Bugun darsga keladi»: jadvali bor o'quvchilar (tanlangan oy bo'yicha holati bilan)
  const scheduled = overview.rows
    .filter((r) => r.lessons.length)
    .map((r) => ({
      id: r.id,
      name: r.fullName,
      phone: r.phone,
      fee: r.monthlyFee,
      paid: r.paid,
      debt: r.debt,
      status: r.status,
      lessons: r.lessons,
      away: r.away,
      group: r.group,
      teacherId: r.teacherId,
    }));
  const unscheduled = debtors.filter((r) => !r.lessons.length).length;
  const planDone = totals.expected - totals.debt;
  const planPct = totals.expected ? Math.round((planDone / totals.expected) * 100) : 0;
  const exportQs = new URLSearchParams({ month, ...(q ? { q } : {}), ...(method ? { method } : {}), ...(day ? { day } : {}) });
  const qs = (extra: Record<string, string>) =>
    `/payments?${new URLSearchParams({ month, ...(q ? { q } : {}), ...(method ? { method } : {}), ...(day ? { day } : {}), ...extra })}`;

  return (
    <>
      <PageHeader
        eyebrow={isAdmin ? "Administrator" : "To‘lovlar boshqaruvi"}
        title="To‘lovlar"
        subtitle={
          readOnly
            ? `${monthLabel(month)}: o‘quvchilaringizning to‘lovlari (faqat ko‘rish).`
            : `${monthLabel(month)}: oy rejasi, tushgan summa, qolgan qarz va to‘lov kiritish.`
        }
        actions={
          <>
            <a href={`/api/export/tolovlar?${exportQs}`} className={cx(btn.outline, "group")}>
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-600 text-white" aria-hidden>
                <Download className="icon-wiggle size-3.5" strokeWidth={2.4} />
              </span>
              Excel yuklash
            </a>
            {admin ? <QuickStudentButton courses={courses} teachers={admin.teachers} templates={admin.templates} today={todayISO()} /> : null}
          </>
        }
      />

      {admin?.tasks.length ? <TasksCard tasks={admin.tasks} lists={admin.taskLists} /> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:gap-5">
        <MoneyCard label={`${monthLabel(month)} rejasi`} value={totals.expected} icon={Target} tone="brand" hint={`${totals.students} ta o‘quvchining oylik to‘lovi`}>
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-ink-500">Bajarildi</span>
              <span className={cx("num text-sm font-bold", planPct >= 100 ? "text-emerald-600" : "text-brand-600")}>{planPct}%</span>
            </div>
            <Progress value={planDone} max={totals.expected} className="h-2" />
            <p className="num mt-1.5 text-xs text-ink-400">
              {formatMoney(planDone)} / {formatMoney(totals.expected)}
            </p>
          </div>
        </MoneyCard>
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
        />
      </div>

      <TodayLessons
        students={scheduled}
        teachers={teacherChoices.map((t) => ({ id: t.id, name: t.name }))}
        month={month}
        serverNow={nowMs()}
        role={role}
        unscheduled={unscheduled}
        defaultAll={isAdmin}
      />

      <div className={cx("grid gap-6", !readOnly && "xl:grid-cols-[minmax(0,1fr)_384px]")}>
        <Card className="min-w-0 self-start overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
            {isOwner ? (
              <nav className="-mb-px flex gap-6" aria-label="Bo‘limlar">
                <TabLink href={qs({ scope })} active={view === "list"} count={list.rows.length}>
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
            {view === "list" && !day ? (
              <div className="mb-3 flex rounded-full bg-slate-100 p-1 text-[13px] font-semibold" role="group" aria-label="Qaysi to‘lovlar">
                {[
                  { v: "month", label: `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} uchun` },
                  { v: "all", label: "Hammasi" },
                ].map((o) => (
                  <Link
                    key={o.v}
                    href={qs({ scope: o.v })}
                    scroll={false}
                    aria-current={scope === o.v ? "true" : undefined}
                    className={cx("rounded-full px-3 py-1.5 transition", scope === o.v ? "bg-surface text-ink-900 shadow-card" : "text-ink-500 hover:text-ink-800")}
                  >
                    {o.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {view === "arxiv" ? (
            <ArchiveList rows={archived} month={month} />
          ) : (
            <>
              <FilterForm action="/payments" className="flex flex-wrap items-center gap-3 border-t border-line-soft px-6 py-5">
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="scope" value={scope} />
                <SearchInput defaultValue={q} placeholder="Ism, kurs yoki izoh..." label="To‘lovni qidirish" />
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
                    href={`/payments?${new URLSearchParams({ month, scope, ...(q ? { q } : {}), ...(method ? { method } : {}) })}`}
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
                <PaymentHistory rows={list.rows} month={month} role={role} readOnly={readOnly} />
              )}

              {list.rows.length ? (
                <div className="num flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-sm">
                  <span className="text-ink-500">
                    Jami{q || method || day ? " (filtr bo‘yicha)" : scope === "all" ? " (barcha oylar)" : ""}: {list.rows.length} ta to‘lov
                  </span>
                  <span className="text-[17px] font-bold text-ink-900">{formatMoney(list.total)}</span>
                </div>
              ) : null}
            </>
          )}
        </Card>

        {readOnly ? null : (
          <Card id="yangi-tolov" className="order-first scroll-mt-24 self-start p-6 xl:sticky xl:top-24 xl:order-none">
            <div className="group mb-6 flex items-center gap-3.5">
              <IconTile icon={Plus} tone="brand" variant="solid" />
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Yangi to‘lov</h2>
                <p className="mt-0.5 text-sm text-ink-500">Avval kurs, keyin o‘quvchini tanlang</p>
              </div>
            </div>
            {students.length ? (
              <PaymentForm
                key={`${month}-${preselect ?? ""}`}
                students={students}
                defaultStudentId={preselect}
                defaultMonth={month}
                today={todayISO()}
                canPickDate={pickDate}
                courses={courses.map((c) => c.name)}
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
                  "Hali faol o‘quvchi yo‘q — «Yangi o‘quvchi» tugmasi bilan qo‘shing."
                )}
              </p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

/** Administrator uchun qo'shimcha ma'lumotlar: topshiriqlar, o'quvchi qo'shish oynasi uchun ro'yxatlar. */
async function adminExtras() {
  const [tasks, teachers, templates] = await Promise.all([getMyTasks(), listTeacherChoices(), listScheduleTemplates()]);
  const months = [...new Set(tasks.filter((t) => t.status === "open").map((t) => t.month))];
  const lists = await Promise.all(months.map((m) => listUnpaid(m)));
  return { tasks, teachers, templates, taskLists: Object.fromEntries(months.map((m, i) => [m, lists[i]])) };
}

/** Rahbardan kelgan topshiriqlar (administrator). */
function TasksCard({ tasks, lists }: { tasks: Awaited<ReturnType<typeof getMyTasks>>; lists: Record<string, Awaited<ReturnType<typeof listUnpaid>>> }) {
  return (
    <Card id="topshiriqlar" className="mb-6 scroll-mt-24 overflow-hidden border-brand-200/80">
      <div className="group flex items-center gap-3.5 border-b border-brand-100 bg-brand-50/60 px-5 py-4 sm:px-6">
        <IconTile icon={ClipboardList} tone="brand" variant="solid" />
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Rahbardan topshiriqlar</h2>
          <p className="mt-0.5 text-sm text-ink-500">Bajarganingizdan keyin «Bajarildi» tugmasini bosing</p>
        </div>
      </div>
      <ul className="divide-y divide-line-soft">
        {tasks.map((t) => {
          const live = lists[t.month] ?? [];
          return (
            <li key={t.id} className={cx("flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-6", t.status === "done" && "opacity-70")}>
              <div className="min-w-[240px] flex-1">
                <p className="text-[15px] font-semibold text-ink-900">
                  To‘lovlarni yig‘ing: {monthLabel(t.month)} uchun {t.status === "open" ? live.length : t.count} ta o‘quvchi to‘lov qilmabdi
                </p>
                <p className="num mt-0.5 text-[13px] text-ink-500">
                  {t.fromName} · {formatDateTime(t.updatedAt)}
                  {t.status === "open" && live.length !== t.count ? ` · yuborilganda ${t.count} ta edi` : ""}
                  {t.status === "done" ? ` · bajarildi ${formatDateTime(t.doneAt)}` : ""}
                </p>
              </div>
              {t.status === "open" ? (
                <div className="flex flex-wrap items-center gap-2">
                  {live.length ? (
                    <UnpaidButton month={t.month} students={live} role="admin" className={btn.sm}>
                      Ro‘yxat ({live.length})
                    </UnpaidButton>
                  ) : (
                    <Tag tone="emerald">Hamma to‘ladi 🎉</Tag>
                  )}
                  <CompleteTaskButton id={t.id} />
                </div>
              ) : (
                <Tag tone="emerald">Bajarildi ✓</Tag>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
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

/** O'qituvchi uchun: o'z oyligi (o'quvchilari tushumidan foiz), olingan oylik/avans va qolgani. */
function ShareBox({ share, month }: { share: PayView; month: string }) {
  const open = share.cycle && !share.cycle.closedOn && month > share.cycle.current ? share.cycle.current : null;
  return (
    <dl className="num mt-3 grid gap-1 rounded-xl bg-linear-to-br from-brand-50 to-violet-50/70 px-3 py-2.5 text-[13px] ring-1 ring-inset ring-brand-100">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ink-500">Mening oyligim ({share.percent}%)</dt>
        <dd className="font-semibold text-ink-900">{formatMoney(share.share)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ink-500">
          <Link href="/olinganlar" className="underline-offset-4 hover:text-brand-700 hover:underline">
            Olindi (oylik/avans)
          </Link>
        </dt>
        <dd className="font-semibold text-ink-700">− {formatMoney(share.taken)}</dd>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-3 border-t border-brand-100 pt-1.5">
        <dt className="font-medium text-ink-700">Qoldi</dt>
        <dd className={cx("text-[15px] font-bold", share.left < 0 ? "text-rose-600" : "text-emerald-600")}>{formatMoney(share.left)}</dd>
      </div>
      {open ? (
        <p className="mt-1 text-xs leading-snug text-amber-700">
          <Link href={`/me?${new URLSearchParams({ month: open })}`} className="underline-offset-4 hover:underline">
            {monthLabel(open)} oyligi hali olinmagan — to‘lovlar o‘shanga qo‘shilmoqda →
          </Link>
        </p>
      ) : null}
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
      <ul className="scroll-thin max-h-[min(760px,calc(100dvh-13rem))] divide-y divide-line-soft overflow-y-auto border-t border-line-soft">
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
        <span className="absolute left-[60px] top-2 flex h-28 w-24 rotate-6 flex-col rounded-2xl border border-line bg-surface p-3.5 shadow-card">
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
