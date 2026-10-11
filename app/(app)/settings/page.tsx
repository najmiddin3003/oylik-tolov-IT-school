import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  BadgePercent,
  Building2,
  CircleCheck,
  CircleSlash,
  FileSpreadsheet,
  HandCoins,
  KeyRound,
  MessageSquareText,
  PiggyBank,
  Tags,
  Trash2,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { deleteSalary, disableAdmin } from "@/app/actions/settings";
import {
  AdminPasswordForm,
  CenterNameForm,
  FeeForm,
  OwnerPasswordForm,
  PercentForm,
  SalaryForm,
  SmsForm,
  TestSmsButton,
} from "@/components/SettingsForms";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, cx, IconTile, PageHeader, PageSkeleton, Tag, type Tone } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { getSettingsPageData } from "@/lib/data";
import { formatUzPhone } from "@/lib/eskiz";
import { currentMonth, formatDate, formatDateTime, formatMoney, isValidMonth, monthLabel, todayISO } from "@/lib/time";

export const metadata: Metadata = { title: "Sozlamalar" };

const SECTIONS: { id: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { id: "oylik", label: "Oylik va avans", icon: PiggyBank, tone: "emerald" },
  { id: "narx", label: "Oylik to‘lov narxi", icon: Tags, tone: "violet" },
  { id: "foiz", label: "Tushum ulushi", icon: BadgePercent, tone: "brand" },
  { id: "parollar", label: "Parollar", icon: KeyRound, tone: "amber" },
  { id: "sms", label: "SMS eslatma", icon: MessageSquareText, tone: "sky" },
  { id: "umumiy", label: "Umumiy", icon: Building2, tone: "slate" },
];

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  await ownerGuard();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const d = await getSettingsPageData(month);
  const { share } = d;

  return (
    <>
      <PageHeader
        eyebrow="Boshqaruv"
        title="Sozlamalar"
        subtitle="Oylik va avanslar, oylik to‘lov narxi, ulush foizi, parollar va SMS eslatma."
      />

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden xl:block" aria-label="Sozlamalar bo‘limlari">
          <ul className="sticky top-24 grid gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2 text-[15px] font-medium text-ink-600 transition hover:bg-white hover:text-ink-900 hover:shadow-card">
                  <IconTile icon={s.icon} tone={s.tone} size="sm" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid min-w-0 gap-6">
          {/* ---------- Oylik va avans ---------- */}
          <Section id="oylik" icon={PiggyBank} tone="emerald" title="Oylik va avanslar" subtitle={`${monthLabel(month)}: tushum ulushidan olingan summalar avtomatik ayiriladi. Oyni yuqoridagi oy tanlagichdan o‘zgartiring.`}>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Figure label="Tushgan summa" value={formatMoney(d.collected)} />
              <Figure label={`Tushumning ${share.percent}%`} value={formatMoney(share.share)} tone="brand" />
              <Figure label="Olindi (oylik/avans)" value={`− ${formatMoney(share.taken)}`} tone="amber" />
              <Figure label="Qoldi" value={formatMoney(share.left)} tone={share.left < 0 ? "rose" : "emerald"} strong />
            </div>

            <SalaryForm month={month} today={todayISO()} />

            <div className="mt-6 overflow-hidden rounded-2xl border border-line">
              <p className="flex items-center justify-between gap-3 border-b border-line-soft bg-slate-50/70 px-4 py-2.5 text-sm font-semibold text-ink-700">
                {monthLabel(month)} uchun olinganlar
                <span className="num text-ink-500">{share.salaries.length} ta</span>
              </p>
              {share.salaries.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink-400">Bu oy uchun hali oylik yoki avans yozilmagan.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {share.salaries.map((s) => (
                    <li key={s.id} className="group flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                      <IconTile icon={s.kind === "oylik" ? Wallet : HandCoins} tone={s.kind === "oylik" ? "emerald" : "orange"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-ink-900">
                          {s.kind === "oylik" ? "Oylik" : "Avans"} <span className="num ml-1 text-ink-900">{formatMoney(s.amount)}</span>
                        </p>
                        <p className="num text-[13px] text-ink-500">
                          {formatDate(s.date)} da olindi{s.note ? ` · ${s.note}` : ""}
                        </p>
                      </div>
                      <ConfirmAction
                        action={deleteSalary.bind(null, s.id)}
                        confirmText={`${s.kind === "oylik" ? "Oylik" : "Avans"} ${formatMoney(s.amount)} yozuvi o‘chirilsinmi?`}
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
          </Section>

          {/* ---------- Oylik to'lov narxi ---------- */}
          <Section
            id="narx"
            icon={Tags}
            tone="violet"
            title="Oylik to‘lov narxi"
            subtitle="Yangi narx tanlangan oydan boshlab qo‘llanadi. O‘tgan oylar hisobi (qarz va to‘lovlar) o‘zgarmaydi."
          >
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-500">Hozir ({monthLabel(currentMonth())}):</span>
              {d.feeGroups.length ? (
                d.feeGroups.map((g) => (
                  <span key={g.fee} className="num inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 font-medium text-violet-800 ring-1 ring-inset ring-violet-100">
                    {formatMoney(g.fee)} <span className="text-violet-500">· {g.count} ta o‘quvchi</span>
                  </span>
                ))
              ) : (
                <span className="text-ink-400">faol o‘quvchi yo‘q</span>
              )}
            </div>
            {d.standardNow !== null ? (
              <p className="num -mt-2 mb-5 text-sm text-ink-500">
                Yangi o‘quvchilar uchun standart narx: <b className="font-semibold text-ink-800">{formatMoney(d.standardNow)}</b>
                {d.standardNext.map((c) => (
                  <span key={c.from}>
                    {" "}
                    · {monthLabel(c.from)} dan <b className="font-semibold text-ink-800">{formatMoney(c.fee)}</b>
                  </span>
                ))}
              </p>
            ) : null}
            <FeeForm month={currentMonth()} groups={d.feeGroups} />
            {d.feeChanges.length ? (
              <History title="Narx o‘zgarishlari">
                {d.feeChanges.map((c, i) => (
                  <li key={`${c.from}-${c.at}-${i}`} className="num flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="text-ink-800">
                      {monthLabel(c.from)} dan — <b className="font-semibold">{formatMoney(c.fee)}</b>
                    </span>
                    <span className="text-xs text-ink-400">
                      {c.count} ta o‘quvchi · {c.at ? formatDateTime(c.at) : ""}
                    </span>
                  </li>
                ))}
              </History>
            ) : null}
          </Section>

          {/* ---------- Ulush foizi ---------- */}
          <Section
            id="foiz"
            icon={BadgePercent}
            tone="brand"
            title="Tushum ulushi"
            subtitle={`Hozir: tushumning ${d.percentNow}%. O‘zgartirilsa — tanlangan oydan boshlab hisoblanadi.`}
          >
            <PercentForm month={currentMonth()} current={d.percentNow} />
            {d.shareHistory.length ? (
              <History title="Foiz tarixi">
                {d.shareHistory.map((h) => (
                  <li key={h.from} className="num flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="text-ink-800">{monthLabel(h.from)} dan</span>
                    <b className="font-semibold text-ink-900">{h.percent}%</b>
                  </li>
                ))}
              </History>
            ) : null}
          </Section>

          {/* ---------- Parollar ---------- */}
          <section id="parollar" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <SectionTitle icon={KeyRound} tone="amber" title="Sizning parolingiz" subtitle="Rahbar paroli — hamma bo‘limlarga kirish." />
              <OwnerPasswordForm />
              {!d.ownerPasswordInDb ? (
                <p className="mt-4 text-xs leading-relaxed text-ink-400">Hozir .env dagi ADMIN_PASSWORD ishlatilmoqda. Almashtirsangiz, yangi parol bazada shifrlangan holda saqlanadi.</p>
              ) : null}
            </Card>
            <Card className="p-6">
              <SectionTitle
                icon={UserCog}
                tone="sky"
                title="Administrator (opa) paroli"
                subtitle="Bu parol bilan kirgan kishi faqat «To‘lovlar» sahifasini ko‘radi: to‘lov kiritadi, o‘chiradi va qarzdorlarni ko‘radi."
                right={d.adminEnabled ? <Tag tone="emerald">o‘rnatilgan</Tag> : <Tag>o‘rnatilmagan</Tag>}
              />
              <AdminPasswordForm enabled={d.adminEnabled} />
              {d.adminEnabled ? (
                <ConfirmAction
                  action={disableAdmin}
                  confirmText="Administrator kirishi o‘chirilsinmi? Opa endi tizimga kira olmaydi (keyin yangi parol o‘rnatsangiz — yana kira oladi)."
                  className={cx(btn.danger, "mt-4 h-10")}
                  pendingText="…"
                >
                  <CircleSlash className="size-4" aria-hidden />
                  Kirishni o‘chirish
                </ConfirmAction>
              ) : null}
            </Card>
          </section>

          {/* ---------- SMS ---------- */}
          <Section
            id="sms"
            icon={MessageSquareText}
            tone="sky"
            title="SMS eslatma (Eskiz)"
            subtitle={`Qarzdorlar soni har kuni kechqurun ${formatUzPhone(d.sms.phone)} raqamiga yuboriladi.`}
            right={
              d.eskizReady ? (
                <Tag tone="emerald">
                  <CircleCheck className="size-3.5" aria-hidden /> Eskiz ulangan
                </Tag>
              ) : (
                <Tag tone="amber">Eskiz kalitlari kiritilmagan</Tag>
              )
            }
          >
            {!d.eskizReady ? (
              <div className="mb-5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900">
                Vercel → Project → Settings → Environment Variables bo‘limiga <code className="rounded bg-white/70 px-1">ESKIZ_EMAIL</code> va{" "}
                <code className="rounded bg-white/70 px-1">ESKIZ_PASSWORD</code> (Eskiz kabinetidagi email va maxfiy kalit) ni kiriting, keyin saytni qayta deploy qiling.
              </div>
            ) : null}
            <SmsForm sms={d.sms} month={currentMonth()} />
            <div className="mt-6 grid gap-4 border-t border-line-soft pt-5">
              <div>
                <p className="text-sm font-semibold text-ink-800">Sinab ko‘rish</p>
                <p className="mt-0.5 text-sm text-ink-500">Hozirgi holat bo‘yicha bitta SMS yuboriladi. Eskiz SMS matnini tasdiqlagan (moderatsiyadan o‘tgan) bo‘lishi kerak.</p>
              </div>
              <TestSmsButton disabled={!d.eskizReady} />
              {d.smsLogs.length ? (
                <History title="Oxirgi SMS’lar">
                  {d.smsLogs.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="num text-ink-500">{l.at ? formatDateTime(l.at) : l.day}</span>
                        <span className="ml-2 text-xs text-ink-400">{l.trigger === "test" ? "sinov" : "kunlik"}</span>
                        <span className="mt-0.5 block text-ink-800">{l.status === "sent" ? l.text : l.error || "—"}</span>
                      </span>
                      {l.status === "sent" ? <Tag tone="emerald">yuborildi</Tag> : l.status === "failed" ? <Tag tone="rose">xato</Tag> : <Tag>yuborilmadi</Tag>}
                    </li>
                  ))}
                </History>
              ) : null}
            </div>
          </Section>

          {/* ---------- Umumiy ---------- */}
          <Section id="umumiy" icon={Building2} tone="slate" title="Umumiy" subtitle="Markaz nomi va boshqa sozlamalar.">
            <CenterNameForm value={d.centerName} />
            <Link href="/sync#sozlamalar" className="group mt-6 flex items-center gap-3 rounded-2xl border border-line p-4 transition hover:bg-slate-50/70">
              <IconTile icon={FileSpreadsheet} tone="teal" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink-900">Google Sheets sozlamalari</span>
                <span className="block text-sm text-ink-500">Jadval havolasi, kurs filtri va ustun nomlari</span>
              </span>
            </Link>
          </Section>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon, tone, title, subtitle, right }: { icon: LucideIcon; tone: Tone; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="group mb-6 flex flex-wrap items-start gap-3.5">
      <IconTile icon={icon} tone={tone} variant="solid" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

function Section({
  id,
  icon,
  tone,
  title,
  subtitle,
  right,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 p-6">
      <SectionTitle icon={icon} tone={tone} title={title} subtitle={subtitle} right={right} />
      {children}
    </Card>
  );
}

function Figure({ label, value, tone = "slate", strong }: { label: string; value: string; tone?: "slate" | "brand" | "amber" | "emerald" | "rose"; strong?: boolean }) {
  const tones = {
    slate: "bg-slate-50 text-ink-900 ring-line",
    brand: "bg-brand-50/70 text-brand-800 ring-brand-100",
    amber: "bg-amber-50/70 text-amber-800 ring-amber-100",
    emerald: "bg-emerald-50/70 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50/70 text-rose-700 ring-rose-100",
  };
  return (
    <div className={cx("rounded-2xl px-4 py-3 ring-1 ring-inset", tones[tone])}>
      <p className="text-[13px] opacity-80">{label}</p>
      <p className={cx("num mt-1 text-[19px] tracking-[-0.01em]", strong ? "font-bold" : "font-semibold")}>{value}</p>
    </div>
  );
}

function History({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line">
      <p className="border-b border-line-soft bg-slate-50/70 px-4 py-2.5 text-sm font-semibold text-ink-700">{title}</p>
      <ul className="divide-y divide-line-soft">{children}</ul>
    </div>
  );
}
