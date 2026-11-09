// «Bu oy rejasi» (xodim sahifasi va «Profilim»): o'quvchilar shu oy qancha to'lashi kerak, hamma to'lasa oylik qancha bo'ladi,
// amalda qancha yig'ildi va qancha yig'ilmagan (to'lamaganlar ro'yxatiga havola bilan). Shu oy uchun to'lanib, oldingi oy
// oyligiga hisoblangan pul (oylik davri bo'yicha) alohida ko'rsatiladi va rejadagi oylikka qayta qo'shilmaydi.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, History, Target } from "lucide-react";
import type { PayPlan } from "@/lib/staff-rules";
import { formatMoney, formatNumber, monthLabel } from "@/lib/time";
import { cx, Progress } from "./ui";

export function PayPlanPanel({
  plan,
  month,
  debtHref,
  center,
}: {
  plan: PayPlan;
  month: string;
  /** To'lamaganlar ro'yxati (O'quvchilar → Qarzdorlar, shu oy) */
  debtHref: string;
  /** Markaz tushumidan oladi — reja barcha o'quvchilar bo'yicha */
  center: boolean;
}) {
  // Bu oy oyligiga tegishli qism: oldingi oy oyligida hisoblangan pul chiqarilgan
  const own = plan.collected + plan.debt;
  const pct = own ? Math.round((plan.collected / own) * 100) : 0;
  return (
    <section aria-label={`${monthLabel(month)} rejasi`} className="mb-6 rounded-2xl border border-brand-100 bg-linear-to-br from-brand-50/60 to-violet-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
          <Target className="size-4 text-brand-600" aria-hidden />
          {monthLabel(month)} rejasi
        </h3>
        <p className="num text-[13px] text-ink-500">
          {center ? "Butun markaz: " : ""}
          {plan.students} ta o‘quvchi · {plan.percent}%
        </p>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <PlanFigure label="To‘lanishi kerak" value={formatMoney(plan.expected)} hint={`${plan.students} ta o‘quvchining oylik to‘lovi`} />
        <PlanFigure
          label="Rejadagi oylik"
          value={formatMoney(plan.planShare)}
          hint={plan.earlier ? `qo‘lga tegmagan pul: ${formatNumber(own)} × ${plan.percent}%` : `hamma to‘lasa, ${plan.percent}%`}
          tone="brand"
          strong
        />
        <PlanFigure label="Amalda yig‘ildi" value={formatMoney(plan.collected)} hint={`shu oy oyligiga · ${pct}% · ${plan.paidCount} ta to‘ladi`} tone="emerald" />
        <PlanFigure
          label="Yig‘ilmagan"
          value={formatMoney(plan.debt)}
          tone={plan.debt ? "amber" : "slate"}
          hint={
            plan.debtors ? (
              <Link href={debtHref} className="inline-flex items-center gap-1 font-medium text-amber-800 underline-offset-4 hover:underline">
                {plan.debtors} ta o‘quvchi to‘lamagan
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : plan.students ? (
              "hamma to‘lagan 🎉"
            ) : (
              "bu oyda o‘quvchi yo‘q"
            )
          }
        />
      </div>

      {plan.earlier ? (
        <p className="num mt-3 rounded-xl bg-surface/80 px-4 py-2.5 text-[13px] leading-relaxed text-ink-600 ring-1 ring-inset ring-line-soft">
          <History className="mr-1.5 inline size-3.5 -translate-y-px text-ink-400" aria-hidden />
          {plan.earlierMonths.map(monthLabel).join(", ")} oyligiga hisoblangan:{" "}
          <b className="whitespace-nowrap font-semibold text-ink-900">{formatMoney(plan.earlier)}</b>{" "}
          <span className="text-ink-400">— shu oy uchun to‘langan, lekin oldingi oy oyligida; bu oy oyligiga qayta qo‘shilmaydi</span>
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Progress value={plan.collected} max={own} className="h-2 flex-1 bg-surface" />
        <span className={cx("num w-12 text-right text-sm font-bold", pct >= 100 ? "text-emerald-600" : "text-brand-700")}>{pct}%</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        Shu oy uchun to‘lovlar bo‘yicha (o‘tgan oylar qarzi kirmaydi); oldingi oy oyligida hisoblangan pul qayta qo‘shilmaydi. Hisoblangan
        oylik pastda — amalda tushgan pul bo‘yicha.
      </p>
    </section>
  );
}

function PlanFigure({
  label,
  value,
  hint,
  tone = "slate",
  strong,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "slate" | "brand" | "emerald" | "amber";
  strong?: boolean;
}) {
  const tones = {
    slate: "text-ink-900",
    brand: "text-brand-800",
    emerald: "text-emerald-700",
    amber: "text-amber-800",
  };
  return (
    <div className="rounded-xl bg-surface/80 px-4 py-3 ring-1 ring-inset ring-line-soft">
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className={cx("num mt-1 leading-tight", strong ? "text-[20px] font-bold" : "text-[17px] font-semibold", tones[tone])}>{value}</p>
      {hint ? <div className="num mt-1 text-xs text-ink-500">{hint}</div> : null}
    </div>
  );
}
