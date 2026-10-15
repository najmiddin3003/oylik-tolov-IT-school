import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookOpen, Crown, History, UserPlus, UsersRound } from "lucide-react";
import { LegacyPayForm, StaffAddForm } from "@/components/StaffForms";
import { StaffHelpButton } from "@/components/StaffHelp";
import { Card, CardHeader, cx, EmptyState, IconTile, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { getStaffPageData, type StaffRowView } from "@/lib/data";
import { formatUzPhone } from "@/lib/phone";
import { payKindOf, ROLE_LABEL, STATUS_LABEL, staffInitials, staffPercent, staffSalary } from "@/lib/staff-rules";
import { currentMonth, formatDateTime, formatMoney, isValidMonth } from "@/lib/time";

export const metadata: Metadata = { title: "Xodimlar" };

export default function StaffPage({ searchParams }: PageProps<"/staff">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StaffView searchParams={searchParams} />
    </Suspense>
  );
}

async function StaffView({ searchParams }: { searchParams: PageProps<"/staff">["searchParams"] }) {
  const session = await ownerGuard();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const d = await getStaffPageData();
  const active = d.staff.filter((s) => s.status !== "disabled");
  const disabled = d.staff.filter((s) => s.status === "disabled");

  return (
    <>
      <PageHeader
        eyebrow="Boshqaruv"
        title="Xodimlar"
        subtitle="O‘qituvchilar va administratorni qo‘shing: ular telefon raqamiga kelgan SMS kod bilan o‘z profilini ochadi va o‘z parolini yaratadi."
        actions={<StaffHelpButton />}
      />

      {d.legacy ? (
        <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5">
          <div className="group mb-4 flex items-start gap-3.5">
            <IconTile icon={History} tone="amber" variant="solid" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-amber-950">Avvalgi oylik hisobi kimniki?</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                Hozirgacha tushum ulushi
                {d.legacy.shareHistory.length ? ` (${d.legacy.shareHistory[d.legacy.shareHistory.length - 1].percent}%)` : ""} va{" "}
                {d.legacy.salaries} ta oylik/avans yozuvi bitta umumiy hisobda yuritilgan. Ularni o‘sha o‘qituvchining profiliga o‘tkazing — shunda uning oyligi
                to‘g‘ri hisoblanadi.
              </p>
            </div>
          </div>
          <LegacyPayForm staff={active.map((s) => ({ id: s.id, name: s.name, role: s.role }))} />
        </div>
      ) : null}

      {d.unassignedStudents ? (
        <Link
          href={`/students?${new URLSearchParams({ teacher: "none", month })}`}
          className="group mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm transition hover:bg-brand-50 sm:px-5"
        >
          <UsersRound className="size-[18px] text-brand-600" aria-hidden />
          <span className="min-w-[200px] flex-1 text-brand-900">
            <b className="font-semibold">{d.unassignedStudents} ta faol o‘quvchiga</b> hali o‘qituvchi biriktirilmagan. Kursga o‘qituvchi tanlansa
            (Sozlamalar → Kurslar), shu kurs o‘quvchilari unga o‘zi o‘tadi; qolganlarini ro‘yxatda belgilab, «Kurs» yoki «O‘qituvchi» tugmasi bilan biriktiring.
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
            Biriktirish
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
      ) : null}

      {/* Ro'yxat va qo'shish bloki bir xil balandlikda */}
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="flex min-w-0 flex-col">
          <CardHeader title="Xodimlar ro‘yxati" count={active.length} subtitle="Bosib — oyligi, foizi va kirish huquqi" />
          {active.length === 0 ? (
            <div className="border-t border-line-soft">
              <EmptyState title="Hali xodim yo‘q" icon={UsersRound} tone="sky">
                O‘ngdagi forma orqali o‘qituvchilar va administratorni qo‘shing.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {active.map((s) => (
                <StaffRow key={s.id} s={s} month={month} self={s.id === session.staffId} />
              ))}
            </ul>
          )}
          {disabled.length ? (
            <details className="border-t border-line-soft">
              <summary className="cursor-pointer px-6 py-3.5 text-sm font-medium text-ink-500">Kirishi o‘chirilganlar: {disabled.length} ta</summary>
              <ul className="divide-y divide-line-soft border-t border-line-soft">
                {disabled.map((s) => (
                  <StaffRow key={s.id} s={s} month={month} self={false} />
                ))}
              </ul>
            </details>
          ) : null}
        </Card>

        <Card className="flex flex-col p-6">
          <div className="group mb-5 flex items-center gap-3.5">
            <IconTile icon={UserPlus} tone="brand" variant="solid" />
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Yangi xodim</h2>
              <p className="mt-0.5 text-sm text-ink-500">Ism, telefon, lavozim va oyligi</p>
            </div>
          </div>
          <StaffAddForm courses={d.courses} />
        </Card>
      </div>
    </>
  );
}

function StaffRow({ s, month, self }: { s: StaffRowView; month: string; self: boolean }) {
  // Administrator — belgilangan oylik (summa), boshqalar — foiz
  const fixed = payKindOf(s.role) === "fixed";
  const percent = fixed ? 0 : staffPercent(s.shareHistory, month);
  const salary = fixed ? staffSalary(s.salaryHistory, month) : 0;
  const isOwner = s.role === "owner";
  return (
    <li>
      <Link href={`/staff/${s.id}?month=${month}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 transition hover:bg-slate-50/60">
        <span
          className={cx(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
            isOwner ? "bg-linear-to-br from-amber-400 to-orange-600" : s.role === "teacher" ? "bg-linear-to-br from-brand-500 to-brand-700" : "bg-linear-to-br from-emerald-400 to-emerald-600",
            s.status === "disabled" && "opacity-50 grayscale",
          )}
          aria-hidden
        >
          {isOwner ? <Crown className="size-[18px]" fill="currentColor" fillOpacity={0.25} /> : staffInitials(s.name)}
        </span>
        <span className="min-w-0 flex-1 basis-56">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink-900">{s.name}</span>
            {self ? <Tag>siz</Tag> : null}
            <Tag tone={isOwner ? "amber" : s.role === "teacher" ? "brand" : "emerald"}>{ROLE_LABEL[s.role]}</Tag>
            {s.status !== "active" ? <Tag tone={s.status === "invited" ? "amber" : "rose"}>{STATUS_LABEL[s.status]}</Tag> : null}
          </span>
          <span className="num mt-0.5 block truncate text-[13px] text-ink-500">
            {formatUzPhone(s.phone)}
            {s.lastLoginAt ? ` · oxirgi kirish ${formatDateTime(s.lastLoginAt)}` : ""}
          </span>
          {s.courses.length ? (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {s.courses.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                  <BookOpen className="size-3" aria-hidden />
                  {c}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        <span className="num flex shrink-0 items-center gap-2 text-[13px] text-ink-500">
          {s.role === "teacher" ? <span className="rounded-lg bg-violet-50 px-2 py-1 font-medium text-violet-700">{s.students} ta o‘quvchi</span> : null}
          {percent ? <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-ink-700">{percent}%</span> : null}
          {salary ? <span className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">oylik {formatMoney(salary)}</span> : null}
          <ArrowRight className="size-4 text-ink-300" aria-hidden />
        </span>
      </Link>
    </li>
  );
}
