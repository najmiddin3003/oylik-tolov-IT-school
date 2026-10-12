"use client";

// Brauzerdagi "hozirgi vaqt": har 30 soniyada yangilanadi (sahifa kun bo'yi ochiq tursa ham
// "hozir darsda" kabi holatlar o'z-o'zidan almashadi). Barcha komponentlar bitta taymerdan foydalanadi.
import { useSyncExternalStore } from "react";

const STEP = 30_000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let current = 0;

const rounded = () => Math.floor(Date.now() / STEP) * STEP;

function tick() {
  const next = rounded();
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    // Uzoq vaqt hech kim tinglamagan bo'lsa — qiymat eskirgan: yangilab olamiz (React obunadan keyin o'zi tekshiradi)
    current = rounded();
    timer = setInterval(tick, 5_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  if (!current) current = rounded();
  return current;
}

/**
 * Hozirgi vaqt (ms, 30 soniyaga yaxlitlangan). `serverNow` — serverda chizilgan qiymat:
 * sahifa yuklanayotganda (hydration) aynan shu ishlatiladi, keyin brauzer soatiga o'tadi.
 */
export function useNow(serverNow?: number): number {
  // serverNow berilmasa — komponent faqat brauzerda chiziladi (masalan, ochilgan oyna ichida)
  return useSyncExternalStore(subscribe, getSnapshot, () => serverNow ?? 0);
}
