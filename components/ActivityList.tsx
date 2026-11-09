// Faoliyat jurnali ro'yxati: kunlar bo'yicha guruh, har amal — vaqti, turi (ikonka) va tavsifi.
import {
  BookOpen,
  ClipboardList,
  FileSpreadsheet,
  FileDown,
  HandCoins,
  LogIn,
  LogOut,
  Settings2,
  UserPlus,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ActivityRow } from "@/lib/activity";
import { activityGroup, type ActivityGroup } from "@/lib/activity-rules";
import { dayLabel } from "@/lib/reminders";
import { dateToISO, todayISO } from "@/lib/time";
import { cx, EmptyState, IconTile, type Tone } from "./ui";

const GROUP_STYLE: Record<ActivityGroup, { icon: LucideIcon; tone: Tone }> = {
  auth: { icon: LogIn, tone: "slate" },
  payment: { icon: Wallet, tone: "emerald" },
  student: { icon: UserPlus, tone: "violet" },
  staff: { icon: UsersRound, tone: "sky" },
  salary: { icon: HandCoins, tone: "orange" },
  task: { icon: ClipboardList, tone: "brand" },
  settings: { icon: Settings2, tone: "amber" },
  sync: { icon: FileSpreadsheet, tone: "teal" },
  export: { icon: FileDown, tone: "emerald" },
};

function styleOf(action: string) {
  if (action === "logout") return { icon: LogOut, tone: "slate" as Tone };
  if (action === "settings.courses") return { icon: BookOpen, tone: "emerald" as Tone };
  return GROUP_STYLE[activityGroup(action)];
}

function timeOf(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function ActivityList({ rows, compact = false }: { rows: ActivityRow[]; compact?: boolean }) {
  if (!rows.length) {
    return compact ? (
      <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-ink-400">Hali amal yozilmagan. Tizimga kirishlar va qilgan ishlaringiz shu yerda ko‘rinadi.</p>
    ) : (
      <EmptyState title="Hali amal yozilmagan" icon={ClipboardList} tone="brand">
        Tizimga kirishlar va qilgan ishlaringiz (to‘lov, o‘quvchi, sozlama…) shu yerda ko‘rinadi.
      </EmptyState>
    );
  }
  const groups: { day: string; rows: ActivityRow[] }[] = [];
  for (const r of rows) {
    const day = dateToISO(new Date(r.at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else groups.push({ day, rows: [r] });
  }
  const today = todayISO();
  return (
    <div className={cx("grid", compact ? "gap-4" : "gap-6")}>
      {groups.map((g) => (
        <section key={g.day} aria-label={dayLabel(g.day)}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 first-letter:uppercase">
            {dayLabel(g.day)}
            {g.day === today ? <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-normal text-emerald-700 normal-case">bugun</span> : null}
          </h3>
          <ol className="relative grid gap-1 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-line">
            {g.rows.map((r) => {
              const st = styleOf(r.action);
              return (
                <li key={r.id} className="group relative flex items-start gap-3 rounded-xl py-1.5 pr-2">
                  <span className="relative z-[1] rounded-[12px] bg-surface p-0.5">
                    <IconTile icon={st.icon} tone={st.tone} size="sm" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm leading-snug text-ink-800">{r.text}</p>
                    {!compact && (r.device || r.ip) ? (
                      <p className="num mt-0.5 truncate text-xs text-ink-400">{[r.device, r.ip].filter(Boolean).join(" · ")}</p>
                    ) : null}
                  </div>
                  <time dateTime={r.at} className="num shrink-0 pt-0.5 text-xs font-medium text-ink-400">
                    {timeOf(r.at)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
