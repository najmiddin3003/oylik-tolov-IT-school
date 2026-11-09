import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Crown,
  Download,
  GraduationCap,
  HandCoins,
  Info,
  Plus,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { PaidCell, StudentCell } from "@/components/cells";
import { NextLessonCell, TodayLessons } from "@/components/Lessons";
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
  Tag,
  td,
  th,
} from "@/components/ui";
import { pageGuard, type Session } from "@/lib/auth";
import { getMonthOverview, getMyProfile, getTeamOverview, listGroups, listTeacherOptions, type StudentRow, type TeamMember } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { isTeaching, payLabel, ROLE_LABEL, staffInitials } from "@/lib/staff-rules";
import { currentMonth, formatMoney, formatNumber, isValidMonth, monthLabel, nowMs } from "@/lib/time";

const PAGE_SIZE = 10;

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const session = await pageGuard();
  if (session.role === "admin") redirect("/payments");
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const page = Math.max(1, Number(sp.page) || 1);
  if (session.role === "teacher") return <TeacherDashboard session={session} month={month} page={page} />;
  const group = typeof sp.group === "string" ? sp.group : "";
  const teacher = typeof sp.teacher === "string" && /^([a-f0-9]{24}|none)$/i.test(sp.teacher) ? sp.teacher : "";
  return <HeadDashboard session={session} month={month} page={page} group={group} teacher={teacher} />;
}

// ---------- Rahbar paneli ----------

