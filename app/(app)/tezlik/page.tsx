import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Gauge } from "lucide-react";
import { Card, cx, EmptyState, PageHeader, PageSkeleton, Tag, td, th } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { perfSummary, type ColdStats, type PerfSplit } from "@/lib/perf-report";
import { formatMs, PERF_PERIODS, perfTone, type PerfKind, type PerfStats } from "@/lib/perf-rules";
import { ROLES, type Role } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/staff-rules";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Tezlik" };

const DEFAULT_PERIOD = "24h";

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
  const period = PERF_PERIODS.find((p) => p.key === sp.p) ?? PERF_PERIODS.find((p) => p.key === DEFAULT_PERIOD)!;
  const role = typeof sp.role === "string" && (ROLES as readonly string[]).includes(sp.role) ? (sp.role as Role) : null;
  const { rows, slowest, overall, total } = await perfSummary(period.hours, role);
  const href = (p: string, r: Role | null) => `/tezlik?${new URLSearchParams({ ...(p !== DEFAULT_PERIOD ? { p } : {}), ...(r ? { role: r } : {}) })}`;

  return (
    <>
      <PageHeader
        eyebrow="Sayt holati"
        title="Tezlik"
        subtitle="Sahifalar foydalanuvchilarda qancha vaqtda ochilayotgani. Har ochilishda o‘zi yoziladi va 30 kun saqlanadi."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented items={PERF_PERIODS.map((p) => ({ key: p.key, label: p.label, href: href(p.key, role), active: p.key === period.key }))} label="Davr" />
        <Segmented
          items={[
            { key: "all", label: "Hammasi", href: href(period.key, null), active: !role },
            ...ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r], href: href(period.key, r), active: role === r })),
          ]}
          label="Kim ochgan"
        />
        <span className="num text-[13px] text-ink-400">{total} ta o‘lchov</span>
      </div>

      {overall.nav ? <WhereTimeGoes nav={overall.nav} split={overall.navSplit} server={overall.server} cold={overall.cold} /> : null}

      <Card className="mb-6 p-5 sm:p-6">
        <dl className="grid gap-4 text-sm leading-relaxed text-ink-600 md:grid-cols-3">
          <div>
            <dt className="font-semibold text-ink-900">Sahifaga o‘tish</dt>
            <dd>
              Menyu, havola yoki filtr bosilgandan sahifa mazmuni ekranga chiqquncha. Ikkiga bo‘linadi: <b className="font-semibold">kutish</b> — server
              ma’lumoti to‘liq kelguncha (tarmoq, server uyg‘onishi va serverda ishlash), <b className="font-semibold">chizish</b> — undan keyin brauzer
              sahifani ekranga chiqarguncha.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-900">Birinchi ochilish</dt>
            <dd>Sayt brauzerda yangidan ochilgandan (havola yoki yangilash) sahifa ishlatsa bo‘ladigan bo‘lguncha. «Javob» — serverdan birinchi javob kelgan payt.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-900">Serverda</dt>
            <dd>
              Server sahifani bazadan o‘qib tayyorlagan vaqt. «Uyg‘ondi» — ishlamay turgan server yangidan ishga tushib javob bergan so‘rovlar: foydalanuvchi
              shu vaqtni qo‘shimcha kutadi.
            </dd>
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
            Sahifalar ochilgan sari shu yerda paydo bo‘ladi. Davrni kattaroq tanlab ko‘ring yoki bir oz kuting.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px]">
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
                        <StatsCell s={r.nav}>
                          {r.navSplit?.wait != null && r.navSplit.render != null
                            ? `kutish ${formatMs(r.navSplit.wait)} · chizish ${formatMs(r.navSplit.render)}`
                            : null}
                        </StatsCell>
                      </td>
                      <td className={td}>
                        <StatsCell s={r.load}>{r.loadSplit?.ttfb != null ? `javob ${formatMs(r.loadSplit.ttfb)}` : null}</StatsCell>
                      </td>
                      <td className={td}>
                        <StatsCell s={r.server}>{r.cold.cold ? `uyg‘ondi: ${r.cold.cold} marta${r.cold.boot != null ? ` (~${formatMs(r.cold.boot)})` : ""}` : null}</StatsCell>
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
                <table className="w-full min-w-[720px]">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className={th}>Sahifa</th>
                      <th className={th}>Turi</th>
                      <th className={`${th} text-right`}>Vaqt</th>
                      <th className={`${th} text-right`}>Shundan kutish</th>
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
                        <td className={`${td} num text-right`}>{x.wait != null ? formatMs(x.wait) : <span className="text-ink-300">—</span>}</td>
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

