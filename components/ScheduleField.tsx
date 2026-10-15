"use client";

// Dars jadvalini kiritish: kunlar (toq/juft yoki o'zingiz tanlagan) va vaqt (boshlanishi — tugashi).
import { useState, useTransition } from "react";
import { CalendarClock, Check, Eraser, X } from "lucide-react";
import {
  DAY_PRESETS,
  isTime,
  lessonsKey,
  scheduleLabel,
  shiftEnd,
  toMinutes,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  type Lesson,
} from "@/lib/schedule";
import { useDialog } from "./Modal";
import { TimePicker } from "./pickers";
import { btn, cx, IconTile, labelCls } from "./ui";

type Slot = { start: string; end: string };
type State = { days: number[]; common: Slot; perDay: boolean; custom: Record<number, Slot> };

const EMPTY_SLOT: Slot = { start: "", end: "" };

function fromLessons(lessons: Lesson[]): State {
  const sorted = [...lessons].sort((a, b) => a.day - b.day);
  return {
    days: sorted.map((l) => l.day),
    common: sorted[0] ? { start: sorted[0].start, end: sorted[0].end } : EMPTY_SLOT,
    perDay: new Set(sorted.map((l) => `${l.start}-${l.end}`)).size > 1,
    custom: Object.fromEntries(sorted.map((l) => [l.day, { start: l.start, end: l.end }])),
  };
}

/** Yuboriladigan qiymat: tanlangan har bir kun uchun vaqt (to'ldirilmagan bo'lsa ham — server xabar beradi). */
function toLessons(s: State): Lesson[] {
  return s.days.map((day) => ({ day, ...(s.perDay ? (s.custom[day] ?? s.common) : s.common) }));
}

function problemOf(lessons: Lesson[]): string | null {
  for (const l of lessons) {
    if (!isTime(l.start)) return "Dars boshlanish vaqtini tanlang";
    if (!isTime(l.end)) return "Dars tugash vaqtini tanlang";
    if (toMinutes(l.end) <= toMinutes(l.start)) return "Tugash vaqti boshlanishidan keyin bo‘lishi kerak";
  }
  return null;
}

/** Boshlanish o'zgarsa — tugash ham suriladi (dars davomiyligi saqlanadi, yo'q bo'lsa — 2 soat). */
function withStart(slot: Slot, start: string): Slot {
  if (!isTime(slot.start) && isTime(slot.end) && toMinutes(slot.end) > toMinutes(start)) return { start, end: slot.end };
  return { start, end: shiftEnd(slot.start, slot.end, start) };
}

