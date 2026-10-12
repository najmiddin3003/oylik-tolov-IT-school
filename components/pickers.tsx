"use client";

// Qo'lda yasalgan tanlagichlar: Select (ro'yxat), DatePicker (sana), MonthPicker (oy), TimePicker (soat).
// Brauzerning standart <select>, <input type="date|month"> lari o'rniga — hamma qurilmada bir xil ko'rinadi.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Search, X } from "lucide-react";
import { normalizeText } from "@/lib/normalize";
import { isTime, toMinutes } from "@/lib/schedule";
import { MONTH_NAMES, todayISO } from "@/lib/time";
import { cx } from "./ui";

// ---------- Umumiy: ochiladigan oyna (popover) ----------

/** up — yuqoriga ochiladi; x — panelning chap cheti (tugmaga nisbatan, px), ekrandan chiqib ketmasligi uchun. */
type Placement = { up: boolean; x: number };

function usePopover(estimate: { height: number; width: number; matchTrigger?: boolean }) {
  const [open, setOpenState] = useState(false);
  const [placement, setPlacement] = useState<Placement>({ up: false, x: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next && rootRef.current) {
        const r = rootRef.current.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const width = Math.min(estimate.matchTrigger ? Math.max(r.width, estimate.width) : estimate.width, vw - 16);
        // Gorizontal: ekran chetidan chiqmasin (8px chegara)
        let left = r.left;
        if (left + width > vw - 8) left = vw - 8 - width;
        if (left < 8) left = 8;
        // Vertikal: pastda joy yetmasa va tepada to'liq sig'sa — yuqoriga
        const below = window.innerHeight - r.bottom;
        setPlacement({ up: below < estimate.height + 16 && r.top > estimate.height + 16, x: Math.round(left - r.left) });
      }
      setOpenState(next);
    },
    [estimate.height, estimate.width, estimate.matchTrigger],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenState(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = useCallback((focusTrigger = true) => {
    setOpenState(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  return { open, setOpen, close, placement, rootRef, triggerRef };
}

function panelCls(p: Placement, extra = "") {
  return cx(
    "absolute z-50 rounded-2xl border border-line bg-white p-2 shadow-pop pop-in",
    p.up ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top",
    extra,
  );
}

function panelStyle(p: Placement) {
  return { left: p.x };
}

const fieldBase =
  "flex w-full items-center gap-2 rounded-xl border bg-white px-3.5 text-left text-[15px] shadow-card transition focus:outline-none focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60";

function triggerCls(opts: { open: boolean; invalid?: boolean; size?: "md" | "lg"; className?: string }) {
  return cx(
    fieldBase,
    opts.size === "lg" ? "h-12" : "h-11",
    opts.invalid ? "border-rose-400" : opts.open ? "border-brand-400 ring-4 ring-brand-500/10" : "border-line hover:border-ink-300/70",
    opts.className,
  );
}

/** Forma ichida bo'lsa — tanlangandan keyin darhol yuboradi (filtrlar uchun). */
function submitClosestForm(el: HTMLElement | null) {
  const form = el?.closest("form");
  if (form) form.requestSubmit();
}

// ---------- Select ----------

export type SelectOption = { value: string; label: string; hint?: ReactNode; icon?: ReactNode };

export function Select({
  name,
  value,
  defaultValue = "",
  onChange,
  options,
  placeholder = "Tanlang",
  searchable,
  searchPlaceholder = "Qidirish...",
  emptyText = "Hech narsa topilmadi",
  autoSubmit = false,
  className,
  wrapperClassName,
  size = "md",
  invalid,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  autoSubmit?: boolean;
  className?: string;
  wrapperClassName?: string;
  size?: "md" | "lg";
  invalid?: boolean;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  // Sahifa manzili (filtr) o'zgarib, boshlang'ich qiymat yangilansa — ichki holat ham yangilanadi
  const [seenDefault, setSeenDefault] = useState(defaultValue);
  if (seenDefault !== defaultValue) {
    setSeenDefault(defaultValue);
    setInner(defaultValue);
  }
  const current = value ?? inner;
  const selected = options.find((o) => o.value === current);
  const canSearch = searchable ?? options.length > 8;
  const { open, setOpen, close, placement, rootRef, triggerRef } = usePopover({ height: canSearch ? 380 : 320, width: 230, matchTrigger: true });
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const filtered = useMemo(() => {
    const nq = normalizeText(query);
    return nq ? options.filter((o) => normalizeText(o.label).includes(nq)) : options;
  }, [options, query]);

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  // Faol qatorni ko'rinadigan joyga aylantirish
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (v: string) => {
    if (value === undefined) {
      if (autoSubmit) flushSync(() => setInner(v));
      else setInner(v);
    }
    onChange?.(v);
    close();
    if (autoSubmit && v !== current) submitClosestForm(triggerRef.current);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) commit(o.value);
    } else if (e.key === "Tab") {
      close(false);
    } else if (!canSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Harf terilsa — shu harf bilan boshlanadigan bandga o'tish
      const now = e.timeStamp;
      typeahead.current = { text: (now - typeahead.current.at < 700 ? typeahead.current.text : "") + e.key.toLowerCase(), at: now };
      const idx = filtered.findIndex((o) => normalizeText(o.label).startsWith(normalizeText(typeahead.current.text)));
      if (idx >= 0) setActive(idx);
    }
  };

  return (
    <div ref={rootRef} className={cx("relative", wrapperClassName)} onKeyDown={onKeyDown}>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        className={triggerCls({ open: open, invalid, size, className })}
      >
        {selected?.icon ? <span className="shrink-0">{selected.icon}</span> : null}
        <span className={cx("min-w-0 flex-1 truncate", selected ? "text-ink-900" : "text-ink-400")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cx("size-4 shrink-0 text-ink-400 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div className={panelCls(placement, "w-full min-w-[230px] max-w-[min(360px,calc(100vw-1rem))]")} style={panelStyle(placement)}>
          {canSearch ? (
            <label className="relative mb-1.5 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                className="h-10 w-full rounded-xl border border-line bg-slate-50/60 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none"
              />
            </label>
          ) : null}
          <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto overscroll-contain" tabIndex={-1}>
            {filtered.length === 0 ? <li className="px-3 py-6 text-center text-sm text-ink-400">{emptyText}</li> : null}
            {filtered.map((o, i) => {
              const isSel = o.value === current;
              return (
                <li
                  key={o.value || "__empty"}
                  data-index={i}
                  role="option"
                  aria-selected={isSel}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => commit(o.value)}
                  className={cx(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
                    i === active ? "bg-brand-50 text-brand-800" : "text-ink-700",
                    isSel && "font-semibold",
                  )}
                >
                  {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint ? <span className="shrink-0 text-xs font-normal text-ink-400">{o.hint}</span> : null}
                  <Check className={cx("size-4 shrink-0 text-brand-600", isSel ? "opacity-100" : "opacity-0")} strokeWidth={2.4} aria-hidden />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Takliflar bilan matn maydoni (masalan, guruh nomi) ----------

/** Oddiy matn maydoni + yozilganiga mos takliflar ro'yxati (brauzerning datalist'i o'rniga). */
export function SuggestInput({
  name,
  defaultValue = "",
  suggestions,
  placeholder,
  id,
  className,
}: {
  name: string;
  defaultValue?: string;
  suggestions: string[];
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const nq = normalizeText(text);
    return suggestions.filter((s) => normalizeText(s) !== nq && (!nq || normalizeText(s).includes(nq))).slice(0, 8);
  }, [suggestions, text]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const show = open && matches.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name={name}
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(matches.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            setText(matches[active]);
            setOpen(false);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={className}
      />
      {show ? (
        <ul id={listId} role="listbox" className="pop-in absolute left-0 top-full z-50 mt-2 w-full rounded-2xl border border-line bg-white p-1.5 shadow-pop">
          {matches.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => {
                e.preventDefault();
                setText(s);
                setOpen(false);
              }}
              className={cx("cursor-pointer rounded-xl px-3 py-2.5 text-[15px]", i === active ? "bg-brand-50 text-brand-800" : "text-ink-700")}
            >
              {s}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------- Sana yordamchilari (UTC bilan — vaqt mintaqasi siljitmaydi) ----------

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const MONTHS_LOWER = MONTH_NAMES.map((m) => m.toLowerCase());
const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const isIso = (v: string | undefined | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: string | undefined | null): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** "2026-10-10" -> "10-oktabr, 2026" */
export function formatDayLong(iso: string): string {
  if (!isIso(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}-${MONTHS_LOWER[m - 1]}, ${y}`;
}

function monthGrid(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = isoOf(y, m, 1);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // dushanbadan boshlab
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// ---------- DatePicker ----------

export function DatePicker({
  name,
  value,
  defaultValue = "",
  onChange,
  placeholder = "Sanani tanlang",
  clearable = false,
  autoSubmit = false,
  min,
  max,
  invalid,
  id,
  className,
  wrapperClassName,
  size = "md",
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  autoSubmit?: boolean;
  min?: string;
  max?: string;
  invalid?: boolean;
  id?: string;
  className?: string;
  wrapperClassName?: string;
  size?: "md" | "lg";
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  // Sahifa manzili (filtr) o'zgarib, boshlang'ich qiymat yangilansa — ichki holat ham yangilanadi
  const [seenDefault, setSeenDefault] = useState(defaultValue);
  if (seenDefault !== defaultValue) {
    setSeenDefault(defaultValue);
    setInner(defaultValue);
  }
  const current = value ?? inner;
  const { open, setOpen, close, placement, rootRef, triggerRef } = usePopover({ height: 400, width: 312 });
  const [view, setView] = useState(() => (isIso(current) ? current.slice(0, 7) : todayISO().slice(0, 7)));
  const [focusDay, setFocusDay] = useState(() => (isIso(current) ? current : todayISO()));
  const gridRef = useRef<HTMLDivElement>(null);
  const today = open ? todayISO() : "";

  const outOfRange = (iso: string) => (min ? iso < min : false) || (max ? iso > max : false);

  const openPanel = () => {
    const start = isIso(current) ? current : todayISO();
    setView(start.slice(0, 7));
    setFocusDay(start);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, view, open]);

  const commit = (v: string) => {
    if (value === undefined) {
      if (autoSubmit) flushSync(() => setInner(v));
      else setInner(v);
    }
    onChange?.(v);
    close();
    if (autoSubmit && v !== current) submitClosestForm(triggerRef.current);
  };

  const move = (n: number) => {
    const next = addDays(focusDay, n);
    setFocusDay(next);
    if (next.slice(0, 7) !== view) setView(next.slice(0, 7));
  };

  const onGridKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) {
      e.preventDefault();
      move(map[e.key]);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const nextView = addMonths(view, e.key === "PageUp" ? -1 : 1);
      setView(nextView);
      setFocusDay(`${nextView}-01`);
    }
  };

  const onRootKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const [vy, vm] = view.split("-").map(Number);
  const days = monthGrid(view);

  return (
    <div ref={rootRef} className={cx("relative", wrapperClassName)} onKeyDown={onRootKey}>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}${current ? `: ${formatDayLong(current)}` : ""}` : undefined}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={triggerCls({ open: open, invalid, size, className })}
      >
        <CalendarDays className="size-[18px] shrink-0 text-ink-400" strokeWidth={1.8} aria-hidden />
        <span className={cx("min-w-0 flex-1 truncate", current ? "text-ink-900" : "text-ink-400")}>
          {current ? formatDayLong(current) : placeholder}
        </span>
        {clearable && current ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Sanani tozalash"
            onClick={(e) => {
              e.stopPropagation();
              commit("");
            }}
            className="-mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-slate-100 hover:text-ink-800"
          >
            <X className="size-4" aria-hidden />
          </span>
        ) : (
          <ChevronDown className={cx("size-4 shrink-0 text-ink-400 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        )}
      </button>

      {open ? (
        <div role="dialog" aria-label="Sana tanlash" className={panelCls(placement, "w-[312px] max-w-[calc(100vw-1rem)] p-3")} style={panelStyle(placement)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setView(addMonths(view, -1))} className="inline-flex size-9 items-center justify-center rounded-xl text-ink-500 transition hover:bg-slate-100 hover:text-ink-900" aria-label="Oldingi oy">
              <ChevronLeft className="size-[18px]" aria-hidden />
            </button>
            <p className="num text-[15px] font-semibold text-ink-900">
              {MONTH_NAMES[vm - 1]} {vy}
            </p>
            <button type="button" onClick={() => setView(addMonths(view, 1))} className="inline-flex size-9 items-center justify-center rounded-xl text-ink-500 transition hover:bg-slate-100 hover:text-ink-900" aria-label="Keyingi oy">
              <ChevronRight className="size-[18px]" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 px-0.5 pb-1">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={cx("py-1 text-center text-[11px] font-semibold uppercase tracking-wide", i >= 5 ? "text-rose-400" : "text-ink-400")}>
                {w}
              </span>
            ))}
          </div>
          <div ref={gridRef} className="grid grid-cols-7 gap-1 px-0.5" onKeyDown={onGridKey}>
            {days.map((d) => {
              const inMonth = d.slice(0, 7) === view;
              const isSel = d === current;
              const isToday = d === today;
              const disabled = outOfRange(d);
              return (
                <button
                  key={d}
                  type="button"
                  data-day={d}
                  tabIndex={d === focusDay ? 0 : -1}
                  disabled={disabled}
                  onClick={() => commit(d)}
                  aria-pressed={isSel}
                  aria-label={formatDayLong(d)}
                  className={cx(
                    "num relative inline-flex h-10 items-center justify-center rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    isSel
                      ? "bg-brand-600 font-semibold text-white shadow-brand"
                      : disabled
                        ? "cursor-not-allowed text-ink-300/60"
                        : inMonth
                          ? "text-ink-800 hover:bg-brand-50 hover:text-brand-700"
                          : "text-ink-300 hover:bg-slate-50",
                    isToday && !isSel && "font-semibold text-brand-700 ring-1 ring-inset ring-brand-200",
                  )}
                >
                  {Number(d.slice(8, 10))}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft px-1 pt-2.5">
            <button
              type="button"
              disabled={outOfRange(todayISO())}
              onClick={() => commit(todayISO())}
              className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-40"
            >
              Bugun
            </button>
            {clearable && current ? (
              <button type="button" onClick={() => commit("")} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-500 transition hover:bg-slate-100">
                Tozalash
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- MonthPicker ----------

export function MonthPicker({
  name,
  value,
  defaultValue = "",
  onChange,
  autoSubmit = false,
  min,
  max,
  invalid,
  id,
  className,
  wrapperClassName,
  size = "md",
  variant = "field",
  placeholder = "Oyni tanlang",
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  autoSubmit?: boolean;
  min?: string;
  max?: string;
  invalid?: boolean;
  id?: string;
  className?: string;
  wrapperClassName?: string;
  size?: "md" | "lg";
  /** field — oddiy maydon; bare — ramkasiz (yuqoridagi oy tanlagich ichida) */
  variant?: "field" | "bare";
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  // Sahifa manzili (filtr) o'zgarib, boshlang'ich qiymat yangilansa — ichki holat ham yangilanadi
  const [seenDefault, setSeenDefault] = useState(defaultValue);
  if (seenDefault !== defaultValue) {
    setSeenDefault(defaultValue);
    setInner(defaultValue);
  }
  const current = value ?? inner;
  const { open, setOpen, close, placement, rootRef, triggerRef } = usePopover({ height: 300, width: 292 });
  const [year, setYear] = useState(() => Number((isMonth(current) ? current : todayISO()).slice(0, 4)));
  const [focusMonth, setFocusMonth] = useState(() => (isMonth(current) ? current : todayISO().slice(0, 7)));
  const gridRef = useRef<HTMLDivElement>(null);
  const nowMonth = open ? todayISO().slice(0, 7) : "";

  const outOfRange = (m: string) => (min ? m < min : false) || (max ? m > max : false);

  const openPanel = () => {
    const start = isMonth(current) ? current : todayISO().slice(0, 7);
    setYear(Number(start.slice(0, 4)));
    setFocusMonth(start);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-month="${focusMonth}"]`)?.focus();
  }, [focusMonth, year, open]);

  const commit = (v: string) => {
    if (value === undefined) {
      if (autoSubmit) flushSync(() => setInner(v));
      else setInner(v);
    }
    onChange?.(v);
    close();
    if (autoSubmit && v !== current) submitClosestForm(triggerRef.current);
  };

  const onGridKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    if (e.key in map) {
      e.preventDefault();
      const next = addMonths(focusMonth, map[e.key]);
      setFocusMonth(next);
      setYear(Number(next.slice(0, 4)));
    }
  };

  const label = isMonth(current) ? `${MONTH_NAMES[Number(current.slice(5, 7)) - 1]} ${current.slice(0, 4)}` : placeholder;

  return (
    <div
      ref={rootRef}
      className={cx("relative", wrapperClassName)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${label}` : undefined}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={
          variant === "bare"
            ? cx(
                "flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink-900 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:px-3 sm:text-[15px]",
                open && "bg-slate-100",
                className,
              )
            : triggerCls({ open: open, invalid, size, className })
        }
      >
        <CalendarDays className={cx("size-[18px] shrink-0", variant === "bare" ? "hidden text-brand-600 sm:block" : "text-ink-400")} strokeWidth={1.8} aria-hidden />
        <span className={cx("num min-w-0 truncate whitespace-nowrap", variant === "field" && "flex-1", isMonth(current) ? "text-ink-900" : "text-ink-400")}>{label}</span>
        {variant === "field" ? (
          <ChevronDown className={cx("size-4 shrink-0 text-ink-400 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        ) : null}
      </button>

      {open ? (
        <div role="dialog" aria-label="Oy tanlash" className={panelCls(placement, "w-[292px] max-w-[calc(100vw-1rem)] p-3")} style={panelStyle(placement)}>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setYear((y) => y - 1)} className="inline-flex size-9 items-center justify-center rounded-xl text-ink-500 transition hover:bg-slate-100 hover:text-ink-900" aria-label="Oldingi yil">
              <ChevronLeft className="size-[18px]" aria-hidden />
            </button>
            <p className="num text-[15px] font-semibold text-ink-900">{year}</p>
            <button type="button" onClick={() => setYear((y) => y + 1)} className="inline-flex size-9 items-center justify-center rounded-xl text-ink-500 transition hover:bg-slate-100 hover:text-ink-900" aria-label="Keyingi yil">
              <ChevronRight className="size-[18px]" aria-hidden />
            </button>
          </div>
          <div ref={gridRef} className="grid grid-cols-3 gap-1.5" onKeyDown={onGridKey}>
            {MONTHS_SHORT.map((short, i) => {
              const m = `${year}-${pad(i + 1)}`;
              const isSel = m === current;
              const isNow = m === nowMonth;
              const disabled = outOfRange(m);
              return (
                <button
                  key={m}
                  type="button"
                  data-month={m}
                  tabIndex={m === focusMonth ? 0 : -1}
                  disabled={disabled}
                  onClick={() => commit(m)}
                  aria-pressed={isSel}
                  aria-label={`${MONTH_NAMES[i]} ${year}`}
                  className={cx(
                    "inline-flex h-11 items-center justify-center rounded-xl text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    isSel
                      ? "bg-brand-600 font-semibold text-white shadow-brand"
                      : disabled
                        ? "cursor-not-allowed text-ink-300/60"
                        : "text-ink-700 hover:bg-brand-50 hover:text-brand-700",
                    isNow && !isSel && "font-semibold text-brand-700 ring-1 ring-inset ring-brand-200",
                  )}
                >
                  {short}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 border-t border-line-soft px-1 pt-2.5">
            <button
              type="button"
              onClick={() => commit(todayISO().slice(0, 7))}
              disabled={outOfRange(todayISO().slice(0, 7))}
              className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-40"
            >
              Joriy oy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- TimePicker ----------

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06 … 23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05 … 55
const TIME_PANEL = { width: 288, height: 336 };

/** Tugmalar to'ri ichida strelkalar bilan yurish (fokus faqat yoqilgan tugmalarga). */
function gridArrows(e: KeyboardEvent<HTMLDivElement>, cols: number) {
  const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
  if (!(e.key in step)) return;
  const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  for (let j = i + step[e.key]; j >= 0 && j < buttons.length; j += step[e.key]) {
    if (!buttons[j].disabled) {
      buttons[j].focus();
      return;
    }
  }
}

type FixedPos = { left: number; top?: number; bottom?: number };

/**
 * Soat tanlagich: avval soat, keyin daqiqa (5 daqiqa qadam). `after` berilsa — undan oldingi
 * (va teng) vaqtlarni tanlab bo'lmaydi (masalan, dars tugashi boshlanishidan keyin).
 * Oyna ekranga nisbatan joylashadi (position: fixed) — aylantiriladigan modal oyna ichida ham kesilmaydi;
 * sahifa aylantirilsa yopiladi.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "--:--",
  after,
  invalid,
  id,
  className,
  wrapperClassName,
  compact = false,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  after?: string;
  /** Tor joyda (telefonda) soat belgisi yashiriladi — vaqt to'liq ko'rinsin */
  compact?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  wrapperClassName?: string;
  "aria-label"?: string;
}) {
  const [pos, setPos] = useState<FixedPos | null>(null);
  const open = pos !== null;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hour = isTime(value) ? Number(value.slice(0, 2)) : null;
  const minute = isTime(value) ? Number(value.slice(3, 5)) : null;
  const floor = after && isTime(after) ? toMinutes(after) : -1;
  const allowed = (h: number, m: number) => h * 60 + m > floor;

  const openPanel = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const width = Math.min(TIME_PANEL.width, vw - 16);
    const left = Math.round(Math.min(Math.max(8, r.left), vw - 8 - width));
    const up = vh - r.bottom < TIME_PANEL.height + 16 && r.top > TIME_PANEL.height + 16;
    setPos(up ? { left, bottom: Math.round(vh - r.top + 8) } : { left, top: Math.round(r.bottom + 8) });
  };
  const close = useCallback((focusTrigger = true) => {
    setPos(null);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  // Tashqariga bosilsa, sahifa (yoki oyna) aylantirilsa yoki o'lchami o'zgarsa — yopiladi
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const p = panelRef.current;
    // preventScroll: fokus sahifani surmasin (surilsa — oyna yopilib qoladi)
    (p?.querySelector<HTMLButtonElement>('[data-hour][aria-pressed="true"]') ?? p?.querySelector<HTMLButtonElement>("[data-hour]:not(:disabled)"))?.focus({ preventScroll: true });
  }, [open]);

  const pickHour = (h: number) => {
    // Daqiqa avval tanlangan bo'lsa — saqlanadi; bu soatda ruxsat etilmasa — birinchi ruxsat etilgani
    const m = minute !== null && allowed(h, minute) ? minute : (MINUTES.find((x) => allowed(h, x)) ?? 0);
    onChange(`${pad(h)}:${pad(m)}`);
  };
  const pickMinute = (m: number) => {
    const h = hour ?? HOURS.find((x) => allowed(x, m)) ?? 9;
    onChange(`${pad(h)}:${pad(m)}`);
    close();
  };

  const cell = (selected: boolean, disabled: boolean) =>
    cx(
      "num inline-flex h-10 items-center justify-center rounded-xl text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
      selected ? "bg-brand-600 font-semibold text-white shadow-brand" : disabled ? "cursor-not-allowed text-ink-300/60" : "text-ink-700 hover:bg-brand-50 hover:text-brand-700",
    );

  return (
    <div
      ref={rootRef}
      className={cx("relative", wrapperClassName)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}${isTime(value) ? `: ${value}` : ""}` : undefined}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={triggerCls({ open, invalid, className })}
      >
        <Clock3 className={cx("size-[18px] shrink-0 text-ink-400", compact && "hidden sm:block")} strokeWidth={1.8} aria-hidden />
        <span className={cx("num min-w-0 flex-1 truncate", isTime(value) ? "font-medium text-ink-900" : "text-ink-400")}>{isTime(value) ? value : placeholder}</span>
        <ChevronDown className={cx("size-4 shrink-0 text-ink-400 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {pos ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Vaqt tanlash"
          className={cx(
            "pop-in fixed z-50 w-[288px] max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-white p-3 shadow-pop",
            pos.bottom !== undefined ? "origin-bottom" : "origin-top",
          )}
          style={pos}
        >
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Soat</p>
          <div className="grid grid-cols-6 gap-1" onKeyDown={(e) => gridArrows(e, 6)}>
            {HOURS.map((h) => {
              const disabled = !MINUTES.some((m) => allowed(h, m));
              return (
                <button
                  key={h}
                  type="button"
                  data-hour={h}
                  disabled={disabled}
                  aria-pressed={h === hour}
                  aria-label={`Soat ${pad(h)}`}
                  onClick={() => pickHour(h)}
                  className={cell(h === hour, disabled)}
                >
                  {pad(h)}
                </button>
              );
            })}
          </div>
          <p className="mb-1.5 mt-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Daqiqa</p>
          <div className="grid grid-cols-6 gap-1" onKeyDown={(e) => gridArrows(e, 6)}>
            {MINUTES.map((m) => {
              const disabled = hour !== null && !allowed(hour, m);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  aria-pressed={m === minute}
                  aria-label={`${pad(m)} daqiqa`}
                  onClick={() => pickMinute(m)}
                  className={cell(m === minute, disabled)}
                >
                  {pad(m)}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft px-1 pt-2.5">
            <span className="num text-[15px] font-semibold text-ink-900">{isTime(value) ? value : "--:--"}</span>
            <button type="button" onClick={() => close()} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
              Tayyor
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
