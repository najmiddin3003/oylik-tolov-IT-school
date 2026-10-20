import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpDown, BookOpen, CalendarClock, Download, Plus, UserCheck, Users } from "lucide-react";
import { FilterForm, SearchInput } from "@/components/FilterForm";
import { Select } from "@/components/pickers";
import { QuickStudentButton } from "@/components/QuickStudent";
import { SyncAlert } from "@/components/ShellParts";
import { StudentsTable } from "@/components/StudentsTable";
import { btn, Card, cx, EmptyState, MiniStat, PageHeader, PageSkeleton, Pagination } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { listCourses, listGroups, listMyCourses, listScheduleTemplates, listStudents, listTeacherOptions, parseStudentTab, type StudentSort, type StudentTab } from "@/lib/data";
import { DAY_PRESETS, parseDayFilter, tashkentClock, WEEKDAY_NAMES } from "@/lib/schedule";
import { currentMonth, isValidMonth, monthLabel, nowMs, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "O‘quvchilar" };

const PAGE_SIZE = 20;
const SORTS: { key: StudentSort; label: string }[] = [
  { key: "name", label: "Ism bo‘yicha (A–Z)" },
  { key: "-name", label: "Ism bo‘yicha (Z–A)" },
  { key: "debt", label: "Qarz bo‘yicha (ko‘pdan)" },
];

export default function StudentsPage({ searchParams }: PageProps<"/students">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Students searchParams={searchParams} />
    </Suspense>
  );
}