async function HeadDashboard({ session, month, page, group, teacher }: { session: Session; month: string; page: number; group: string; teacher: string }) {
  const [{ debtors, totals }, groups, team, settings, teachers] = await Promise.all([
    getMonthOverview(month, group, teacher),
    listGroups(),
    getTeamOverview(month),
    getSettings(),
    listTeacherOptions(),
  ]);
  const center = team.totals;
  const planDone = center.expected - center.debt;
  const planPct = center.expected ? Math.round((planDone / center.expected) * 100) : 0;
  const paidPct = center.students ? Math.round((center.paid / center.students) * 100) : 0;
  const pages = Math.max(1, Math.ceil(debtors.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = debtors.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({ month, ...(group ? { group } : {}), ...(teacher ? { teacher } : {}), ...extra }).toString();
  const serverNow = nowMs();
  const showGroup = groups.length > 1;
  const teacherName = new Map(teachers.map((t) => [t.id, t.name]));
  // Rahbar kartasi ko'rsatilmaydi — dars ham beradigan bo'lsa, o'qituvchi sifatida ko'rinadi
  const staffCards = team.members.filter((m) => m.role !== "owner" || isTeaching(m));

  return (
    <>
      {/* Rahbarlik paneli: markaz bo'yicha moliyaviy holat */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0e1121_0%,#1c2033_45%,#1a24b8_100%)] px-5 py-6 text-white shadow-pop sm:px-8 sm:py-8">
        <span className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border-[28px] border-white/[0.04]" aria-hidden />
        <span className="pointer-events-none absolute -bottom-32 right-40 size-64 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#fbbf24]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#fde68a] ring-1 ring-inset ring-[#fcd34d]/30">
              <Crown className="size-3.5" fill="currentColor" fillOpacity={0.3} aria-hidden />
              Rahbar paneli
            </p>
            <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.025em] sm:text-[34px]">{settings.centerName}</h1>
            <p className="mt-1.5 text-[15px] text-white/70">
              {monthLabel(month)} · {session.name ? `${session.name}, ` : ""}markaz bo‘yicha umumiy holat
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a href={`/api/export/hisobot?${qs({})}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-[15px] font-medium text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/15">
              <Download className="size-4" aria-hidden />
              Hisobot (Excel)
            </a>
            <Link href={`/payments?${qs({})}#yangi-tolov`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-[15px] font-semibold text-slate-900 shadow-card transition hover:bg-white/90">
              <Plus className="size-[18px]" aria-hidden />
              To‘lov qo‘shish
            </Link>
          </div>
        </div>
        <dl className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeadFigure icon={Wallet} label="Jami tushum" value={formatMoney(team.finance.collected)} hint={`Reja: ${formatMoney(center.expected)} · ${planPct}%`} />
          <HeadFigure icon={UsersRound} label="Xodimlar oyligi" value={formatMoney(team.finance.staffShare)} hint={`${staffCards.length} ta xodim ulushi`} />
          <HeadFigure
            icon={HandCoins}
            label="Berilgan avans/oylik"
            value={formatMoney(team.finance.given.avans + team.finance.given.oylik)}
            hint={`avans ${formatMoney(team.finance.given.avans)} · oylik ${formatMoney(team.finance.given.oylik)}`}
            strong
          />
          <HeadFigure icon={UserRound} label="Qolgan qarz" value={formatMoney(center.debt)} hint={`${center.unpaid + center.partial} ta o‘quvchi to‘lamagan`} />
        </dl>
        <div className="relative mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={planPct} aria-valuemin={0} aria-valuemax={100} aria-label="Reja bajarilishi">
            <div className="h-full rounded-full bg-linear-to-r from-amber-300 to-emerald-300" style={{ width: `${Math.min(100, planPct)}%` }} />
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <KpiCard label="Faol o‘quvchilar" value={center.students} hint={center.groups ? `${center.groups} ta kursda` : "kurs belgilanmagan"} icon={Users} tone="violet" />
        <KpiCard
          label="To‘liq to‘laganlar"
          value={center.paid}
          hint={
            <>
              <span className="font-semibold text-emerald-600">{paidPct}%</span> o‘quvchi to‘lovni yopgan
            </>
          }
          icon={UserCheck}
          tone="emerald"
        />
        <KpiCard label="Qarzdor o‘quvchilar" value={center.unpaid + center.partial} hint={`Jami ${formatMoney(center.debt)}`} icon={UserRound} tone="amber" />
        <KpiCard label="O‘qituvchilar" value={team.members.filter((m) => isTeaching(m)).length} hint={`${team.members.filter((m) => m.status === "invited").length} tasi hali ro‘yxatdan o‘tmagan`} icon={GraduationCap} tone="brand" />
      </div>

      {/* Xodimlar */}
      <section className="mb-6" aria-labelledby="team-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="team-title" className="text-[19px] font-semibold tracking-[-0.01em] text-ink-900">
              Xodimlar
            </h2>
            <p className="mt-0.5 text-sm text-ink-500">{monthLabel(month)}: har bir xodimning o‘quvchilari, tushumi va oyligi</p>
          </div>
          <Link href="/staff" className={btn.link}>
            Xodimlarni boshqarish
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        {staffCards.length || team.unassigned.students ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {staffCards.map((m) => (
              <TeamCard key={m.id} m={m} month={month} />
            ))}
            {team.unassigned.students ? (
              <Card className="flex flex-col justify-between border-dashed p-5">
                <div>
                  <p className="text-[15px] font-semibold text-ink-900">O‘qituvchi biriktirilmagan</p>
                  <p className="num mt-1 text-sm text-ink-500">
                    {team.unassigned.students} ta o‘quvchi · qarz {formatMoney(team.unassigned.debt)}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
                    Ularning to‘lovlari hech bir o‘qituvchining oyligiga kirmaydi. Kursga o‘qituvchi tanlang — shu kurs o‘quvchilari unga o‘zi biriktiriladi.
                    Kursi yo‘qlarini ro‘yxatda belgilab, «Kurs» yoki «O‘qituvchi» tugmasi bilan biriktiring.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/settings#kurslar" className={btn.sm}>
                    <BookOpen className="size-4" aria-hidden />
                    Kursga o‘qituvchi
                  </Link>
                  <Link href={`/students?${new URLSearchParams({ teacher: "none", month })}`} className={btn.sm}>
                    <UserPlus className="size-4" aria-hidden />
                    Ro‘yxatdan biriktirish
                  </Link>
                </div>
              </Card>
            ) : null}
          </div>
        ) : (
          <Card>
            <EmptyState title="Hali xodim qo‘shilmagan" icon={UsersRound} tone="sky">
              <Link href="/staff" className="font-medium text-brand-600 hover:underline">
                «Xodimlar» bo‘limida
              </Link>{" "}
              o‘qituvchilar va administratorni telefon raqami bilan qo‘shing — ular SMS kod orqali o‘z profilini ochadi.
            </EmptyState>
          </Card>
        )}
      </section>

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
              <span className="ml-3 text-lg text-ink-400">/ {formatMoney(center.expected)}</span>
            </p>
            <span className="num text-lg font-bold text-brand-600">{planPct}%</span>
          </div>
          <Progress value={planDone} max={center.expected} className="mt-5 h-2" />
          <dl className="mt-6 grid gap-4 border-b border-line-soft pb-5 sm:grid-cols-3">
            <LegendItem dot="bg-ink-300" label="Oylik reja" value={formatMoney(center.expected)} />
            <LegendItem dot="bg-brand-600" label="Rejaga tushdi" value={formatMoney(planDone)} />
            <LegendItem dot="bg-unpaid" label="Qolgan to‘lov" value={formatMoney(center.debt)} />
          </dl>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-400">
            <Info className="size-3.5" aria-hidden />
            To‘lov kiritilganda ko‘rsatkichlar avtomatik yangilanadi.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">To‘lov holati</h2>
            <span className="text-sm text-ink-400">{center.students} ta o‘quvchi</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5">
            <Donut
              total={center.students}
              parts={[
                { value: center.paid, color: "var(--color-paid)" },
                { value: center.partial, color: "var(--color-partial)" },
                { value: center.unpaid, color: "var(--color-unpaid)" },
              ]}
            />
            <ul className="min-w-[190px] flex-1 space-y-4">
              <StatusLine dot="bg-paid" label="To‘liq to‘lagan" value={center.paid} />
              <StatusLine dot="bg-partial" label="Qisman to‘lagan" value={center.partial} />
              <StatusLine dot="bg-unpaid" label="To‘lamagan" value={center.unpaid} />
            </ul>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-400">
            <CalendarDays className="size-3.5" aria-hidden />
            {monthLabel(month)} uchun hisoblangan to‘lovlar
          </p>
        </Card>
      </div>

      {groups.length > 1 || teachers.length ? (
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filtr">
          {teachers.length
            ? [{ id: "", name: "Barcha o‘qituvchilar" }, ...teachers, { id: "none", name: "Biriktirilmagan" }].map((t) => (
                <FilterChip key={`t-${t.id || "all"}`} href={`/?${new URLSearchParams({ month, ...(group ? { group } : {}), ...(t.id ? { teacher: t.id } : {}) })}`} active={t.id === teacher}>
                  {t.id && t.id !== "none" ? <GraduationCap className="size-3.5" aria-hidden /> : null}
                  {t.name}
                </FilterChip>
              ))
            : null}
          {groups.length > 1
            ? ["", ...groups].map((g) => (
                <FilterChip key={`g-${g || "all"}`} href={`/?${new URLSearchParams({ month, ...(teacher ? { teacher } : {}), ...(g ? { group: g } : {}) })}`} active={g === group}>
                  {g || "Barcha kurslar"}
                </FilterChip>
              ))
            : null}
        </div>
      ) : null}

      <DebtorsTable
        rows={pageRows}
        total={debtors.length}
        month={month}
        serverNow={serverNow}
        showGroup={showGroup}
        teacherName={teachers.length ? teacherName : null}
        canPay
        footer={<Pagination page={current} pages={pages} href={(p) => `/?${qs({ page: String(p) })}`} />}
        emptyHint={totals.students ? `${monthLabel(month)} uchun barcha faol o‘quvchilar to‘lovni amalga oshirgan.` : null}
      />
    </>
  );
}

function HeadFigure({ icon: Icon, label, value, hint, strong, negative }: { icon: typeof Wallet; label: string; value: string; hint: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={cx("rounded-2xl px-4 py-3.5 ring-1 ring-inset", strong ? "bg-white/[0.14] ring-amber-300/30" : "bg-white/[0.07] ring-white/10")}>
      <dt className="flex items-center gap-2 text-[13px] text-white/70">
        <Icon className={cx("size-4", strong ? "text-amber-300" : "text-white/60")} aria-hidden />
        {label}
      </dt>
      <dd className={cx("num mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.02em]", negative ? "text-[#fecdd3]" : strong ? "text-[#fef3c7]" : "text-white")}>{value}</dd>
      <dd className="num mt-1 text-xs text-white/55">{hint}</dd>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition",
        active ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-600 ring-line hover:bg-slate-50",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Oylik davri haqida qisqa izoh (foizli oylik): ko'rilayotgan oydan oldingi oy oyligi hali olinmagan bo'lsa — to'lovlar
 * o'sha oyga qo'shilmoqda; ko'rilayotgan oy tugagan, lekin oylik hali olinmagan bo'lsa — oy ochiq.
 */
function cycleHint(cycle: TeamMember["pay"]["cycle"], month: string): string | null {
  if (!cycle || cycle.closedOn) return null;
  if (month > cycle.current) return `${monthLabel(cycle.current)} oyligi hali olinmagan — to‘lovlar o‘shanga qo‘shilmoqda`;
  if (month === cycle.current && month < currentMonth()) return "Oylik hali olinmagan — oy ochiq, to‘lovlar shu oyga qo‘shilmoqda";
  return null;
}

/** Xodim kartasi (rahbar paneli): o'quvchilari, tushumi va oyligi. */
function TeamCard({ m, month }: { m: TeamMember; month: string }) {
  const isTeacher = isTeaching(m);
  const collectedFromStudents = isTeacher ? m.pay.base : 0;
  return (
    <Card className="group flex flex-col p-5 transition hover:shadow-pop">
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
            isTeacher ? "bg-linear-to-br from-brand-500 to-brand-700 shadow-brand" : "bg-linear-to-br from-emerald-400 to-emerald-600",
          )}
          aria-hidden
        >
          {staffInitials(m.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/staff/${m.id}?month=${month}`} className="block truncate text-[16px] font-semibold text-ink-900 hover:text-brand-600">
            {m.name}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <Tag tone={m.role === "owner" ? "amber" : isTeacher ? "brand" : "emerald"}>{ROLE_LABEL[m.role]}</Tag>
            {m.role === "owner" && isTeacher ? <Tag tone="brand">O‘qituvchi</Tag> : null}
            {m.status === "invited" ? <Tag tone="amber">Ro‘yxatdan o‘tmagan</Tag> : null}
          </p>
        </div>
      </div>

      {isTeacher ? (
        <>
          <dl className="num mt-4 grid grid-cols-3 gap-2 text-center">
            <MiniFigure label="O‘quvchi" value={m.students} />
            <MiniFigure label="To‘lagan" value={m.paidCount} tone="emerald" />
            <MiniFigure label="Qarzdor" value={m.debtors} tone={m.debtors ? "amber" : "slate"} />
          </dl>
          <Progress value={m.expected - m.debt} max={m.expected} className="mt-3 h-1.5" />
          <p className="num mt-1.5 flex justify-between text-xs text-ink-400">
            <span>Tushum: {formatMoney(collectedFromStudents)}</span>
            <span>Qarz: {formatMoney(m.debt)}</span>
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-500">
          {m.pay.kind === "fixed"
            ? m.pay.share
              ? "Belgilangan oylik"
              : "Oylik belgilanmagan"
            : m.pay.percent
              ? `Butun markaz tushumidan ${m.pay.percent}%`
              : "Oylik foizi belgilanmagan"}
        </p>
      )}

      <div className="num mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] ring-1 ring-inset ring-line-soft">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-500">{payLabel(m.pay)}</span>
          <span className="font-semibold text-ink-900">{formatMoney(m.pay.share)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-ink-500">Olindi</span>
          <span className="text-ink-700">− {formatMoney(m.pay.taken)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-line pt-1">
          <span className="font-medium text-ink-700">Qoldi</span>
          <span className={cx("font-bold", m.pay.left < 0 ? "text-rose-600" : "text-emerald-600")}>{formatMoney(m.pay.left)}</span>
        </div>
        {cycleHint(m.pay.cycle, month) ? <p className="mt-1.5 text-xs leading-snug text-amber-700">{cycleHint(m.pay.cycle, month)}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isTeacher ? (
          <Link href={`/students?${new URLSearchParams({ teacher: m.id, month })}`} className={btn.sm}>
            <Users className="size-4" aria-hidden />
            O‘quvchilari
          </Link>
        ) : null}
        <Link href={`/staff/${m.id}?month=${month}`} className={btn.sm}>
          Profil va oylik
        </Link>
      </div>
    </Card>
  );
}

function MiniFigure({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "emerald" | "amber" }) {
  const tones = { slate: "text-ink-900", emerald: "text-emerald-600", amber: "text-amber-600" };
  return (
    <div className="rounded-xl bg-slate-50/80 px-2 py-2 ring-1 ring-inset ring-line-soft">
      <dd className={cx("text-[19px] font-bold leading-none", tones[tone])}>{value}</dd>
      <dt className="mt-1 text-[11px] text-ink-400">{label}</dt>
    </div>
  );
}

// ---------- O'qituvchi sahifasi ----------

async function TeacherDashboard({ session, month, page }: { session: Session; month: string; page: number }) {
  const [{ debtors, rows, totals }, me] = await Promise.all([getMonthOverview(month), getMyProfile(month)]);
  const firstName = (session.name ?? "").split(/\s+/)[0] || "ustoz";
  const pay = me?.pay;
  const pages = Math.max(1, Math.ceil(debtors.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = debtors.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const serverNow = nowMs();
  const scheduled = rows
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
      group: r.group,
      teacherId: r.teacherId,
    }));
  const unscheduled = debtors.filter((r) => !r.lessons.length).length;

  return (
    <>
      <PageHeader
        eyebrow="O‘qituvchi profili"
        title={`Salom, ${firstName}!`}
        subtitle={`${monthLabel(month)}: o‘quvchilaringiz, ularning to‘lovlari va oyligingiz.`}
        actions={
          <a href={`/api/export/oquvchilar?${new URLSearchParams({ month })}`} className={cx(btn.outline, "group")}>
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-600 text-white" aria-hidden>
              <Download className="icon-wiggle size-3.5" strokeWidth={2.4} />
            </span>
            Excel yuklash
          </a>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr] xl:gap-5">
        <HeroKpiCard
          label={`Mening oyligim (${pay?.percent ?? 0}%)`}
          value={formatNumber(pay?.share ?? 0)}
          unit="so‘m"
          share={[
            { label: "O‘quvchilarim tushumi", value: formatMoney(pay?.base ?? 0) },
            { label: "Olindi (oylik/avans)", value: `− ${formatMoney(pay?.taken ?? 0)}` },
            { label: "Qoldi", value: formatMoney(pay?.left ?? 0), strong: true, negative: (pay?.left ?? 0) < 0 },
          ]}
          hint={
            <Link href={`/me?${new URLSearchParams({ month: pay?.cycle && month > pay.cycle.current ? pay.cycle.current : month })}`} className="underline-offset-4 hover:underline">
              {cycleHint(pay?.cycle ?? null, month) ?? "Oylik tafsilotlari"} →
            </Link>
          }
          icon={Wallet}
        />
        <KpiCard label="O‘quvchilarim" value={totals.students} hint={`${monthLabel(month)} uchun to‘lashi kerak`} icon={Users} tone="violet" />
        <KpiCard
          label="To‘liq to‘laganlar"
          value={totals.paid}
          hint={
            <>
              <span className="font-semibold text-emerald-600">{totals.students ? Math.round((totals.paid / totals.students) * 100) : 0}%</span> to‘lovni yopgan
            </>
          }
          icon={UserCheck}
          tone="emerald"
        />
        <KpiCard label="Qarzdorlar" value={totals.unpaid + totals.partial} hint={`Jami ${formatMoney(totals.debt)}`} icon={UserRound} tone="amber" />
      </div>

      <TodayLessons students={scheduled} month={month} serverNow={serverNow} role="teacher" unscheduled={unscheduled} />

      <DebtorsTable
        rows={pageRows}
        total={debtors.length}
        month={month}
        serverNow={serverNow}
        showGroup={false}
        teacherName={null}
        canPay={false}
        footer={<Pagination page={current} pages={pages} href={(p) => `/?${new URLSearchParams({ month, page: String(p) })}`} />}
        emptyHint={totals.students ? `${monthLabel(month)} uchun barcha o‘quvchilaringiz to‘lagan.` : null}
      />
    </>
  );
}

// ---------- Umumiy: qarzdorlar jadvali ----------

function DebtorsTable({
  rows,
  total,
  month,
  serverNow,
  showGroup,
  teacherName,
  canPay,
  footer,
  emptyHint,
}: {
  rows: StudentRow[];
  total: number;
  month: string;
  serverNow: number;
  showGroup: boolean;
  /** Rahbarda: o'qituvchi ustuni */
  teacherName: Map<string, string> | null;
  canPay: boolean;
  footer: ReactNode;
  emptyHint: string | null;
}) {
  return (
    <Card>
      <CardHeader
        title="To‘lov kutilayotgan o‘quvchilar"
        count={total}
        right={
          <Link href={`/students?${new URLSearchParams({ tab: "debt", month })}`} className={btn.link}>
            Barchasini ko‘rish
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        }
      />
      {total === 0 ? (
        <div className="border-t border-line-soft">
          <EmptyState title={emptyHint ? "Hamma to‘lagan 🎉" : "Hali o‘quvchi yo‘q"} icon={UserCheck}>
            {emptyHint ?? "O‘quvchilar qo‘shilgach shu yerda ko‘rinadi."}
          </EmptyState>
        </div>
      ) : (
        <div className="relative overflow-x-auto border-t border-line-soft">
          <table className={cx("w-full", showGroup || teacherName ? "min-w-[1080px]" : "min-w-[900px]")}>
            <thead className="bg-slate-50/70">
              <tr>
                <th className={th}>O‘quvchi</th>
                {teacherName ? <th className={th}>O‘qituvchi</th> : null}
                {showGroup ? <th className={th}>Kurs</th> : null}
                <th className={th}>Keyingi dars</th>
                <th className={th}>To‘landi / oylik</th>
                <th className={`${th} text-right`}>Qolgan to‘lov</th>
                <th className={th}>Holat</th>
                {canPay ? <th className={`${th} text-right`}>Amal</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className={td}>
                    <StudentCell id={r.id} name={r.fullName} seq={r.seq} phone={r.phone} href={`/students/${r.id}?month=${month}`} />
                  </td>
                  {teacherName ? (
                    <td className={cx(td, "whitespace-nowrap")}>
                      {r.teacherId ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-ink-700">
                          <GraduationCap className="size-3.5 text-brand-500" aria-hidden />
                          {teacherName.get(r.teacherId) ?? "—"}
                        </span>
                      ) : (
                        <span className="text-ink-300">biriktirilmagan</span>
                      )}
                    </td>
                  ) : null}
                  {showGroup ? (
                    <td className={td}>
                      <GroupChip name={r.group} />
                    </td>
                  ) : null}
                  <td className={td}>
                    <NextLessonCell lessons={r.lessons} serverNow={serverNow} />
                  </td>
                  <td className={td}>
                    <PaidCell paid={r.paid} fee={r.monthlyFee} />
                  </td>
                  <td className={`${td} num whitespace-nowrap text-right text-[15px] font-semibold text-ink-900`}>{formatMoney(r.debt)}</td>
                  <td className={td}>
                    <StatusBadge status={r.status} />
                  </td>
                  {canPay ? (
                    <td className={`${td} text-right`}>
                      <Link href={`/payments?${new URLSearchParams({ month, student: r.id })}#yangi-tolov`} className={btn.sm}>
                        <Plus className="size-4" aria-hidden />
                        To‘lov
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-6 py-4 text-[13px] text-ink-400">
        <span>
          Jami {total} ta o‘quvchi · {monthLabel(month)}
        </span>
        {footer}
      </div>
    </Card>
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
