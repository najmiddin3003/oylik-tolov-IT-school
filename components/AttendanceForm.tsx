"use client";

// Bitta guruh davomati: har bir o'quvchi — Keldi / Kelmadi / Sababli. «Kelmadi» va «Sababli» uchun izoh majburiy.
// Davomat dars boshlanganidan 30 daqiqa o'tib ochiladi (bugun); o'tgan kunlar uchun — istalgan vaqtda.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CheckCheck, Lock } from "lucide-react";
import { saveAttendance } from "@/app/actions/attendance";
import type { FormState } from "@/app/actions/types";
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_NOTE_MAX,
  ATTENDANCE_STATUSES,
  attendanceOpen,
  needsNote,
  validateAttendance,
  type AttendanceStatus,
} from "@/lib/attendance-rules";
import { tashkentClock } from "@/lib/schedule";
import type { Role } from "@/lib/session";
import { studentHref } from "./FollowUps";
import { Avatar, btn, cx, inputCls, studentCode } from "./ui";
import { useActionForm } from "./useActionForm";
import { useNow } from "./useNow";

type Mark = { status: AttendanceStatus | ""; note: string };

/**
 * Guruh kartasi (ochiladigan): boshlang'ich holati serverdan, keyin — foydalanuvchi qo'lida. Saqlangandan keyin guruh
 * «qilindi» bo'lsa ham yopilib qolmaydi (saqlandi xabari ko'rinib turadi).
 */
export function GroupDetails({ defaultOpen, summary, children }: { defaultOpen: boolean; summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group/d">
      {summary}
      {children}
    </details>
  );
}

const TONE: Record<AttendanceStatus, { on: string; off: string }> = {
  present: { on: "bg-emerald-600 text-white ring-emerald-600", off: "text-emerald-700 ring-emerald-200 hover:bg-emerald-50" },
  absent: { on: "bg-rose-600 text-white ring-rose-600", off: "text-rose-700 ring-rose-200 hover:bg-rose-50" },
  excused: { on: "bg-amber-500 text-white ring-amber-500", off: "text-amber-800 ring-amber-200 hover:bg-amber-50" },
};

