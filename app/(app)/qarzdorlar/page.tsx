import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CalendarRange, GraduationCap, Plus, UserCheck, UserRound, UserX, Wallet, X } from "lucide-react";
import { PaidCell, StudentCell } from "@/components/cells";
import { FilterForm, SearchInput } from "@/components/FilterForm";
import { NextLessonCell } from "@/components/Lessons";
import { DatePicker, Select } from "@/components/pickers";
import { btn, Card, cx, EmptyState, GroupChip, MiniStat, PageHeader, PageSkeleton, Pagination, StatusBadge, td, th } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { listDebtors, parseDebtTab, type DebtTab } from "@/lib/data";
import { fromMinutes, parseLessonFilter, WEEKDAY_NAMES, type LessonState } from "@/lib/schedule";
import { currentMonth, formatDate, formatMoney, isoToDate, isValidMonth, monthLabel, nowMs, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "Qarzdorlar" };

const PAGE_SIZE = 20;

/** Dars vaqti varianti yonidagi izoh: holati */
const SLOT_STATE: Record<LessonState, string> = { now: "hozir darsda", soon: "tez orada", later: "", done: "tugadi" };

const TABS: { key: DebtTab; label: string }[] = [
  { key: "unpaid", label: "Qarzdorlar" },
  { key: "partial", label: "Qisman to‘laganlar" },
  { key: "paid", label: "To‘liq to‘laganlar" },
];

export default function DebtorsPage({ searchParams }: PageProps<"/qarzdorlar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Debtors searchParams={searchParams} />
    </Suspense>
  );
}

