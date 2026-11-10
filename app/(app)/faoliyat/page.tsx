import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { ActivityList } from "@/components/ActivityList";
import { btn, Card, cx, PageHeader, PageSkeleton } from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import { ACTIVITY_GROUPS, type ActivityGroup } from "@/lib/activity-rules";
import { getMyActivity } from "@/lib/data";
import type { Role } from "@/lib/session";

export const metadata: Metadata = { title: "Faoliyat tarixi" };

const PAGE = 60;

/** Rolga qarab ma'noli guruhlar (masalan, o'qituvchida to'lov kiritish yo'q). */
const GROUPS_FOR: Record<Role, ActivityGroup[]> = {
  owner: ACTIVITY_GROUPS.map((g) => g.key),
  admin: ["auth", "payment", "student", "attendance", "task", "salary", "export"],
  teacher: ["auth", "attendance", "salary", "export"],
};

export default function ActivityPage({ searchParams }: PageProps<"/faoliyat">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ActivityView searchParams={searchParams} />
    </Suspense>
  );
}

async function ActivityView({ searchParams }: { searchParams: PageProps<"/faoliyat">["searchParams"] }) {
  const { role, name } = await pageGuard();
  const sp = await searchParams;
  const allowed = GROUPS_FOR[role];
  const group = typeof sp.tur === "string" && (allowed as string[]).includes(sp.tur) ? (sp.tur as ActivityGroup) : "";
  const before = typeof sp.oldin === "string" ? sp.oldin : "";
  const rows = await getMyActivity({ group, before, limit: PAGE });
  const href = (extra: Record<string, string>) => `/faoliyat?${new URLSearchParams({ ...(group ? { tur: group } : {}), ...extra })}`;

  return (
    <>
      <PageHeader
        eyebrow="Profil"
        title="Faoliyat tarixi"
        subtitle={`${name ?? "Siz"}: tizimga kirishlaringiz va qilgan amallaringiz — vaqti, qurilmasi bilan.`}
      />

      <p className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
        <ShieldCheck className="size-[18px] shrink-0 text-emerald-600" aria-hidden />
        Bu yozuvlarni faqat siz ko‘rasiz. Har bir xodim faqat o‘z amallarini ko‘radi.
      </p>

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Amal turi">
        {[{ key: "", label: "Hammasi" }, ...ACTIVITY_GROUPS.filter((g) => allowed.includes(g.key))].map((g) => (
          <Link
            key={g.key || "all"}
            href={`/faoliyat${g.key ? `?tur=${g.key}` : ""}`}
            aria-current={g.key === group ? "page" : undefined}
            className={cx(
              "inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition",
              g.key === group ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-600 ring-line hover:bg-slate-50",
            )}
          >
            {g.label}
          </Link>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <ActivityList rows={rows} />
        {rows.length === PAGE ? (
          <div className="mt-6 flex justify-center border-t border-line-soft pt-5">
            <Link href={href({ oldin: rows[rows.length - 1].at })} className={cx(btn.outline, "h-10")} scroll={false}>
              <ChevronDown className="size-4" aria-hidden />
              Oldingilarini ko‘rsatish
            </Link>
          </div>
        ) : before ? (
          <div className="mt-6 flex justify-center border-t border-line-soft pt-5">
            <Link href={href({})} className={cx(btn.outline, "h-10")}>
              Eng yangilariga qaytish
            </Link>
          </div>
        ) : null}
      </Card>
    </>
  );
}
