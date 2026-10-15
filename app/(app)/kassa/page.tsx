import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Banknote, CheckCheck, CircleX, Clock3, CreditCard, Crown, Inbox, Send, Coins, type LucideIcon } from "lucide-react";
import { acceptCashierBalance, decideHandover } from "@/app/actions/kassa";
import { HandoverForm } from "@/components/KassaForms";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, CardHeader, cx, EmptyState, IconTile, PageHeader, PageSkeleton, Tag, type Tone } from "@/components/ui";
import { roleGuard } from "@/lib/auth";
import { getKassaPageData } from "@/lib/data";
import { moneyTotal, type HandoverRow, type Money } from "@/lib/kassa";
import { formatDateTime, formatMoney } from "@/lib/time";

export const metadata: Metadata = { title: "Kassa" };

export default function KassaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <KassaView />
    </Suspense>
  );
}

async function KassaView() {
  await roleGuard(["owner", "admin"]);
  const d = await getKassaPageData();

  if (d.role === "admin") {
    const k = d.kassa;
    return (
      <>
        <PageHeader
          eyebrow="Kassa"
          title="Mening kassam"
          subtitle="Siz kiritgan to‘lovlar shu yerga tushadi. Kun oxirida rahbarga topshirasiz — rahbar qabul qilgach, kassangizdan chiqadi."
        />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          <MoneyTile label="Kassamda — naqd" value={k.balance.cash} icon={Banknote} tone="emerald" />
          <MoneyTile label="Kassamda — karta" value={k.balance.card} icon={CreditCard} tone="brand" />
          <MoneyTile label="Bugun kiritildi" value={moneyTotal(k.today)} icon={Inbox} tone="sky" hint={split(k.today)} />
          <MoneyTile label="Qabul kutilmoqda" value={moneyTotal(k.pending)} icon={Clock3} tone="amber" hint={moneyTotal(k.pending) ? split(k.pending) : "topshiruv yo‘q"} />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card className="order-last min-w-0 self-start xl:order-none">
            <CardHeader title="Topshiruvlarim" count={d.history.length} subtitle="Rahbarga topshirilgan pullar va holati" />
            <HandoverList rows={d.history} showFrom={false} />
          </Card>
          <Card className="self-start p-6">
            <div className="group mb-5 flex items-center gap-3.5">
              <IconTile icon={Send} tone="orange" variant="solid" />
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Rahbarga topshirish</h2>
                <p className="mt-0.5 text-sm text-ink-500">Naqd va karta alohida</p>
              </div>
            </div>
            <HandoverForm available={{ cash: Math.max(0, k.available.cash), card: Math.max(0, k.available.card) }} />
          </Card>
        </div>
      </>
    );
  }

  const atAdmins = d.cashiers.reduce<Money>((s, c) => ({ cash: s.cash + c.balance.cash, card: s.card + c.balance.card }), { cash: 0, card: 0 });
  return (
    <>
      <PageHeader
        eyebrow="Kassa"
        title="Kassa"
        subtitle="Administratorlar yig‘gan pul va sizga topshirilganlari. Siz qabul qilmaguningizcha pul administrator kassasida turadi."
      />

      {d.pending.length ? (
        <Card className="mb-6 overflow-hidden border-amber-200/80">
          <div className="group flex items-center gap-3.5 border-b border-amber-100 bg-amber-50/70 px-5 py-4 sm:px-6">
            <IconTile icon={Inbox} tone="amber" variant="solid" />
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Qabul qilishingiz kerak: {d.pending.length} ta</h2>
              <p className="num mt-0.5 text-sm text-ink-500">Jami {formatMoney(d.pending.reduce((s, h) => s + h.cash + h.card, 0))}</p>
            </div>
          </div>
          <ul className="divide-y divide-line-soft">
            {d.pending.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-6">
                <div className="min-w-[220px] flex-1">
                  <p className="text-[15px] font-semibold text-ink-900">{h.fromName}</p>
                  <p className="num mt-0.5 text-[13px] text-ink-500">
                    {formatDateTime(h.createdAt)}
                    {h.note ? ` · ${h.note}` : ""}
                  </p>
                </div>
                <Amounts cash={h.cash} card={h.card} />
                <div className="flex flex-wrap gap-2">
                  <ConfirmAction
                    action={decideHandover.bind(null, h.id, "accept")}
                    confirmText={`${h.fromName}dan ${formatMoney(h.cash + h.card)} (naqd ${formatMoney(h.cash)}, karta ${formatMoney(h.card)}) qabul qilindimi?`}
                    className={cx(btn.primary, "h-10")}
                    pendingText="…"
                  >
                    <CheckCheck className="size-4" aria-hidden />
                    Qabul qildim
                  </ConfirmAction>
                  <ConfirmAction
                    action={decideHandover.bind(null, h.id, "reject")}
                    confirmText="Topshiruv rad etilsinmi? Pul administrator kassasida qoladi."
                    className={cx(btn.danger, "h-10")}
                    pendingText="…"
                  >
                    <CircleX className="size-4" aria-hidden />
                    Rad etish
                  </ConfirmAction>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MoneyTile label="Rahbar kassasi — naqd" value={d.owner.total.cash} icon={Crown} tone="amber" hint="qabul qilingan + o‘zingiz kiritgan" />
        <MoneyTile label="Rahbar kassasi — karta" value={d.owner.total.card} icon={CreditCard} tone="brand" hint="qabul qilingan + o‘zingiz kiritgan" />
        <MoneyTile label="Shu oy qabul qilindi" value={moneyTotal(d.owner.acceptedMonth)} icon={CheckCheck} tone="emerald" hint={split(d.owner.acceptedMonth)} />
        <MoneyTile label="Administratorlarda turibdi" value={moneyTotal(atAdmins)} icon={Coins} tone="orange" hint={split(atAdmins)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="order-last min-w-0 self-start xl:order-none">
          <CardHeader title="Topshiruvlar tarixi" count={d.history.length} />
          <HandoverList rows={d.history} showFrom />
        </Card>
        <Card className="self-start">
          <CardHeader title="Administratorlar kassasi" subtitle="Hali topshirilmagan pul" />
          {d.cashiers.length === 0 ? (
            <p className="border-t border-line-soft px-6 py-5 text-sm text-ink-400">Administrator hali to‘lov kiritmagan.</p>
          ) : (
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {d.cashiers.map((c) => (
                <li key={c.key} className="px-6 py-4">
                  <p className="text-[15px] font-semibold text-ink-900">{c.name}</p>
                  <dl className="num mt-2 grid grid-cols-2 gap-2 text-[13px]">
                    <Line label="Naqd" value={formatMoney(c.balance.cash)} />
                    <Line label="Karta" value={formatMoney(c.balance.card)} />
                    <Line label="Bugun" value={formatMoney(moneyTotal(c.today))} />
                    <Line label="Kutilmoqda" value={formatMoney(moneyTotal(c.pending))} />
                  </dl>
                  {moneyTotal(c.available) > 0 ? (
                    <ConfirmAction
                      action={acceptCashierBalance.bind(null, c.key)}
                      confirmText={`${c.name} kassasidagi pul (naqd ${formatMoney(Math.max(0, c.available.cash))}, karta ${formatMoney(Math.max(0, c.available.card))}) sizga berildimi? Topshiruvsiz qabul qilinadi.`}
                      className={cx(btn.sm, "mt-3 w-full")}
                      pendingText="…"
                    >
                      <CheckCheck className="size-4" aria-hidden />
                      Qo‘lda qabul qilish
                    </ConfirmAction>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line-soft px-6 py-3 text-xs leading-relaxed text-ink-400">
            Kassa yangi tizimdan keyin kiritilgan to‘lovlar bo‘yicha yuritiladi (oldingilari va Sheets’dan kelganlari kirmaydi). Pul qo‘lingizga
            berilgan, lekin topshirilmagan bo‘lsa (masalan, eski umumiy parol bilan kiritilganlari) — «Qo‘lda qabul qilish».
          </p>
        </Card>
      </div>
    </>
  );
}

function split(m: Money): string {
  return `naqd ${formatMoney(m.cash)} · karta ${formatMoney(m.card)}`;
}

function MoneyTile({ label, value, icon, tone, hint }: { label: string; value: number; icon: LucideIcon; tone: Tone; hint?: string }) {
  return (
    <Card className="group flex flex-col gap-3 p-5 transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-medium text-ink-600">{label}</p>
        <IconTile icon={icon} tone={tone} />
      </div>
      <p className={cx("num text-[26px] font-bold leading-none tracking-[-0.02em]", value < 0 ? "text-rose-600" : "text-ink-900")}>
        {formatMoney(value)}
      </p>
      {hint ? <p className="num text-xs text-ink-400">{hint}</p> : null}
    </Card>
  );
}

function Amounts({ cash, card }: { cash: number; card: number }) {
  return (
    <span className="num flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
        <Banknote className="size-3.5" aria-hidden />
        {formatMoney(cash)}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
        <CreditCard className="size-3.5" aria-hidden />
        {formatMoney(card)}
      </span>
    </span>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <dt className="text-[11px] text-ink-400">{label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

const STATUS: Record<HandoverRow["status"], { label: string; tone: "amber" | "emerald" | "rose" }> = {
  pending: { label: "qabul kutilmoqda", tone: "amber" },
  accepted: { label: "qabul qilindi", tone: "emerald" },
  rejected: { label: "rad etildi", tone: "rose" },
};

function HandoverList({ rows, showFrom }: { rows: HandoverRow[]; showFrom: boolean }) {
  if (!rows.length) {
    return (
      <div className="border-t border-line-soft">
        <EmptyState title="Hali topshiruv yo‘q" icon={Coins} tone="orange">
          {showFrom ? "Administrator kun oxirida pulni topshirganda shu yerda ko‘rinadi." : "Kassangizdagi pulni o‘ngdagi forma orqali rahbarga topshiring."}
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="scroll-thin max-h-[640px] divide-y divide-line-soft overflow-y-auto border-t border-line-soft">
      {rows.map((h) => (
        <li key={h.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3.5">
          <div className="min-w-[200px] flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink-900">
              {showFrom ? h.fromName : formatMoney(h.cash + h.card)}
              <Tag tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Tag>
            </p>
            <p className="num mt-0.5 text-[13px] text-ink-500">
              {formatDateTime(h.createdAt)}
              {h.decidedAt ? ` · ${h.status === "accepted" ? "qabul" : "rad"}: ${formatDateTime(h.decidedAt)}${h.decidedByName ? ` (${h.decidedByName})` : ""}` : ""}
              {h.note ? ` · ${h.note}` : ""}
            </p>
          </div>
          <Amounts cash={h.cash} card={h.card} />
        </li>
      ))}
    </ul>
  );
}