async function Debtors({ searchParams }: { searchParams: PageProps<"/qarzdorlar">["searchParams"] }) {
  const { role } = await roleGuard(["owner", "admin", "teacher"]);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const q = str("q").slice(0, 100);
  const group = str("group").slice(0, 100);
  const tab = parseDebtTab(str("tab"));
  // Bugungi dars holati: hozir darsda, bugun keladi, «16:00-18:00» da keladi, darsi tugagan, jadvalsiz
  const lesson = parseLessonFilter(str("lesson"));
  const page = Math.max(1, Number(str("page")) || 1);
  // To'lov sanasi oralig'i: noto'g'ri sana e'tiborsiz; teskari tanlansa — almashtiriladi
  const date = (k: string) => (isoToDate(str(k)) ? str(k) : "");
  const [rawFrom, rawTo] = [date("from"), date("to")];
  const [from, to] = rawFrom && rawTo && rawFrom > rawTo ? [rawTo, rawFrom] : [rawFrom, rawTo];

  const data = await listDebtors({ month, group, from, to, q, lesson, tab, page, pageSize: PAGE_SIZE });
  const { rows, counts, totals } = data;
  const isTeacher = role === "teacher";
  // To'lov kiritish — rahbar va administrator; o'quvchi profili — rahbar va o'qituvchi
  const canPay = role !== "teacher";
  const studentHref = (id: string) => (role === "admin" ? `/payments?${new URLSearchParams({ month, student: id })}#yangi-tolov` : `/students/${id}?month=${month}`);
  const serverNow = nowMs();
  const today = todayISO();

  const base = { month, ...(q ? { q } : {}), ...(group ? { group } : {}), ...(lesson ? { lesson } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };
  const tabHref = (t: DebtTab) => `/qarzdorlar?${new URLSearchParams({ ...base, ...(t !== "unpaid" ? { tab: t } : {}) })}`;
  const pageHref = (p: number) => `/qarzdorlar?${new URLSearchParams({ ...base, ...(tab !== "unpaid" ? { tab } : {}), page: String(p) })}`;
  const filtered = Boolean(q || group || lesson || from || to);
  // «Dars vaqti» tanlovi: bugungi dars vaqtlari, har birida — tanlangan bo'limdagi o'quvchilar soni
  const { clock, slots, counts: lc } = data.lessons;
  const slotOptions = slots.map((s) => ({
    value: s.key,
    label: `${s.start} da keladi`,
    hint: [`${s.start}–${s.end}`, SLOT_STATE[s.state], `${s.count} ta`].filter(Boolean).join(" · "),
  }));
  // Tanlangan vaqt bugun yo'q bo'lsa ham (eski havola) — tanlovda ko'rinsin
  if (lesson.includes(":") && !slots.some((s) => s.key === lesson)) slotOptions.push({ value: lesson, label: `${lesson.slice(0, 5)} da keladi`, hint: "bugun yo‘q" });
  const lessonOptions = [
    { value: "", label: "Barcha dars vaqtlari" },
    { value: "now", label: "Hozir darsda", hint: `${lc.now} ta` },
    { value: "today", label: "Bugun keladiganlar", hint: `${lc.today} ta` },
    ...slotOptions,
    { value: "done", label: "Bugungi darsi tugagan", hint: `${lc.done} ta` },
    { value: "none", label: "Dars vaqti kiritilmagan", hint: `${lc.none} ta` },
  ];
  const lessonNote =
    lesson && lesson !== "none" ? `Bugun — ${WEEKDAY_NAMES[clock.weekday - 1].toLowerCase()}, soat ${fromMinutes(clock.minutes)} holati bo‘yicha. Holat sahifa yangilanganda yangilanadi.` : "";
  const range = from || to ? `${from ? formatDate(isoToDate(from)) : "…"} — ${to ? formatDate(isoToDate(to)) : "…"}` : "";

  return (
    <>
      <PageHeader
        eyebrow="To‘lov nazorati"
        title="Qarzdorlar"
        subtitle={`${monthLabel(month)} uchun to‘lov qilmagan, qisman va to‘liq to‘lagan ${isTeacher ? "o‘quvchilaringiz" : "o‘quvchilar"}. Oyni yuqoridagi oy tanlagichdan o‘zgartiring.`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MiniStat label="To‘lamaganlar" value={counts.unpaid} icon={UserX} tone="rose" />
        <MiniStat label="Qisman to‘laganlar" value={counts.partial} icon={UserRound} tone="amber" />
        <MiniStat label="To‘liq to‘laganlar" value={counts.paid} icon={UserCheck} tone="emerald" />
        <MiniStat label="Qolgan qarz" value={formatMoney(totals.allDebt)} hint={`kutilgan ${formatMoney(totals.expected)}`} icon={Wallet} tone="violet" />
      </div>

      <Card>
        <div className="flex gap-7 overflow-x-auto overflow-y-hidden border-b border-line px-6" role="tablist" aria-label="To‘lov holati">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cx(
                  "relative flex shrink-0 items-center gap-2 py-4 text-[15px] font-medium transition",
                  active ? "text-brand-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-600" : "text-ink-500 hover:text-ink-900",
                )}
              >
                {t.label}
                <span
                  className={cx(
                    "num inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
                    active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-ink-500",
                  )}
                >
                  {counts[t.key]}
                </span>
              </Link>
            );
          })}
        </div>

        <FilterForm action="/qarzdorlar" className="flex flex-wrap items-center gap-3 px-6 py-5">
          <input type="hidden" name="month" value={month} />
          {tab !== "unpaid" ? <input type="hidden" name="tab" value={tab} /> : null}
          <SearchInput defaultValue={q} placeholder="Ism yoki telefon orqali izlash..." label="Qidirish" className="min-w-[220px]" />
          <Select
            name="group"
            defaultValue={group}
            autoSubmit
            aria-label="Kurs"
            wrapperClassName="w-full sm:w-52"
            options={[{ value: "", label: "Barcha kurslar" }, ...data.groups.map((g) => ({ value: g, label: g }))]}
          />
          <Select
            name="lesson"
            defaultValue={lesson}
            autoSubmit
            searchable={false}
            aria-label="Dars vaqti"
            wrapperClassName="w-full sm:w-60"
            options={lessonOptions}
          />
          <DatePicker
            name="from"
            defaultValue={from}
            autoSubmit
            clearable
            max={to || today}
            placeholder="Sanadan"
            aria-label="To‘lov sanasi: dan"
            wrapperClassName="w-full sm:w-44"
          />
          <DatePicker
            name="to"
            defaultValue={to}
            autoSubmit
            clearable
            min={from || undefined}
            max={today}
            placeholder="Sanagacha"
            aria-label="To‘lov sanasi: gacha"
            wrapperClassName="w-full sm:w-44"
          />
          {filtered ? (
            <Link href={`/qarzdorlar?${new URLSearchParams({ month, ...(tab !== "unpaid" ? { tab } : {}) })}`} className={btn.outline} scroll={false}>
              <X className="size-4" aria-hidden />
              Tozalash
            </Link>
          ) : null}
        </FilterForm>

        {lessonNote ? (
          <p className="mx-6 mb-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-600">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
            <span className="num">{lessonNote}</span>
          </p>
        ) : null}

        {range ? (
          <p className="mx-6 mb-5 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-600">
            <CalendarRange className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
            <span>
              Faqat <b className="num font-semibold">{range}</b> kunlari qilingan {monthLabel(month)} to‘lovlari hisobga olinmoqda — shu kunlarda to‘lamaganlar «Qarzdorlar»da.
            </span>
          </p>
        ) : null}

        {rows.length === 0 ? (
          <div className="border-t border-line-soft">
            <EmptyState
              title={filtered ? "Hech narsa topilmadi" : tab === "unpaid" ? "Hamma to‘lov qilgan 🎉" : tab === "partial" ? "Qisman to‘laganlar yo‘q" : "Hali hech kim to‘liq to‘lamagan"}
              icon={tab === "paid" ? UserCheck : UserX}
              tone={tab === "unpaid" ? "emerald" : "slate"}
            >
              {filtered ? "Qidiruv, kurs, dars vaqti yoki sana filtrini o‘zgartirib ko‘ring." : `${monthLabel(month)} uchun ro‘yxat bo‘sh.`}
            </EmptyState>
          </div>
        ) : (
          <div className="relative overflow-x-auto border-t border-line-soft">
            <table className={cx("w-full", isTeacher ? "min-w-[1000px]" : "min-w-[1160px]")}>
              <thead className="bg-slate-50/70">
                <tr>
                  <th className={th}>O‘quvchi</th>
                  <th className={th}>Kurs</th>
                  {isTeacher ? null : <th className={th}>O‘qituvchi</th>}
                  <th className={th}>Keyingi dars</th>
                  <th className={th}>To‘landi / oylik</th>
                  <th className={`${th} text-right`}>Qolgan to‘lov</th>
                  <th className={th}>Oxirgi to‘lov</th>
                  <th className={th}>Holat</th>
                  {canPay ? <th className={`${th} text-right`}>Amal</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/50">
                    <td className={td}>
                      <StudentCell id={r.id} name={r.fullName} seq={r.seq} phone={r.phone} href={studentHref(r.id)} />
                    </td>
                    <td className={td}>
                      <GroupChip name={r.group} />
                    </td>
                    {isTeacher ? null : (
                      <td className={cx(td, "whitespace-nowrap")}>
                        {r.teacherName ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-ink-700">
                            <GraduationCap className="size-3.5 text-brand-500" aria-hidden />
                            {r.teacherName}
                          </span>
                        ) : (
                          <span className="text-ink-300">biriktirilmagan</span>
                        )}
                      </td>
                    )}
                    <td className={td}>
                      <NextLessonCell lessons={r.lessons} serverNow={serverNow} away={r.away} />
                    </td>
                    <td className={td}>
                      <PaidCell paid={r.paid} fee={r.monthlyFee} />
                    </td>
                    <td className={`${td} num whitespace-nowrap text-right text-[15px] font-semibold text-ink-900`}>{formatMoney(r.debt)}</td>
                    <td className={`${td} num whitespace-nowrap`}>{r.lastPaidAt ? formatDate(r.lastPaidAt) : <span className="text-ink-300">—</span>}</td>
                    <td className={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    {canPay ? (
                      <td className={`${td} text-right`}>
                        {r.status === "paid" ? null : (
                          <Link href={`/payments?${new URLSearchParams({ month, student: r.id })}#yangi-tolov`} className={btn.sm}>
                            <Plus className="size-4" aria-hidden />
                            To‘lov
                          </Link>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-6 py-4 text-[13px] text-ink-400">
          <span className="num">
            {totals.students} ta o‘quvchi · {tab === "paid" ? `to‘landi ${formatMoney(totals.paid)}` : `qarz ${formatMoney(totals.debt)}`} · {monthLabel(month)}
          </span>
          <Pagination page={data.page} pages={data.pages} href={pageHref} />
        </div>
      </Card>
    </>
  );
}
