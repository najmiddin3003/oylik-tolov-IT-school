// «Bu oy rejasi» (xodim sahifasi va «Profilim») — oylik davri bo'yicha: oylik olingandan keyin tushgan har bir to'lov
// (qaysi oy uchunligidan qat'i nazar) keyingi oy oyligiga hisoblanadi. Shu oy oyligiga amalda qancha yig'ildi, shu oy uchun
// qancha to'lanmagan (to'lamaganlar ro'yxatiga havola bilan) va hamma to'lasa oylik qancha bo'ladi.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Target } from "lucide-react";
import type { PayPlan } from "@/lib/staff-rules";
import { formatDate, formatMoney, formatNumber, isoToDate, monthLabel, shiftMonth } from "@/lib/time";
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
  const reach = plan.collected + plan.debt;
  const pct = reach ? Math.round((plan.collected / reach) * 100) : 0;
  const name = monthLabel(month);
  return (
    <section aria-label={`${name} oyligi`} className="mb-6 rounded-2xl border border-brand-100 bg-linear-to-br from-brand-50/60 to-violet-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
          <Target className="size-4 text-brand-600" aria-hidden />
          {name} oyligi
        </h3>
        <p className="num text-[13px] text-ink-500">
          {center ? "Butun markaz: " : ""}
          {plan.students} ta o‘quvchi · {plan.percent}%
        </p>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
        <PlanFigure
          label="Amalda yig‘ildi"
          value={formatMoney(plan.collected)}
          tone="emerald"
          hint={
            <>
              {plan.openedOn ? `${formatDate(isoToDate(plan.openedOn))} dan beri tushgan` : `${name} oyligiga hisoblangan`}
              <br />
              oylik: {formatMoney(plan.share)}
            </>
          }
        />
        <PlanFigure
          label="Hali to‘lanmagan"
          value={formatMoney(plan.debt)}
          tone={plan.debt ? "amber" : "slate"}
          hint={
            plan.debtors ? (
              <>
                <Link href={debtHref} className="inline-flex items-center gap-1 font-medium text-amber-800 underline-offset-4 hover:underline">
                  {plan.debtors} ta o‘quvchi {name} uchun to‘lamagan
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
                {plan.closed ? <span className="block">to‘lasa — {monthLabel(shiftMonth(month, 1))} oyligiga</span> : null}
              </>
            ) : plan.students ? (
              "hamma to‘lagan 🎉"
            ) : (
              "bu oyda o‘quvchi yo‘q"
            )
          }
        />
        <PlanFigure
          label="Rejadagi oylik"
          value={formatMoney(plan.planShare)}
          tone="brand"
          strong
          hint={plan.closed ? "oylik olingan — yakuniy" : `hamma to‘lasa: ${formatNumber(reach)} × ${plan.percent}%`}
        />
      </div>

      {plan.closed ? null : (
        <div className="mt-4 flex items-center gap-3">
          <Progress value={plan.collected} max={reach} className="h-2 flex-1 bg-surface" />
          <span className={cx("num w-12 text-right text-sm font-bold", pct >= 100 ? "text-emerald-600" : "text-brand-700")}>{pct}%</span>
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        Oylik olingandan keyin tushgan har bir to‘lov (qaysi oy uchunligidan qat’i nazar) keyingi oy oyligiga hisoblanadi. O‘quvchilarning {name} uchun oylik
        to‘lovlari jami: <span className="num whitespace-nowrap">{formatMoney(plan.expected)}</span>.
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
      {hint ? <div className="num mt-1 text-xs leading-relaxed text-ink-500">{hint}</div> : null}
    </div>
  );
}
