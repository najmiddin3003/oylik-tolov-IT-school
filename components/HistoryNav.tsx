"use client";

// Yuqori paneldagi «Orqaga / Oldinga» tugmalari: kirilgan sahifalar orasida yurish. Tarix localStorage da (har xodimga
// alohida kalit) — sahifa yangilansa yoki brauzer yopilib ochilsa ham saqlanadi. Qoidalar: lib/nav-history.ts.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { arriveAt, canGoBack, canGoForward, parseNavHistory, pathOf, recordPop, recordVisit, type NavHistory } from "@/lib/nav-history";
import type { Role } from "@/lib/session";
import { pageTitle } from "./nav";

// localStorage ishlamasa (yashirin rejim, bloklangan) — shu oyna ochiq turguncha xotirada
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function save(key: string, h: NavHistory) {
  const raw = JSON.stringify(h);
  memory.set(key, raw);
  try {
    localStorage.setItem(key, raw);
  } catch {
    // xotirada qoladi
  }
  for (const l of listeners) l();
}

// Qanday o'tildi — modul darajasida (sahifa almashganda komponent qayta yaratilsa ham yo'qolmaydi):
// bizning tugma bilan qaysi qadamga ketilyapti yoki brauzerning o'z «orqaga / oldinga» tugmasi bosildimi (qaysi manzilga).
let pendingNav: { key: string; target: number } | null = null;
let poppedTo: string | null = null;
let popListening = false;

function listenPopstate() {
  if (popListening) return;
  popListening = true;
  window.addEventListener("popstate", () => {
    poppedTo = location.pathname + location.search;
  });
}

const btn =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-slate-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-35";

export function HistoryNav({ storageKey, role }: { storageKey: string; role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const url = query ? `${pathname}?${query}` : pathname;

  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange);
      // Boshqa oynada (tab) yozilgan tarix
      const onStorage = (e: StorageEvent) => {
        if (e.key === storageKey) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [storageKey],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(storageKey),
    () => null,
  );
  const h = useMemo(() => parseNavHistory(raw), [raw]);

  useEffect(listenPopstate, []);

  // Har bir o'tishda tarixni yangilash
  useEffect(() => {
    const current = parseNavHistory(readRaw(storageKey));
    const target = pendingNav?.key === storageKey ? pendingNav.target : null;
    const next = target !== null ? arriveAt(current, target, url) : poppedTo === url ? recordPop(current, url) : recordVisit(current, url);
    pendingNav = null;
    poppedTo = null;
    if (JSON.stringify(next) !== JSON.stringify(current)) save(storageKey, next);
  }, [url, storageKey]);

  const go = (target: number) => {
    const dest = h.entries[target];
    if (dest === undefined) return;
    if (dest === url) {
      save(storageKey, { ...h, index: target });
      return;
    }
    pendingNav = { key: storageKey, target };
    router.push(dest);
  };

  const label = (u: string) => {
    const t = pageTitle(pathOf(u), role);
    return t.page ?? t.section;
  };
  const back = canGoBack(h) ? h.entries[h.index - 1] : undefined;
  const forward = canGoForward(h) ? h.entries[h.index + 1] : undefined;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Kirilgan sahifalar">
      <button
        type="button"
        className={btn}
        disabled={!back}
        onClick={() => go(h.index - 1)}
        title={back ? `Orqaga: ${label(back)}` : "Orqaga"}
        aria-label={back ? `Orqaga: ${label(back)}` : "Orqaga"}
      >
        <ArrowLeft className="size-[18px]" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className={btn}
        disabled={!forward}
        onClick={() => go(h.index + 1)}
        title={forward ? `Oldinga: ${label(forward)}` : "Oldinga"}
        aria-label={forward ? `Oldinga: ${label(forward)}` : "Oldinga"}
      >
        <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

/** Yuklanguncha (o'lchami bir xil — sakramasligi uchun). */
export function HistoryNavPlaceholder() {
  const box = "inline-flex size-9 shrink-0 items-center justify-center text-ink-300";
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      <span className={box}>
        <ArrowLeft className="size-[18px]" strokeWidth={2} />
      </span>
      <span className={box}>
        <ArrowRight className="size-[18px]" strokeWidth={2} />
      </span>
    </div>
  );
}