export function ScheduleField({
  name,
  defaultValue = [],
  onChange,
  templates = [],
  error,
  errorStamp,
}: {
  /** Forma ichida — shu nomli yashirin maydon (JSON) */
  name?: string;
  defaultValue?: Lesson[];
  onChange?: (lessons: Lesson[], problem: string | null) => void;
  /** Boshqa o'quvchilarda ko'p uchraydigan jadvallar — bir bosishda qo'yish uchun */
  templates?: Lesson[][];
  /** Serverdan kelgan xato — foydalanuvchi jadvalni o'zgartirsa, keyingi yuborishgacha yashiriladi */
  error?: string;
  /** Har yangi yuborish natijasida o'zgaradigan qiymat (bir xil xato qaytsa ham qayta ko'rsatish uchun) */
  errorStamp?: unknown;
}) {
  const [state, setState] = useState<State>(() => fromLessons(defaultValue));
  const [dirty, setDirty] = useState(false);
  const stamp = errorStamp === undefined ? error : errorStamp;
  const [seenStamp, setSeenStamp] = useState(stamp);
  if (seenStamp !== stamp) {
    setSeenStamp(stamp);
    setDirty(false);
  }
  const shownError = dirty ? undefined : error;
  const lessons = toLessons(state);
  const problem = problemOf(lessons);
  const currentKey = problem ? "" : lessonsKey(lessons);
  const daysKey = state.days.join(",");

  const update = (next: State) => {
    setState(next);
    setDirty(true);
    if (onChange) {
      const ls = toLessons(next);
      onChange(ls, problemOf(ls));
    }
  };

  const setDays = (days: number[]) => {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    // Yangi qo'shilgan kun: alohida vaqt rejimida — birinchi kunning vaqti, aks holda — umumiy vaqt
    const base = state.perDay ? (state.custom[state.days[0]] ?? state.common) : state.common;
    const custom = { ...state.custom };
    for (const d of sorted) if (!state.days.includes(d)) custom[d] = base;
    const perDay = state.perDay && sorted.length > 1;
    // Alohida vaqt rejimidan bitta kunga tushsa — o'sha kunning o'z vaqti umumiy vaqt bo'ladi
    const common = state.perDay && !perDay && sorted.length ? (state.custom[sorted[0]] ?? state.common) : state.common;
    update({ ...state, days: sorted, custom, perDay, common });
  };
  const toggleDay = (d: number) => setDays(state.days.includes(d) ? state.days.filter((x) => x !== d) : [...state.days, d]);
  const setPerDay = (on: boolean) => {
    if (!on) {
      update({ ...state, perDay: false, common: state.custom[state.days[0]] ?? state.common });
      return;
    }
    // Umumiy vaqt o'zgartirilmagan bo'lsa — avvalgi alohida vaqtlar qaytadi, aks holda hamma kunga umumiy vaqt
    const first = state.custom[state.days[0]];
    const untouched = first !== undefined && first.start === state.common.start && first.end === state.common.end;
    update({ ...state, perDay: true, custom: Object.fromEntries(state.days.map((d) => [d, (untouched && state.custom[d]) || state.common])) });
  };

  return (
    <div className="grid gap-5">
      {name ? <input type="hidden" name={name} value={JSON.stringify(lessons)} /> : null}

      <div>
        <span className={labelCls}>Dars kunlari</span>
        <div className="flex flex-wrap gap-2">
          {DAY_PRESETS.map((p) => {
            const active = p.days.join(",") === daysKey;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => setDays(active ? [] : [...p.days])}
                className={cx(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  active ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-700 ring-line hover:bg-slate-50",
                )}
              >
                {p.label}
                <span className={cx("hidden text-[11px] font-medium sm:inline", active ? "text-white/70" : "text-ink-400")}>{p.hint}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid max-w-md grid-cols-7 gap-1.5" role="group" aria-label="Hafta kunlari">
          {WEEKDAY_SHORT.map((w, i) => {
            const d = i + 1;
            const on = state.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[i]}
                title={WEEKDAY_NAMES[i]}
                onClick={() => toggleDay(d)}
                className={cx(
                  "h-11 rounded-xl border text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15",
                  on
                    ? "border-brand-600 bg-brand-600 text-white shadow-brand"
                    : cx("border-line bg-surface hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700", i >= 5 ? "text-rose-500/80" : "text-ink-600"),
                )}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>

      {state.days.length ? (
        <div>
          <span className={labelCls}>Dars vaqti</span>
          {state.perDay ? (
            <div className="grid max-w-lg gap-2.5">
              {state.days.map((d) => {
                const slot = state.custom[d] ?? state.common;
                const set = (s: Slot) => update({ ...state, custom: { ...state.custom, [d]: s } });
                return (
                  <div key={d} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <span className="text-sm font-medium text-ink-700">
                      <span className="sm:hidden">{WEEKDAY_SHORT[d - 1]}</span>
                      <span className="hidden sm:inline">{WEEKDAY_NAMES[d - 1]}</span>
                    </span>
                    <TimePicker compact value={slot.start} onChange={(v) => set(withStart(slot, v))} placeholder="Boshi" aria-label={`${WEEKDAY_NAMES[d - 1]}: dars boshlanishi`} />
                    <span className="text-ink-300" aria-hidden>
                      —
                    </span>
                    <TimePicker compact value={slot.end} after={slot.start} onChange={(v) => set({ ...slot, end: v })} placeholder="Oxiri" aria-label={`${WEEKDAY_NAMES[d - 1]}: dars tugashi`} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid max-w-md grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <TimePicker
                compact
                value={state.common.start}
                onChange={(v) => update({ ...state, common: withStart(state.common, v) })}
                placeholder="Boshlanishi"
                invalid={Boolean(shownError) && !isTime(state.common.start)}
                aria-label="Dars boshlanishi"
              />
              <span className="text-ink-300" aria-hidden>
                —
              </span>
              <TimePicker
                compact
                value={state.common.end}
                after={state.common.start}
                onChange={(v) => update({ ...state, common: { ...state.common, end: v } })}
                placeholder="Tugashi"
                aria-label="Dars tugashi"
              />
            </div>
          )}
          {state.days.length > 1 ? (
            <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" checked={state.perDay} onChange={(e) => setPerDay(e.target.checked)} className="size-4 rounded accent-brand-600" />
              Kunlarga qarab vaqt har xil
            </label>
          ) : null}
        </div>
      ) : null}

      {templates.length ? (
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Boshqa o‘quvchilardagi jadvallar</span>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => {
              const key = lessonsKey(t);
              const active = key === currentKey;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update(fromLessons(t))}
                  className={cx(
                    "num inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-left text-[13px] font-medium transition",
                    active ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-600 hover:border-brand-200 hover:text-brand-700",
                  )}
                >
                  <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                  {scheduleLabel(t)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {shownError ? (
          <p className="text-rose-600" role="alert">
            {shownError}
          </p>
        ) : !state.days.length ? (
          <p className="text-ink-400">Ixtiyoriy. Kiritilsa, to‘lovlar sahifasida o‘quvchi qaysi kuni, soat nechida kelishi ko‘rinadi.</p>
        ) : problem ? (
          <p className="text-amber-700">{problem}</p>
        ) : (
          <p className="num flex items-center gap-1.5 font-medium text-emerald-700">
            <Check className="size-4" strokeWidth={2.4} aria-hidden />
            {scheduleLabel(lessons)}
          </p>
        )}
        {state.days.length ? (
          <button type="button" onClick={() => update(fromLessons([]))} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-500 transition hover:bg-slate-100 hover:text-ink-800">
            <Eraser className="size-3.5" aria-hidden />
            Tozalash
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Tanlangan o'quvchilarga bir xil dars jadvali qo'yish oynasi. */
export function ScheduleDialog({
  open,
  onClose,
  count,
  initial,
  templates,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  /** Tanlanganlarning hammasida bir xil jadval bo'lsa — o'sha, aks holda bo'sh */
  initial: Lesson[];
  templates: Lesson[][];
  /** Saqlash: xato bo'lsa — xabar, bo'lmasa — null */
  onSave: (lessons: Lesson[]) => Promise<string | null>;
}) {
  const { ref, present } = useDialog(open);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="schedule-dialog-title"
      className="m-auto max-h-[min(760px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink-700 shadow-pop"
    >
      {present ? <ScheduleDialogBody count={count} initial={initial} templates={templates} onSave={onSave} onClose={onClose} /> : null}
    </dialog>
  );
}

function ScheduleDialogBody({
  count,
  initial,
  templates,
  onSave,
  onClose,
}: {
  count: number;
  initial: Lesson[];
  templates: Lesson[][];
  onSave: (lessons: Lesson[]) => Promise<string | null>;
  onClose: () => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const err = await onSave(lessons);
      if (err) setError(err);
      else onClose();
    });

  return (
    <div className="flex max-h-[min(760px,calc(100dvh-2rem))] flex-col">
      <div className="group flex items-start gap-3.5 border-b border-line-soft px-5 py-4 sm:px-6">
        <IconTile icon={CalendarClock} tone="sky" variant="solid" />
        <div className="min-w-0 flex-1">
          <h2 id="schedule-dialog-title" className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
            Dars vaqtini belgilash
          </h2>
          <p className="num mt-0.5 text-sm text-ink-500">{count} ta o‘quvchiga bir xil jadval qo‘yiladi</p>
        </div>
        <button type="button" onClick={onClose} className={btn.icon} aria-label="Yopish">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <ScheduleField
          defaultValue={initial}
          templates={templates}
          error={error}
          onChange={(ls, p) => {
            setLessons(ls);
            setProblem(p);
            setError(undefined);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-slate-50/60 px-5 py-3 sm:px-6">
        <button type="button" onClick={onClose} className={cx(btn.outline, "h-10")}>
          Bekor qilish
        </button>
        <button type="button" onClick={save} disabled={pending || Boolean(problem)} className={cx(btn.primary, "h-10")}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : lessons.length ? "Saqlash" : "Jadvalni tozalash"}
        </button>
      </div>
    </div>
  );
}
