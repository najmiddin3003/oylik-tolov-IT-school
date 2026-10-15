import type { Metadata } from "next";
import { Suspense } from "react";
import { HandCoins, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";
import { addMySalary, deleteMySalary } from "@/app/actions/me";
import { SalaryForm } from "@/components/SettingsForms";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, cx, EmptyState, IconTile, MiniStat, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { getMySalaryHistory } from "@/lib/data";
import { currentMonth, formatDate, formatMoney, formatNumber, monthLabel, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "Olingan avans/oylik" };

export default function MySalariesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MySalaries />
    </Suspense>
  );
}

async function MySalaries() {
  await roleGuard(["teacher", "admin"]);
  const data = await getMySalaryHistory();

  if (!data) {
    return (
      <>
        <PageHeader eyebrow="Oylik" title="Olingan avans/oylik" />
        <Card>
          <EmptyState title="Bu bo‘lim xodim profili uchun" icon={HandCoins} tone="violet">
            Telefon raqamingiz va o‘z parolingiz bilan kirganingizda olgan avans va oyliklaringizni shu yerda yozib borasiz.
          </EmptyState>
        </Card>
      </>
    );
  }

  const now = data.months.find((m) => m.month === currentMonth()) ?? data.months[0];
  const entries = data.months.reduce((n, m) => n + m.salaries.length, 0);

  return (
    <>
      <PageHeader
        eyebrow="Oylik"
        title="Olingan avans/oylik"
        subtitle="Rahbardan olgan avans va oyliklaringizni yozib boring — ular o‘sha oy oyligingizdan avtomatik ayiriladi."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MiniStat label={`${monthLabel(now.month)}: oylik (${now.pay.percent}%)`} value={formatMoney(now.pay.share)} icon={PiggyBank} tone="brand" />
        <MiniStat label={`${monthLabel(now.month)}: olindi`} value={formatMoney(now.pay.taken)} icon={HandCoins} tone="orange" />
        <MiniStat
          label={`${monthLabel(now.month)}: qoldi`}
          value={<span className={now.pay.left < 0 ? "text-rose-600" : "text-emerald-600"}>{formatMoney(now.pay.left)}</span>}
          icon={Wallet}
          tone="emerald"
        />
        <MiniStat
          label="Jami olingan"
          value={formatMoney(data.total.avans + data.total.oylik)}
          hint={`avans ${formatNumber(data.total.avans)} · oylik ${formatNumber(data.total.oylik)}`}
          icon={Wallet}
          tone="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="order-last grid min-w-0 gap-6 self-start xl:order-none">
          {entries === 0 ? (
            <Card>
              <EmptyState title="Hali yozuv yo‘q" icon={HandCoins} tone="violet">
                O‘ngdagi forma orqali olgan avans yoki oyligingizni yozing — tarix shu yerda oylar bo‘yicha ko‘rinadi.
              </EmptyState>
            </Card>
          ) : null}
          {data.months
            .filter((m) => m.salaries.length || m.month === currentMonth())
            .map((m) => (
              <Card key={m.month} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{monthLabel(m.month)}</h2>
                    <p className="num mt-0.5 text-sm text-ink-500">
                      Oylik ({m.pay.percent}%) {formatMoney(m.pay.share)} · olindi {formatMoney(m.pay.taken)}
                    </p>
                  </div>
                  <span
                    className={cx(
                      "num rounded-xl px-3 py-1.5 text-sm font-bold ring-1 ring-inset",
                      m.pay.left < 0 ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100",
                    )}
                  >
                    Qoldi: {formatMoney(m.pay.left)}
                  </span>
                </div>
                {m.salaries.length === 0 ? (
                  <p className="px-6 py-5 text-sm text-ink-400">Bu oy uchun hali avans yoki oylik yozilmagan.</p>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {m.salaries.map((x) => (
                      <li key={x.id} className="group flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:px-6">
                        <IconTile icon={x.kind === "oylik" ? Wallet : HandCoins} tone={x.kind === "oylik" ? "emerald" : "orange"} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold text-ink-900">
                            {x.kind === "oylik" ? "Oylik" : "Avans"} <span className="num ml-1">{formatMoney(x.amount)}</span>
                          </p>
                          <p className="num text-[13px] text-ink-500">
                            {formatDate(x.date)} da olindi{x.note ? ` · ${x.note}` : ""}
                          </p>
                        </div>
                        <Tag tone={x.selfReported ? "brand" : "slate"}>{x.selfReported ? "o‘zim yozdim" : "rahbar yozgan"}</Tag>
                        {x.selfReported ? (
                          <ConfirmAction
                            action={deleteMySalary.bind(null, x.id)}
                            confirmText={`${x.kind === "oylik" ? "Oylik" : "Avans"} ${formatMoney(x.amount)} yozuvi o‘chirilsinmi?`}
                            className={btn.iconDanger}
                            pendingText="…"
                            title="O‘chirish"
                          >
                            <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                          </ConfirmAction>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
        </div>

        <Card className="self-start p-6 xl:sticky xl:top-24">
          <div className="group mb-5 flex items-center gap-3.5">
            <IconTile icon={Plus} tone="violet" variant="solid" />
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Olgan pulimni yozish</h2>
              <p className="mt-0.5 text-sm text-ink-500">Avans yoki oylik, qachon va qaysi oy uchun</p>
            </div>
          </div>
          <SalaryForm month={currentMonth()} today={todayISO()} action={addMySalary} narrow defaultKind="avans" submitLabel="Yozib qo‘yish" />
          <p className="mt-4 text-xs leading-relaxed text-ink-400">Rahbar ham yozuvlarni ko‘radi. Xato yozgan bo‘lsangiz — o‘zingiz o‘chira olasiz; rahbar yozganlarini faqat rahbar o‘zgartiradi.</p>
        </Card>
      </div>
    </>
  );
}
