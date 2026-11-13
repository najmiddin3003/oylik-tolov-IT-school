import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgePercent, Info, Settings2 } from "lucide-react";
import { StudentDiscountList } from "@/components/Discounts";
import { btn, Card, CardHeader, EmptyState, MiniStat, PageHeader, PageSkeleton } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { getDiscountsPage } from "@/lib/data";
import { formatMoney, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Chegirmalar" };

export default function DiscountsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DiscountsView />
    </Suspense>
  );
}

async function DiscountsView() {
  const { role } = await roleGuard(["owner", "admin"]);
  const d = await getDiscountsPage();
  const withDiscount = d.students.filter((s) => s.current);
  const saved = withDiscount.reduce((sum, s) => sum + (s.listFee - s.netFee), 0);

  return (
    <>
      <PageHeader
        eyebrow="O‘quvchilar"
        title="Chegirmalar"
        subtitle="O‘quvchiga chegirmani switch bilan yoqing yoki o‘chiring — tanlangan oydan qo‘llanadi, o‘tgan oylar hisobi o‘zgarmaydi."
        actions={
          role === "owner" ? (
            <Link href="/settings#chegirmalar" className={btn.outline}>
              <Settings2 className="size-4" aria-hidden />
              Chegirma turlari
            </Link>
          ) : null
        }
      />

      {!d.enabled ? (
        <Card>
          <EmptyState title="Chegirmalar o‘chirilgan" icon={BadgePercent}>
            {role === "owner" ? (
              <>
                Sozlamalar → «Chegirmalar» bo‘limida yoqing.{" "}
                <Link href="/settings#chegirmalar" className="font-medium text-brand-700 hover:underline">
                  Sozlamalarga o‘tish
                </Link>
              </>
            ) : (
              "Rahbar Sozlamalarda yoqqanda ishlaydi."
            )}
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3 xl:gap-5">
            <MiniStat label="Chegirma turlari" value={d.types.length} icon={BadgePercent} tone="amber" />
            <MiniStat label={`${monthLabel(d.month)}: chegirmali o‘quvchilar`} value={withDiscount.length} icon={BadgePercent} tone="violet" />
            <MiniStat label="Bu oy chegirma jami" value={<span className="text-xl">{formatMoney(saved)}</span>} icon={BadgePercent} tone="emerald" />
          </div>
          {!d.types.length ? (
            <p className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Hali chegirma turi yo‘q — {role === "owner" ? "Sozlamalar → «Chegirmalar» da qo‘shing" : "rahbar Sozlamalarda qo‘shadi"}.
            </p>
          ) : null}
          <Card className="overflow-hidden">
            <CardHeader title="Faol o‘quvchilar" count={d.students.length} subtitle="Switch yoqilsa — chegirma turi va qaysi oydan tanlanadi" />
            <StudentDiscountList students={d.students} types={d.types} month={d.month} canLink={role === "owner"} />
          </Card>
        </>
      )}
    </>
  );
}
