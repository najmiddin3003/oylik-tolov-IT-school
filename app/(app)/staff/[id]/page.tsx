import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BadgePercent, CircleSlash, Crown, HandCoins, KeyRound, PiggyBank, RotateCcw, Trash2, UserCheck, UserCog, Wallet } from "lucide-react";
import { addSalary, deleteSalary, deleteStaff, setStaffAccess, setStaffPercent, setStaffSalary, updateStaff } from "@/app/actions/staff";
import { FixedPayForm, PercentForm, SalaryForm } from "@/components/SettingsForms";
import { StaffEditForm } from "@/components/StaffForms";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, cx, IconTile, PageSkeleton, Tag, type Tone } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { getStaffDetail } from "@/lib/data";
import { formatUzPhone } from "@/lib/phone";
import { payKindOf, payLabel, ROLE_HINT, ROLE_LABEL, STATUS_LABEL, staffInitials, staffSalary } from "@/lib/staff-rules";
import { currentMonth, formatDate, formatDateTime, formatMoney, isValidMonth, monthLabel, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "Xodim" };

export default function StaffMemberPage({ params, searchParams }: PageProps<"/staff/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StaffMember params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function StaffMember({ params, searchParams }: { params: PageProps<"/staff/[id]">["params"]; searchParams: PageProps<"/staff/[id]">["searchParams"] }) {
  const session = await ownerGuard();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const d = await getStaffDetail(id, month);
  if (!d) notFound();
  const { staff, pay } = d;
  const self = session.staffId === staff.id;
  const isOwner = staff.role === "owner";
  // Administrator — belgilangan oylik (foiz emas)
  const fixed = payKindOf(staff.role) === "fixed";
  const salaryNow = staffSalary(staff.salaryHistory, currentMonth());

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={cx(
              "inline-flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white",
              isOwner ? "bg-linear-to-br from-amber-400 to-orange-600" : staff.role === "teacher" ? "bg-linear-to-br from-brand-500 to-brand-700 shadow-brand" : "bg-linear-to-br from-emerald-400 to-emerald-600",
            )}
            aria-hidden
          >
            {isOwner ? <Crown className="size-6" fill="currentColor" fillOpacity={0.25} /> : staffInitials(staff.name)}
          </span>
          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
              <Link href="/staff" className="hover:text-ink-700">
                Xodimlar
              </Link>{" "}
              / {ROLE_LABEL[staff.role]}
            </p>
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink-900 sm:text-[30px]">{staff.name}</h1>
            <div className="num mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <span>{formatUzPhone(staff.phone)}</span>
              <Tag tone={staff.status === "active" ? "emerald" : staff.status === "invited" ? "amber" : "rose"}>{STATUS_LABEL[staff.status]}</Tag>
              {staff.teaches ? <Tag tone="brand">Dars ham beradi</Tag> : null}
              {staff.lastLoginAt ? <span className="text-ink-400">oxirgi kirish: {formatDateTime(staff.lastLoginAt)}</span> : null}
            </div>
          </div>
        </div>
        {self ? null : (
          <div className="flex flex-wrap items-center gap-2.5">
            {staff.status === "disabled" ? (
              <ConfirmAction action={setStaffAccess.bind(null, staff.id, "enable")} confirmText={`${staff.name}ning kirishi qayta yoqilsinmi?`} className={btn.outline} pendingText="…">
                <UserCheck className="size-[17px]" aria-hidden />
                Kirishni yoqish
              </ConfirmAction>
            ) : (
              <ConfirmAction
                action={setStaffAccess.bind(null, staff.id, "disable")}
                confirmText={`${staff.name}ning tizimga kirishi o‘chirilsinmi? Hozir ochiq turgan sessiyalari ham darhol yopiladi. Oylik yozuvlari saqlanadi.`}
                className={btn.danger}
                pendingText="…"
              >
                <CircleSlash className="size-[17px]" aria-hidden />
                Kirishni o‘chirish
              </ConfirmAction>
            )}
            {staff.status === "active" ? (
              <ConfirmAction
                action={setStaffAccess.bind(null, staff.id, "reset")}
                confirmText={`${staff.name}ning paroli bekor qilinsinmi? Keyingi kirishda telefon raqamini kiritadi — SMS kod keladi va yangi parol qo‘yadi.`}
                className={btn.outline}
                pendingText="…"
              >
                <RotateCcw className="size-[17px]" aria-hidden />
                Parolni bekor qilish
              </ConfirmAction>
            ) : null}
            {staff.status === "invited" && !staff.activatedAt ? (
              <ConfirmAction
                action={deleteStaff.bind(null, staff.id)}
                confirmText={`${staff.name} xodimlar ro‘yxatidan o‘chirilsinmi? (Hali ro‘yxatdan o‘tmagan.)`}
                className={btn.iconDanger}
                pendingText="…"
                title="Ro‘yxatdan o‘chirish"
              >
                <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </ConfirmAction>
            ) : null}
          </div>
        )}
      </div>

      {staff.status === "invited" ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3.5 text-sm leading-relaxed text-amber-900 sm:px-5">
          <KeyRound className="mt-0.5 size-[18px] shrink-0 text-amber-600" aria-hidden />
          <span>
            {staff.name} hali ro‘yxatdan o‘tmagan. Unga ayting: kirish sahifasida <b className="font-semibold">{formatUzPhone(staff.phone)}</b> raqamini kiritsin — birinchi
            marta SMS kod keladi, so‘ng o‘zi parol qo‘yadi.
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 gap-6 self-start">
          {/* Oylik */}
          <Card className="p-6">
            <SectionTitle
              icon={PiggyBank}
              tone="emerald"
              title={`Oylik — ${monthLabel(month)}`}
              subtitle={
                fixed
                  ? "Belgilangan oylik — har oy bir xil summa. Olingan oylik va avanslar ayiriladi. Oyni yuqoridagi oy tanlagichdan o‘zgartiring."
                  : staff.shareBase === "center"
                    ? "Butun markaz tushumidan foiz. Olingan oylik va avanslar ayiriladi. Oyni yuqoridagi oy tanlagichdan o‘zgartiring."
                    : "O‘z o‘quvchilari shu oyda to‘lagan pullardan foiz (o‘tgan oylar qarzi uchun to‘langani ham shu oyga). Olingan oylik va avanslar ayiriladi. Oyni yuqoridagi oy tanlagichdan o‘zgartiring."
              }
            />
            <div className={cx("mb-6 grid gap-3", fixed ? "sm:grid-cols-3" : "sm:grid-cols-2 2xl:grid-cols-4")}>
              {fixed ? null : <Figure label={staff.shareBase === "center" ? "Markaz tushumi" : "O‘quvchilari tushumi"} value={formatMoney(pay.base)} />}
              <Figure label={payLabel(pay)} value={formatMoney(pay.share)} tone="brand" />
              <Figure label="Olindi (oylik/avans)" value={`− ${formatMoney(pay.taken)}`} tone="amber" />
              <Figure label="Qoldi" value={formatMoney(pay.left)} tone={pay.left < 0 ? "rose" : "emerald"} strong />
            </div>
            <SalaryForm month={month} today={todayISO()} action={addSalary.bind(null, staff.id)} />
            <div className="mt-6 overflow-hidden rounded-2xl border border-line">
              <p className="flex items-center justify-between gap-3 border-b border-line-soft bg-slate-50/70 px-4 py-2.5 text-sm font-semibold text-ink-700">
                {monthLabel(month)} uchun olinganlar
                <span className="num text-ink-500">{d.salaries.length} ta</span>
              </p>
              {d.salaries.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink-400">Bu oy uchun hali oylik yoki avans yozilmagan.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {d.salaries.map((x) => (
                    <li key={x.id} className="group flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                      <IconTile icon={x.kind === "oylik" ? Wallet : HandCoins} tone={x.kind === "oylik" ? "emerald" : "orange"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-ink-900">
                          {x.kind === "oylik" ? "Oylik" : "Avans"} <span className="num ml-1 text-ink-900">{formatMoney(x.amount)}</span>
                        </p>
                        <p className="num text-[13px] text-ink-500">
                          {formatDate(x.date)} da olindi{x.note ? ` · ${x.note}` : ""}
                        </p>
                      </div>
                      {x.selfReported ? <Tag tone="brand">o‘zi yozgan</Tag> : null}
                      <ConfirmAction
                        action={deleteSalary.bind(null, x.id)}
                        confirmText={`${x.kind === "oylik" ? "Oylik" : "Avans"} ${formatMoney(x.amount)} yozuvi o‘chirilsinmi?`}
                        className={btn.iconDanger}
                        pendingText="…"
                        title="O‘chirish"
                      >
                        <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                      </ConfirmAction>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Oylik summasi (administrator) yoki foizi */}
          {fixed ? (
            <Card className="p-6">
              <SectionTitle
                icon={Wallet}
                tone="brand"
                title="Belgilangan oylik"
                subtitle={`Hozir: ${salaryNow ? formatMoney(salaryNow) : "belgilanmagan"}. O‘zgartirilsa — tanlangan oydan boshlab hisoblanadi, o‘tgan oylar o‘zgarmaydi.`}
              />
              <FixedPayForm month={currentMonth()} current={salaryNow} action={setStaffSalary.bind(null, staff.id)} />
              {d.salaryHistory.length > 1 ? (
                <p className="num mt-4 text-[13px] leading-relaxed text-ink-500">
                  Tarix: {d.salaryHistory.map((h) => `${monthLabel(h.from)} dan ${formatMoney(h.amount)}`).join(" · ")}
                </p>
              ) : null}
            </Card>
          ) : (
            <Card className="p-6">
              <SectionTitle icon={BadgePercent} tone="brand" title="Oylik foizi" subtitle={`Hozir: ${pay.percent}%. O‘zgartirilsa — tanlangan oydan boshlab hisoblanadi, o‘tgan oylar o‘zgarmaydi.`} />
              <PercentForm month={currentMonth()} current={pay.percent} action={setStaffPercent.bind(null, staff.id)} />
            </Card>
          )}
        </div>

        <div className="grid gap-6 self-start">
          <Card className="p-6">
            <SectionTitle icon={UserCog} tone="sky" title="Ma’lumotlari" subtitle={ROLE_HINT[staff.role]} />
            <StaffEditForm action={updateStaff.bind(null, staff.id)} name={staff.name} role={staff.role} shareBase={staff.shareBase} teaches={staff.teaches} self={self} />
          </Card>

        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon, tone, title, subtitle }: { icon: typeof Wallet; tone: Tone; title: string; subtitle?: ReactNode }) {
  return (
    <div className="group mb-6 flex items-start gap-3.5">
      <IconTile icon={icon} tone={tone} variant="solid" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function Figure({ label, value, tone = "slate", strong }: { label: string; value: string; tone?: "slate" | "brand" | "amber" | "emerald" | "rose"; strong?: boolean }) {
  const tones = {
    slate: "bg-slate-50 ring-line-soft text-ink-900",
    brand: "bg-brand-50/70 ring-brand-100 text-brand-800",
    amber: "bg-amber-50/70 ring-amber-100 text-amber-800",
    emerald: "bg-emerald-50/70 ring-emerald-100 text-emerald-700",
    rose: "bg-rose-50/70 ring-rose-100 text-rose-700",
  };
  return (
    <div className={cx("rounded-xl px-4 py-3 ring-1 ring-inset", tones[tone])}>
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className={cx("num mt-1 leading-tight", strong ? "text-[20px] font-bold" : "text-[17px] font-semibold")}>{value}</p>
    </div>
  );
}
