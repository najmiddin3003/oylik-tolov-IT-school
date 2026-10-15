import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck2, CheckCircle2, ChevronDown, Clock3, Lightbulb, Rocket } from "lucide-react";
import { Card, cx, IconTile, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { DONE, ROADMAP, type RoadmapStatus } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Reja va yangiliklar" };

const STATUS: Record<RoadmapStatus, { label: string; tone: "brand" | "amber" | "emerald" }> = {
  rejada: { label: "Rejada", tone: "brand" },
  muhokamada: { label: "Muhokamada", tone: "amber" },
  jarayonda: { label: "Jarayonda", tone: "emerald" },
};

export default function RoadmapPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Roadmap />
    </Suspense>
  );
}

async function Roadmap() {
  await ownerGuard();
  const doneCount = DONE.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader
        eyebrow="Rahbar uchun"
        title="Reja va yangiliklar"
        subtitle="Saytda kelgusida qilinadigan ishlar va shu paytgacha qilinganlari. Mavzuni bossangiz — to‘liq ma’lumot ochiladi."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="plan-title" className="min-w-0">
          <div className="group mb-4 flex items-center gap-3.5">
            <IconTile icon={Rocket} tone="brand" variant="solid" />
            <div>
              <h2 id="plan-title" className="text-[19px] font-semibold tracking-[-0.01em] text-ink-900">
                Kelgusida qilinadigan ishlar
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">{ROADMAP.length} ta mavzu · sinov rejimida</p>
            </div>
          </div>
          <div className="grid gap-3">
            {ROADMAP.map((item, i) => (
              <Card key={item.id} className="overflow-hidden">
                <details className="accordion group/acc" open={i === 0}>
                  <summary className="flex cursor-pointer items-start gap-3.5 px-5 py-4 transition hover:bg-slate-50/60 sm:px-6">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                      <Lightbulb className="size-[17px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-ink-900">{item.title}</span>
                        <Tag tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Tag>
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-500">{item.summary}</span>
                    </span>
                    <ChevronDown className="accordion-chevron mt-1.5 size-[18px] shrink-0 text-ink-400" aria-hidden />
                  </summary>
                  <div className="border-t border-line-soft px-5 pb-5 pt-4 sm:px-6">
                    <ul className="grid gap-2 text-sm leading-relaxed text-ink-700">
                      {item.details.map((d) => (
                        <li key={d} className="flex gap-2.5">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                          {d}
                        </li>
                      ))}
                    </ul>
                    {item.when ? (
                      <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-ink-500">
                        <Clock3 className="size-3.5" aria-hidden />
                        Taxminiy muddat: {item.when}
                      </p>
                    ) : null}
                  </div>
                </details>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="done-title" className="min-w-0">
          <div className="group mb-4 flex items-center gap-3.5">
            <IconTile icon={CalendarCheck2} tone="emerald" variant="solid" />
            <div>
              <h2 id="done-title" className="text-[19px] font-semibold tracking-[-0.01em] text-ink-900">
                Shu paytgacha qilingan ishlar
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">
                {DONE.length} ta bosqich · {doneCount} ta imkoniyat
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {DONE.map((g, i) => (
              <Card key={g.id} className="overflow-hidden">
                <details className="accordion" open={i === 0}>
                  <summary className="flex cursor-pointer items-start gap-3.5 px-5 py-4 transition hover:bg-slate-50/60 sm:px-6">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                      <CheckCircle2 className="size-[17px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink-900">{g.title}</span>
                      <span className="num mt-1 block text-sm text-ink-500">
                        {g.date} · {g.items.length} ta imkoniyat
                      </span>
                    </span>
                    <ChevronDown className="accordion-chevron mt-1.5 size-[18px] shrink-0 text-ink-400" aria-hidden />
                  </summary>
                  <div className="grid gap-2 border-t border-line-soft px-4 pb-4 pt-3 sm:px-5">
                    {g.items.map((it) => (
                      <details key={it.title} className="accordion rounded-xl border border-line-soft">
                        <summary className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-slate-50/70">
                          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                          <span className="min-w-0 flex-1">{it.title}</span>
                          <ChevronDown className="accordion-chevron size-4 shrink-0 text-ink-400" aria-hidden />
                        </summary>
                        <ul className={cx("grid gap-1.5 px-3.5 pb-3 pt-0.5 text-sm leading-relaxed text-ink-600")}>
                          {it.details.map((d) => (
                            <li key={d} className="flex gap-2">
                              <span className="text-ink-300" aria-hidden>
                                —
                              </span>
                              {d}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                </details>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
