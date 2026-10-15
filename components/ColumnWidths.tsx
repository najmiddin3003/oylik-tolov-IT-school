"use client";

// Jadval ustunlari kengligini o'zgartirish. Standart holatda jadval odatdagidek (mazmunga qarab) joylashadi; foydalanuvchi
// sarlavha chetidagi tutqichni sura boshlaganda joriy kengliklar o'lchab olinadi va shundan keyin ular qo'lda boshqariladi.
// Ikki marta bosilsa — asl holiga (avtomatik) qaytadi; klaviaturada ← / →. Kengliklar shu brauzerda eslab qolinadi.
import { useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";

type Widths = Record<string, number>;

const stores = new Map<string, { value: Widths | null; listeners: Set<() => void> }>();
const EMPTY: Widths = {};

function storeFor(key: string) {
  let s = stores.get(key);
  if (!s) {
    s = { value: null, listeners: new Set() };
    stores.set(key, s);
  }
  return s;
}

function readStored(key: string): Widths {
  const s = storeFor(key);
  if (s.value === null) {
    const parsed: Widths = {};
    try {
      const raw = localStorage.getItem(key);
      const obj = raw ? (JSON.parse(raw) as unknown) : null;
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) if (typeof v === "number" && v > 0) parsed[k] = v;
      }
    } catch {
      // Saqlab bo'lmasa (yopiq rejim va h.k.) — standart holat
    }
    s.value = parsed;
  }
  return s.value;
}

function writeStored(key: string, next: Widths) {
  const s = storeFor(key);
  s.value = next;
  try {
    if (Object.keys(next).length) localStorage.setItem(key, JSON.stringify(next));
    else localStorage.removeItem(key);
  } catch {
    // Saqlanmasa ham shu sahifada ishlayveradi
  }
  s.listeners.forEach((l) => l());
}

/**
 * `measure` — jadvaldagi hozirgi ustun kengliklari (px), qo'lda boshqarishga o'tishda bir marta o'qiladi.
 * `fallback` — saqlanmagan ustun uchun (masalan, keyin paydo bo'lgan ustun) kenglik.
 */
export function useColumnWidths<K extends string>(storageKey: string, measure: () => Partial<Record<K, number>>, fallback: Record<K, number>, limits = { min: 80, max: 720 }) {
  const stored = useSyncExternalStore(
    (cb) => {
      const s = storeFor(storageKey);
      s.listeners.add(cb);
      return () => s.listeners.delete(cb);
    },
    () => readStored(storageKey),
    () => EMPTY,
  );
  // Surilayotgan payt: kengliklar shu yerda o'zgaradi, qo'yib yuborilganda saqlanadi
  const [drag, setDrag] = useState<Widths | null>(null);
  const current = drag ?? stored;
  const custom = Object.keys(current).length > 0;
  const clamp = (w: number) => Math.round(Math.min(limits.max, Math.max(limits.min, w)));
  const widthOf = (k: K): number => current[k] ?? fallback[k];
  // Qo'lda boshqarishning boshlang'ich holati: saqlangan kengliklar yoki (birinchi marta) jadvaldan o'lchanganlari
  const baseline = (): Widths => (custom ? { ...current } : { ...(measure() as Widths) });

  const startResize = (k: K, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const base = baseline();
    const startX = e.clientX;
    const startW = base[k] ?? fallback[k];
    let last: Widths = base;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      last = { ...base, [k]: clamp(startW + ev.clientX - startX) };
      setDrag(last);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDrag(null);
      if (last !== base) writeStored(storageKey, last);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const resizeBy = (k: K, delta: number) => {
    const base = baseline();
    writeStored(storageKey, { ...base, [k]: clamp((base[k] ?? fallback[k]) + delta) });
  };
  /** Hamma ustunlar — asl (avtomatik) holiga */
  const reset = () => writeStored(storageKey, {});

  return { custom, widthOf, startResize, resizeBy, reset };
}

/** Ustun sarlavhasining o'ng chetidagi tutqich. */
export function ColumnResizer({
  label,
  onPointerDown,
  onReset,
  onStep,
}: {
  label: string;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onReset: () => void;
  onStep: (delta: number) => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`«${label}» ustuni kengligi`}
      tabIndex={0}
      title="Kengligini o‘zgartirish uchun suring (ikki marta bosilsa — jadval asl holiga qaytadi)"
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onStep(e.key === "ArrowLeft" ? -16 : 16);
        }
      }}
      className="group/resizer absolute right-0 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none select-none items-center justify-center outline-none"
    >
      <span className="h-5 w-0.5 rounded-full bg-line transition-all group-hover/resizer:h-full group-hover/resizer:bg-brand-400 group-focus-visible/resizer:h-full group-focus-visible/resizer:bg-brand-500" />
    </span>
  );
}
