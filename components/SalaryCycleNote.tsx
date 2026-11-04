// Oylik davri holati (foizli oylik): oy «oylik olindi» deb yozilguncha yopilmaydi — keyin tushgan to'lovlar ham shu oyga.
// Xodim profili, «Olingan avans/oylik» va rahbarning xodim sahifasida.
import Link from "next/link";
import { ArrowRight, CircleCheck, Hourglass, Info } from "lucide-react";
import { formatDate, isoToDate, monthLabel, shiftMonth } from "@/lib/time";
import { cx } from "./ui";

export type PayCycle = { closedOn: string | null; current: string } | null;

/** Kim ko'ryapti: xodimning o'zi (profil yoki «Olingan avans/oylik» formasi yonida) yoki rahbar */
type Who = "self" | "selfForm" | "owner";

function howToClose(who: Who, month: string): string {
  const what = `«Oylik» — «${monthLabel(month)}»`;
  if (who === "owner") return `Oylikni berganingizda ${what} deb yozing`;
  if (who === "selfForm") return `Oylikni olganingizda formada ${what} deb yozing`;
  return `Oylikni olganingizda «Olingan avans/oylik» bo‘limida ${what} deb yozing`;
}

export function SalaryCycleNote({
  cycle,
  month,
  thisMonth,
  who,
  href,
  className,
}: {
  cycle: PayCycle;
  /** Ko'rilayotgan oy */
  month: string;
  /** Joriy (kalendar) oy */
  thisMonth: string;
  who: Who;
  /** Ochiq oy sahifasiga havola (ko'rilayotgan oy undan keyin bo'lsa) */
  href?: string;
  className?: string;
}) {
  if (!cycle) return null;
  const box = "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed sm:px-5";
  const icon = "mt-0.5 size-[18px] shrink-0";

  if (cycle.closedOn) {
    return (
      <div className={cx(box, "border-emerald-200/80 bg-emerald-50/70 text-emerald-900", className)} role="status">
        <CircleCheck className={cx(icon, "text-emerald-600")} aria-hidden />
        <span>
          <b className="font-semibold">{monthLabel(month)} oyligi olingan</b> ({formatDate(isoToDate(cycle.closedOn))}) — oy yopildi. Undan keyin tushgan to‘lovlar keyingi
          oy oyligiga hisoblanadi.
        </span>
      </div>
    );
  }

  if (month === cycle.current) {
    const next = monthLabel(shiftMonth(month, 1));
    if (month < thisMonth) {
      return (
        <div className={cx(box, "border-amber-200/80 bg-amber-50/70 text-amber-900", className)} role="status">
          <Hourglass className={cx(icon, "text-amber-600")} aria-hidden />
          <span>
            <b className="font-semibold">{monthLabel(month)} oyligi hali olinmagan — oy yopilmagan.</b>{" "}
            {`«Oylik» deb yozilmaguncha keyin tushgan to‘lovlar ham (${monthLabel(thisMonth)} oyidagilar ham) shu oyga qo‘shiladi.`} {howToClose(who, month)}: undan
            keyingi to‘lovlar {next} oyligiga o‘tadi.
          </span>
        </div>
      );
    }
    return (
      <div className={cx(box, "border-line bg-slate-50/70 text-ink-600", className)}>
        <Info className={cx(icon, "text-ink-400")} aria-hidden />
        <span>
          Oy «Oylik» olindi deb yozilganda yopiladi: shu paytgacha tushgan to‘lovlar {monthLabel(month)} oyligiga, keyingilari — {next} oyligiga. Oy tugasa ham,
          oylik yozilmaguncha to‘lovlar shu oyga qo‘shilib boradi.
        </span>
      </div>
    );
  }

  if (month > cycle.current) {
    const open = monthLabel(cycle.current);
    return (
      <div className={cx(box, "border-amber-200/80 bg-amber-50/70 text-amber-900", className)} role="status">
        <Hourglass className={cx(icon, "text-amber-600")} aria-hidden />
        <span>
          <b className="font-semibold">{open} oyligi hali olinmagan</b>, shuning uchun hozir tushayotgan to‘lovlar {open} oyligiga qo‘shilmoqda. {open} uchun «Oylik»
          yozilgach, keyingi to‘lovlar navbatdagi oyga o‘tadi.
          {href ? (
            <>
              {" "}
              <Link href={href} className="inline-flex items-center gap-1 font-semibold text-amber-800 underline-offset-4 hover:underline">
                {open} oyligini ko‘rish
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </>
          ) : null}
        </span>
      </div>
    );
  }

  return null;
}