async function Students({ searchParams }: { searchParams: PageProps<"/students">["searchParams"] }) {
  const { role } = await roleGuard(["owner", "teacher"]);
  // O'qituvchi — faqat o'z o'quvchilari: o'z kursiga qo'shadi va cheklangan maydonlarni tahrirlaydi; o'chirish — rahbarda
  const isOwner = role === "owner";
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const q = str("q").slice(0, 100);
  // O'qituvchiga faqat o'z o'quvchilari ko'rinadi — kurs filtri yo'q; dars kuni — faqat toq / juft / har kuni
  const group = isOwner ? str("group") : "";
  const dayRaw = parseDayFilter(str("day"));
  const day = isOwner || dayRaw === "toq" || dayRaw === "juft" || dayRaw === "har" ? dayRaw : "";
  const teacher = isOwner && /^([a-f0-9]{24}|none)$/i.test(str("teacher")) ? str("teacher") : "";
  const status = str("status") === "inactive" || str("status") === "all" ? (str("status") as "inactive" | "all") : "active";
  const tab: StudentTab = parseStudentTab(str("tab"));
  const sort: StudentSort = SORTS.some((s) => s.key === str("sort")) ? (str("sort") as StudentSort) : "name";
  const page = Math.max(1, Number(str("page")) || 1);

  const [data, groups, templates, teachers, courseList, myCourses] = await Promise.all([
    listStudents({ q, group, day, status, month, tab, sort, page, pageSize: PAGE_SIZE, teacher }),
    listGroups(),
    listScheduleTemplates(),
    isOwner ? listTeacherOptions() : Promise.resolve([]),
    isOwner ? listCourses() : Promise.resolve([]),
    // O'qituvchining «Yangi o'quvchi» oynasi uchun — unga biriktirilgan kurslar
    isOwner ? Promise.resolve([]) : listMyCourses(),
  ]);
  // Ommaviy «Kurs» amali uchun — faqat Sozlamalar → Kurslar ro'yxatidagilar
  const courses = courseList.filter((c) => c.inList).map((c) => ({ name: c.name, teachers: c.teachers }));
  const { rows, counts, stats } = data;
  const filtered = Boolean(q || group || day || teacher || tab !== "all" || status !== "active");
  const serverNow = nowMs();
  const todayName = WEEKDAY_NAMES[tashkentClock(serverNow).weekday - 1].toLowerCase();

  const base = {
    month,
    ...(q ? { q } : {}),
    ...(group ? { group } : {}),
    ...(day ? { day } : {}),
    ...(teacher ? { teacher } : {}),
    ...(status !== "active" ? { status } : {}),
  };
  const href = (extra: Record<string, string>) => `/students?${new URLSearchParams({ ...base, ...(tab !== "all" ? { tab } : {}), ...(sort !== "name" ? { sort } : {}), ...extra })}`;
  const tabHref = (t: StudentTab) => `/students?${new URLSearchParams({ ...base, ...(t !== "all" ? { tab: t } : {}), ...(sort !== "name" ? { sort } : {}) })}`;
  const nextSort = SORTS[(SORTS.findIndex((s) => s.key === sort) + 1) % SORTS.length];
  const currentSort = SORTS.find((s) => s.key === sort)!;

  const tabs: { key: StudentTab; label: string; n: number }[] = [
    { key: "all", label: "Barcha o‘quvchilar", n: counts.all },
    { key: "debt", label: "Qarzdorlar", n: counts.debt },
    { key: "paid", label: "To‘laganlar", n: counts.paid },
    { key: "unpaid", label: "To‘lamaganlar", n: counts.unpaid },
    { key: "partial", label: "Qisman to‘laganlar", n: counts.partial },
  ];
  // Dars kuni filtri: jadval turlari (toq / juft / har kuni); rahbarda — bugun, hafta kunlari va jadvalsizlar ham
  const presetOptions = DAY_PRESETS.map((p) => ({ value: p.key, label: p.label, hint: p.hint }));

  return (
    <>
      <PageHeader
        eyebrow={isOwner ? "O‘quvchilar bazasi" : "O‘qituvchi profili"}
        title={isOwner ? "O‘quvchilar" : "O‘quvchilarim"}
        subtitle={isOwner ? "Kurslar, o‘qituvchilar, oylik to‘lovlar va dars jadvalini bir joyda boshqaring." : "Sizga biriktirilgan o‘quvchilar: to‘lov holati va dars jadvali. Ustun kengligini sarlavha chetini surib o‘zgartirish mumkin."}
        actions={
          <>
            <a href={`/api/export/oquvchilar?${new URLSearchParams({ ...base, ...(tab !== "all" ? { tab } : {}) })}`} className={cx(btn.outline, "group")}>
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-600 text-white" aria-hidden>
                <Download className="icon-wiggle size-3.5" strokeWidth={2.4} />
              </span>
              Excel yuklash
            </a>
            {isOwner ? (
              <Link href="/students/new" className={btn.primary}>
                <Plus className="size-[18px]" strokeWidth={2.2} aria-hidden />
                Yangi o‘quvchi
              </Link>
            ) : (
              <QuickStudentButton forTeacher courses={myCourses} teachers={[]} templates={templates} today={todayISO()} />
            )}
          </>
        }
      />

      {isOwner ? (
        <Suspense fallback={null}>
          <SyncAlert />
        </Suspense>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MiniStat label="Jami o‘quvchilar" value={stats.total} icon={Users} tone="violet" />
        <MiniStat label="Bu oy faol" value={stats.activeThisMonth} icon={UserCheck} tone="sky" />
        <MiniStat label="Kurslar" value={stats.courses} hint={stats.courses ? "faol o‘quvchilar kurslari" : "kurs belgilanmagan"} icon={BookOpen} tone="emerald" />
        <MiniStat label="Bugun darsga keladi" value={stats.today} hint={todayName} icon={CalendarClock} tone="amber" />
      </div>

      <Card>
        <div className="flex gap-7 overflow-x-auto overflow-y-hidden border-b border-line px-6">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                aria-current={active ? "page" : undefined}
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
                  {t.n}
                </span>
              </Link>
            );
          })}
        </div>

        <FilterForm action="/students" className="flex flex-wrap items-center gap-3 px-6 py-5">
          <input type="hidden" name="month" value={month} />
          {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
          {sort !== "name" ? <input type="hidden" name="sort" value={sort} /> : null}
          <SearchInput defaultValue={q} placeholder="Ism yoki telefon orqali izlash..." label="Qidirish" className="min-w-[220px]" />
          {isOwner ? (
            <Select
              name="group"
              defaultValue={group}
              autoSubmit
              aria-label="Kurs"
              wrapperClassName="w-full sm:w-48"
              options={[{ value: "", label: "Barcha kurslar" }, ...groups.map((g) => ({ value: g, label: g }))]}
            />
          ) : null}
          {isOwner && teachers.length ? (
            <Select
              name="teacher"
              defaultValue={teacher}
              autoSubmit
              searchable={false}
              aria-label="O‘qituvchi"
              wrapperClassName="w-full sm:w-52"
              options={[
                { value: "", label: "Barcha o‘qituvchilar" },
                ...teachers.map((t) => ({ value: t.id, label: t.name, hint: t.status === "invited" ? "kutilmoqda" : undefined })),
                { value: "none", label: "O‘qituvchi biriktirilmagan" },
              ]}
            />
          ) : null}
          <Select
            name="day"
            defaultValue={day}
            autoSubmit
            searchable={false}
            aria-label="Dars kuni"
            wrapperClassName="w-full sm:w-52"
            options={
              isOwner
                ? [
                    { value: "", label: "Barcha dars kunlari" },
                    { value: "today", label: "Bugun keladiganlar", hint: todayName },
                    ...presetOptions,
                    ...WEEKDAY_NAMES.map((n, i) => ({ value: String(i + 1), label: n })),
                    { value: "none", label: "Dars vaqti kiritilmagan" },
                  ]
                : [{ value: "", label: "Barcha dars kunlari" }, ...presetOptions]
            }
          />
          <Select
            name="status"
            defaultValue={status}
            autoSubmit
            aria-label="Holat"
            wrapperClassName="w-full sm:w-48"
            options={[
              { value: "active", label: "Faol o‘quvchilar" },
              { value: "inactive", label: "Nofaol" },
              { value: "all", label: "Hammasi" },
            ]}
          />
          <Link
            href={`/students?${new URLSearchParams({ ...base, ...(tab !== "all" ? { tab } : {}), ...(nextSort.key !== "name" ? { sort: nextSort.key } : {}) })}`}
            className={cx(btn.outline, "w-11 px-0", sort !== "name" && "border-brand-200 bg-brand-50 text-brand-700")}
            aria-label={`Saralash: ${currentSort.label}. Bosilsa: ${nextSort.label}`}
            title={`Saralash: ${currentSort.label}`}
          >
            <ArrowUpDown className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </Link>
        </FilterForm>

        {rows.length === 0 ? (
          <div className="border-t border-line-soft">
            <EmptyState title={filtered ? "Hech narsa topilmadi" : isOwner ? "Hali o‘quvchi qo‘shilmagan" : "Sizga hali o‘quvchi biriktirilmagan"} icon={Users} tone="violet">
              {filtered ? (
                "Qidiruv yoki filtr shartlarini o‘zgartirib ko‘ring."
              ) : !isOwner ? (
                "«Yangi o‘quvchi» tugmasi orqali o‘z kursingizga o‘quvchi qo‘shing — yoki rahbar biriktirgach, ular shu yerda ko‘rinadi."
              ) : (
                <>
                  <Link href="/students/new" className="font-medium text-brand-600 hover:underline">
                    Birinchi o‘quvchini qo‘shing
                  </Link>{" "}
                  yoki{" "}
                  <Link href="/sync" className="font-medium text-brand-600 hover:underline">
                    Google Sheets’dan import qiling
                  </Link>
                  .
                </>
              )}
            </EmptyState>
          </div>
        ) : (
          <StudentsTable
            rows={rows}
            month={month}
            monthTitle={monthLabel(month)}
            templates={templates}
            serverNow={serverNow}
            showGroup={groups.length > 1}
            readOnly={!isOwner}
            teachers={teachers}
            courses={courses}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-6 py-4 text-[13px] text-ink-400">
          <span>
            {counts.all} ta o‘quvchidan {data.shown} tasi ko‘rsatilmoqda
          </span>
          <span className="flex items-center gap-3">
            {monthLabel(month)}
            <Pagination page={data.page} pages={data.pages} href={(p) => href({ page: String(p) })} />
          </span>
        </div>
      </Card>
    </>
  );
}
