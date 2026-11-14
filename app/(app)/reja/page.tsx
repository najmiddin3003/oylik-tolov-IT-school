import type { Metadata } from "next";
import { Suspense } from "react";
import { ChevronDown, Clock3, Lightbulb, Rocket } from "lucide-react";
import { Card, IconTile, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { ROADMAP, type RoadmapStatus } from "@/lib/roadmap";

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

  return (
    <>
      <PageHeader
        eyebrow="Rahbar uchun"
        title="Reja va yangiliklar"
        subtitle="Saytda kelgusida qilinadigan ishlar. Mavzuni bossangiz — to‘liq ma’lumot ochiladi."
      />

      <div className="max-w-3xl">
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

      </div>
    </>
  );
}
