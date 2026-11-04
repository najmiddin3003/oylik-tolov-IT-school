"use client";

// Tezlik o'lchovi (brauzer): sahifa mazmuni (yuklanish skeleti emas) ekranga chiqqan paytni ushlaydi —
// sayt birinchi ochilganda (load: sahifa so'ralgandan ishlatsa bo'ladigan bo'lguncha) va sahifaga o'tilganda
// (nav: bosilgandan mazmun chiqquncha; boshlanish vaqtini instrumentation-client.ts qo'yadi). /api/perf ga yuboradi.
import { useEffect } from "react";
import { perfRoute } from "@/lib/perf-rules";

type NavStart = { url: string; t: number };

/** Sahifa skeleti (components/ui.tsx PageSkeleton) — bor ekan, mazmun hali chiqmagan */
const SKELETON = "[data-page-skeleton]";
/** Bundan uzoq kutilgan o'tish — tashlab ketilgan (boshqa sahifaga yo'naltirilgan va h.k.) */
const NAV_TIMEOUT_MS = 60_000;

function send(data: Record<string, unknown>) {
  const body = JSON.stringify(data);
  try {
    if (navigator.sendBeacon?.("/api/perf", body)) return;
  } catch {
    // sendBeacon yo'q yoki rad etdi — oddiy so'rov bilan
  }
  fetch("/api/perf", { method: "POST", body, keepalive: true }).catch(() => {});
}

export function PerfWatcher() {
  useEffect(() => {
    const w = window as unknown as { __perfNav?: NavStart };
    let loadDone = false;
    const check = () => {
      const nav = w.__perfNav;
      if (!nav && loadDone) return;
      if (nav && performance.now() - nav.t > NAV_TIMEOUT_MS) {
        w.__perfNav = undefined;
        return;
      }
      if (document.querySelector(SKELETON)) return;
      const route = perfRoute(location.pathname);
      if (nav) {
        const target = new URL(nav.url);
        if (target.pathname + target.search !== location.pathname + location.search) return;
        w.__perfNav = undefined;
        loadDone = true;
        if (route) send({ route, kind: "nav", ms: performance.now() - nav.t });
        return;
      }
      loadDone = true;
      // Orqa fonda ochilgan varaqda vaqt cho'ziladi — bunday ochilish hisobga olinmaydi
      if (document.visibilityState !== "visible") return;
      const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (route) send({ route, kind: "load", ms: performance.now(), ttfb: entry ? entry.responseStart : null });
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    // Manzil DOM o'zgarishidan keyinroq yangilansa ham ushlab qolish uchun
    const timer = setInterval(check, 150);
    check();
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);
  return null;
}