/** Butun sayt bo'yicha: sahifaga o'tishda vaqt nimaga ketyapti — kutish (tarmoq + server) yoki brauzerda chizish. */
function WhereTimeGoes({ nav, split, server, cold }: { nav: PerfStats; split: PerfSplit | null; server: PerfStats | null; cold: ColdStats }) {
  const parts = split?.wait != null && split.render != null ? { wait: split.wait, render: split.render } : null;
  const waitShare = parts && parts.wait + parts.render > 0 ? Math.round((parts.wait / (parts.wait + parts.render)) * 100) : null;
  return (
    <Card className="mb-6 p-5 sm:p-6">
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Sahifaga o‘tishda vaqt qayerga ketyapti</h2>
      <p className="num mt-0.5 text-sm text-ink-500">
        Barcha sahifalar bo‘yicha mediana{split ? ` · bo‘laklari ${split.n} ta o‘tish bo‘yicha` : ""}
      </p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Sahifaga o‘tish (jami)" value={formatMs(nav.median)} tone={perfTone(nav.median)} note={`90%: ${formatMs(nav.p90)} · ${nav.n} ta`} />
        <Figure
          label="Serverdan javob kutish"
          value={parts ? formatMs(parts.wait) : "—"}
          note={server ? `shundan serverda ishlash ~${formatMs(server.median)}` : "tarmoq + server"}
        />
        <Figure label="Brauzerda chizish" value={parts ? formatMs(parts.render) : "—"} note="javob kelgandan ekranga chiqquncha" />
        <Figure
          label="Server uyg‘onishi"
          value={`${cold.cold} marta`}
          note={cold.requests ? `${cold.requests} ta server so‘rovidan${cold.boot != null ? ` · ~${formatMs(cold.boot)} qo‘shimcha` : ""}` : "server so‘rovi yo‘q"}
        />
      </dl>
      <p className="mt-4 border-t border-line-soft pt-4 text-sm leading-relaxed text-ink-600">
        {waitShare == null
          ? "Bo‘laklar hali yozilmagan: bu o‘lchov yangi qo‘shildi. Sahifalarni yana bir bor aylanib chiqing — shu yerda vaqt nimaga ketayotgani chiqadi."
          : waitShare >= 60
            ? `Vaqtning ${waitShare}% i serverdan javob kutishga ketyapti.${server ? ` Serverning o‘zi ~${formatMs(server.median)} da ishlaydi, demak qolgani — tarmoq yo‘li va server uyg‘onishi.` : ""}`
            : waitShare <= 40
              ? `Vaqtning ${100 - waitShare}% i brauzerda chizishga ketyapti — sahifalarni yengillashtirish kerak.`
              : "Vaqt serverdan javob kutish va brauzerda chizish o‘rtasida deyarli teng bo‘lingan."}
        {split && split.newConn ? ` Yangi ulanish ${split.newConn} ta o‘tishda o‘rnatildi${split.connMs != null ? ` (~${formatMs(split.connMs)})` : ""}.` : ""}
      </p>
    </Card>
  );
}

function Figure({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "emerald" | "amber" | "rose" }) {
  const tones = { emerald: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700" };
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-line-soft">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className={cx("num mt-1 text-[20px] font-bold leading-tight", tone ? tones[tone] : "text-ink-900")}>{value}</dd>
      <dd className="num mt-1 text-[12px] leading-snug text-ink-400">{note}</dd>
    </div>
  );
}

function StatsCell({ s, children }: { s: PerfStats | null; children?: ReactNode }) {
  if (!s) return <span className="text-ink-300">—</span>;
  return (
    <div className="num whitespace-nowrap">
      <Tag tone={perfTone(s.median)}>{formatMs(s.median)}</Tag>
      <p className="mt-1 text-[13px] text-ink-400">
        90%: {formatMs(s.p90)} · {s.n} ta
      </p>
      {children ? <p className="text-[12px] text-ink-500">{children}</p> : null}
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
