import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Gauge } from "lucide-react";
import { Card, cx, EmptyState, PageHeader, PageSkeleton, Tag, td, th } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { perfSummary } from "@/lib/perf-report";
import { formatMs, perfTone, type PerfKind, type PerfStats } from "@/lib/perf-rules";
import { ROLES, type Role } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/staff-rules";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Tezlik" };

const PERIODS = [
  { days: 1, label: "24 soat" },
  { days: 7, label: "7 kun" },
  { days: 30, label: "30 kun" },
];

const KIND_LABEL: Record<PerfKind, string> = { server: "Serverda", load: "Birinchi ochilish", nav: "Sahifaga o‘tish" };

export default function SpeedPage({ searchParams }: PageProps<"/tezlik">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Speed searchParams={searchParams} />
    </Suspense>
  );
}

async function Speed({ searchParams }: { searchParams: PageProps<"/tezlik">["searchParams"] }) {
  await ownerGuard();
  const sp = await searchParams;
  const days = PERIODS.some((p) => String(p.days) === sp.days) ? Number(sp.days) : 7;
  const role = typeof sp.role === "string" && (ROLES as readonly string[]).includes(sp.role) ? (sp.role as Role) : null;
  const { rows, slowest, total } = await perfSummary(days, role);
  const href = (d: number, r: Role | null) => `/tezlik?${new URLSearchParams({ ...(d !== 7 ? { days: String(d) } : {}), ...(r ? { role: r } : {}) })}`;

  return (
    <>
      <PageHeader
        eyebrow="Sayt holati"
        title="Tezlik"
        subtitle="Sahifalar foydalanuvchilarda qancha vaqtda ochilayotgani. Har ochilishda o‘zi yoziladi va 30 kun saqlanadi."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented items={PERIODS.map((p) => ({ key: String(p.days), label: p.label, href: href(p.days, role), active: p.days === days }))} label="Davr" />
        <Segmented
          items={[
            { key: "all", label: "Hammasi", href: href(days, null), active: !role },
            ...ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r], href: href(days, r), active: role === r })),
          ]}
          label="Kim ochgan"
        />
        <span className="num text-[13px] text-ink-400">{total} ta o‘lchov</span>
      </div>

      <Card className="mb-6 p-5 sm:p-6">
        <dl className="grid gap-4 text-sm leading-relaxed text-ink-600 md:grid-cols-3">
          <div>
            <dt className="font-semibold text-ink-900">Sahifaga o‘tish</dt>
            <dd>Menyu, havola yoki filtr bosilgandan sahifa mazmuni ekranga chiqquncha. Foydalanuvchi eng ko‘p shuni kutadi.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-900">Birinchi ochilish</dt>
            <dd>Sayt brauzerda yangidan ochilgandan (havola yoki yangilash) sahifa ishlatsa bo‘ladigan bo‘lguncha.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-900">Serverda</dt>
            <dd>Server sahifani bazadan o‘qib tayyorlagan vaqt. Internet tezligiga bog‘liq emas — sekin bo‘lsa, kodni tezlashtirish kerak.</dd>
          </div>
        </dl>
        <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4 text-[13px] text-ink-500">
          Mediana — ochilishlarning yarmi shundan tez; 90% — ochilishlarning 90 foizi shundan tez.
          <Tag tone="emerald">1 s gacha — tez</Tag>
          <Tag tone="amber">2,5 s gacha — o‘rtacha</Tag>
          <Tag tone="rose">undan ko‘p — sekin</Tag>
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="Hali o‘lchov yo‘q" icon={Gauge} tone="sky">
            Sahifalar ochilgan sari shu yerda paydo bo‘ladi. Bir-ikki kundan keyin qarab ko‘ring.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className={th}>Sahifa</th>
                    <th className={`${th} text-right`}>Ochilishlar</th>
                    <th className={th}>{KIND_LABEL.nav}</th>
                    <th className={th}>{KIND_LABEL.load}</th>
                    <th className={th}>{KIND_LABEL.server}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((r) => (
                    <tr key={r.route}>
                      <td className={td}>
                        <p className="font-medium text-ink-900">{r.label}</p>
                        <p className="num text-[13px] text-ink-400">{r.route}</p>
                      </td>
                      <td className={`${td} num text-right`}>{r.views}</td>
                      <td className={td}>
                        <StatsCell s={r.nav} />
                      </td>
                      <td className={td}>
                        <StatsCell s={r.load} />
                      </td>
                      <td className={td}>
                        <StatsCell s={r.server} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {slowest.length ? (
            <Card className="overflow-hidden">
              <div className="border-b border-line-soft px-5 py-4 sm:px-6">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Eng sekin ochilishlar</h2>
                <p className="mt-0.5 text-sm text-ink-500">Shu davrdagi eng uzoq kutilgan 10 ta ochilish (brauzer o‘lchovi).</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className={th}>Sahifa</th>
                      <th className={th}>Turi</th>
                      <th className={`${th} text-right`}>Vaqt</th>
                      <th className={th}>Kim</th>
                      <th className={th}>Qachon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {slowest.map((x, i) => (
                      <tr key={i}>
                        <td className={cx(td, "font-medium text-ink-900")}>{x.label}</td>
                        <td className={td}>{KIND_LABEL[x.kind]}</td>
                        <td className={`${td} text-right`}>
                          <Tag tone={perfTone(x.ms)}>{formatMs(x.ms)}</Tag>
                        </td>
                        <td className={td}>{ROLE_LABEL[x.role]}</td>
                        <td className={`${td} num whitespace-nowrap`}>{formatDateTime(x.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

function StatsCell({ s }: { s: PerfStats | null }) {
  if (!s) return <span className="text-ink-300">—</span>;
  return (
    <div className="num whitespace-nowrap">
      <Tag tone={perfTone(s.median)}>{formatMs(s.median)}</Tag>
      <p className="mt-1 text-[13px] text-ink-400">
        90%: {formatMs(s.p90)} · {s.n} ta
      </p>
    </div>
  );
}

function Segmented({ items, label }: { items: { key: string; label: string; href: string; active: boolean }[]; label: string }) {
  return (
    <nav className="flex rounded-xl bg-slate-100 p-1 text-[13px] font-semibold" aria-label={label}>
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          scroll={false}
          aria-current={it.active ? "page" : undefined}
          className={cx("rounded-lg px-3 py-1.5 transition", it.active ? "bg-surface text-ink-900 shadow-card" : "text-ink-500 hover:text-ink-800")}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