export function AttendanceForm({
  date,
  start,
  end,
  opensAt,
  students,
  initial,
  serverNow,
  role,
}: {
  date: string;
  start: string;
  end: string;
  /** "14:30" — bugun shu vaqtdan ochiladi */
  opensAt: string;
  students: { id: string; name: string; seq: number | null }[];
  initial: Record<string, { status: AttendanceStatus; note: string }>;
  serverNow: number;
  role: Role;
}) {
  const now = useNow(serverNow);
  const open = attendanceOpen(date, start, tashkentClock(now));
  const [state, onSubmit, pending] = useActionForm<FormState>(saveAttendance, {});
  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(students.map((s) => [s.id, { status: initial[s.id]?.status ?? "", note: initial[s.id]?.note ?? "" }])),
  );
  const [local, setLocal] = useState<Record<string, string>>({});
  // Server xatolari — yangi yuborishgacha; o'zgartirilgan maydon xatosi darhol yo'qoladi
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setTouched(new Set());
  }
  const errors: Record<string, string> = { ...(state.fieldErrors ?? {}), ...local };
  for (const k of touched) if (!local[k]) delete errors[k];

  const ids = students.map((s) => s.id);
  const missing = ids.filter((id) => !marks[id]?.status).length;

  const set = (id: string, patch: Partial<Mark>) => {
    setMarks((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
    const keys = [`status_${id}`, `note_${id}`];
    setLocal((l) => {
      const next = { ...l };
      for (const k of keys) delete next[k];
      return next;
    });
    setTouched((t) => new Set([...t, ...keys]));
  };
  const allPresent = () => {
    setMarks((m) => Object.fromEntries(ids.map((id) => [id, m[id]?.status ? m[id] : { status: "present" as const, note: "" }])));
    setLocal({});
    setTouched(new Set(ids.flatMap((id) => [`status_${id}`, `note_${id}`])));
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        const errs = validateAttendance(ids, marks);
        if (Object.keys(errs).length) {
          e.preventDefault();
          setLocal(errs);
          const first = Object.keys(errs)[0];
          const el = e.currentTarget.querySelector<HTMLElement>(`[data-field="${first}"]`);
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
          if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
          return;
        }
        onSubmit(e);
      }}
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="end" value={end} />
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}

      {!open ? (
        <p className="flex items-center gap-2 border-t border-line-soft bg-slate-50/80 px-5 py-3 text-sm text-ink-600 sm:px-6">
          <Lock className="size-4 shrink-0 text-ink-400" aria-hidden />
          Davomat dars boshlanganidan 30 daqiqa o‘tib — <b className="num font-semibold text-ink-800">{opensAt}</b> da ochiladi
        </p>
      ) : null}

      <fieldset disabled={!open || pending} className="disabled:opacity-60">
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {students.map((s) => {
            const m = marks[s.id] ?? { status: "", note: "" };
            const statusErr = errors[`status_${s.id}`];
            const noteErr = errors[`note_${s.id}`];
            return (
              <li key={s.id} className={cx("px-5 py-3 sm:px-6", (statusErr || noteErr) && "bg-rose-50/40")}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                  <div className="flex min-w-[180px] flex-1 items-center gap-3">
                    <Avatar name={s.name} />
                    <span className="min-w-0">
                      <Link href={studentHref(role, s.id) ?? "#"} className="block truncate text-[15px] font-medium text-ink-900 hover:text-brand-600 hover:underline">
                        {s.name}
                      </Link>
                      {s.seq ? <span className="num block text-xs text-ink-400">{studentCode(s.seq)}</span> : null}
                    </span>
                  </div>
                  <div role="radiogroup" aria-label={`${s.name} — davomat`} data-field={`status_${s.id}`} className="grid w-full grid-cols-3 gap-1.5 sm:w-auto">
                    {ATTENDANCE_STATUSES.map((st) => {
                      const on = m.status === st;
                      return (
                        <label
                          key={st}
                          className={cx(
                            "flex h-10 cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-semibold ring-1 ring-inset transition has-[:focus-visible]:ring-2 sm:min-w-24",
                            on ? TONE[st].on : cx("bg-surface", TONE[st].off),
                          )}
                        >
                          <input
                            type="radio"
                            name={`status_${s.id}`}
                            value={st}
                            checked={on}
                            onChange={() => set(s.id, { status: st })}
                            className="sr-only"
                          />
                          {ATTENDANCE_LABEL[st]}
                        </label>
                      );
                    })}
                  </div>
                </div>
                {statusErr ? <p className="mt-1.5 text-xs font-medium text-rose-600">{statusErr}</p> : null}
                {m.status && needsNote(m.status) ? (
                  <div className="mt-2.5 sm:pl-[52px]">
                    <input
                      name={`note_${s.id}`}
                      data-field={`note_${s.id}`}
                      value={m.note}
                      onChange={(e) => set(s.id, { note: e.target.value })}
                      maxLength={ATTENDANCE_NOTE_MAX}
                      required
                      aria-required
                      aria-invalid={!!noteErr}
                      aria-label={`${s.name} — izoh`}
                      placeholder={m.status === "excused" ? "Sababi (majburiy): kasal, oilaviy sabab…" : "Izoh (majburiy): nega kelmadi, kim bilan gaplashildi…"}
                      className={cx(inputCls, "h-10 text-sm", noteErr && "border-rose-300 ring-4 ring-rose-500/10")}
                    />
                    {noteErr ? <p className="mt-1 text-xs font-medium text-rose-600">{noteErr}</p> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-4 sm:px-6">
          <button type="submit" className={btn.primary}>
            {pending ? "Saqlanmoqda…" : "Davomatni saqlash"}
          </button>
          {missing ? (
            <button type="button" onClick={allPresent} className={cx(btn.outline, "text-emerald-700")}>
              <CheckCheck className="size-4" aria-hidden />
              Qolganlar «Keldi»
            </button>
          ) : null}
          <span className="num text-sm text-ink-500">{missing ? `Belgilanmagan: ${missing} ta` : "Hamma belgilandi"}</span>
        </div>
      </fieldset>
      {state.error && !Object.keys(local).length ? (
        <p className="px-5 pb-4 text-sm text-rose-600 sm:px-6" role="alert">
          {state.error}
        </p>
      ) : null}
      {Object.keys(local).length ? (
        <p className="px-5 pb-4 text-sm text-rose-600 sm:px-6" role="alert">
          Har bir o‘quvchiga holat tanlang; «Kelmadi» va «Sababli» uchun izoh majburiy.
        </p>
      ) : null}
      {state.ok && state.message && !pending ? (
        <p className="px-5 pb-4 text-sm text-emerald-700 sm:px-6" role="status">
          ✓ {state.message}
        </p>
      ) : null}
    </form>
  );
}
