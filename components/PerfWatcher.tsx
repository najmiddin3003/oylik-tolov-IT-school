"use client";

// Tezlik o'lchovi (brauzer): sahifa mazmuni (yuklanish skeleti emas) ekranga chiqqan paytni ushlaydi —
// sayt birinchi ochilganda (load: sahifa so'ralgandan ishlatsa bo'ladigan bo'lguncha) va sahifaga o'tilganda
// (nav: bosilgandan mazmun chiqquncha; boshlanish vaqtini instrumentation-client.ts qo'yadi). /api/perf ga yuboradi.
// Vaqt bo'laklari ham yuboriladi: serverdan birinchi javob (ttfb), server ma'lumoti to'liq kelguncha (wait) va yangi
// ulanish o'rnatish (conn) — qolgani brauzerda chizish.
import { useEffect } from "react";
import { perfRoute } from "@/lib/perf-rules";

type NavStart = { url: string; t: number };

/** Sahifa skeleti (components/ui.tsx PageSkeleton) — bor ekan, mazmun hali chiqmagan */
const SKELETON = "[data-page-skeleton]";
/** Bundan uzoq kutilgan o'tish — tashlab ketilgan (boshqa sahifaga yo'naltirilgan va h.k.) */
const NAV_TIMEOUT_MS = 60_000;
/** Mazmun chiqqandan keyin so'rov vaqtlari brauzerda yozilib bo'lishini kutish */
const REPORT_DELAY_MS = 1500;

function send(data: Record<string, unknown>) {
  const body = JSON.stringify(data);
  try {
    if (navigator.sendBeacon?.("/api/perf", body)) return;
  } catch {
    // sendBeacon yo'q yoki rad etdi — oddiy so'rov bilan
  }
  fetch("/api/perf", { method: "POST", body, keepalive: true }).catch(() => {});
}

/** Sahifaga o'tishda server ma'lumotini olgan so'rovlar (Next.js `?_rsc=` bilan so'raydi) */
function isRscFetch(e: PerformanceResourceTiming): boolean {
  return e.initiatorType === "fetch" && e.name.includes("_rsc=");
}

/** Yangi ulanish o'rnatish vaqti (DNS, TCP, TLS); avvalgi ulanish ishlatilgan bo'lsa — 0 */
function connTime(e: PerformanceResourceTiming | PerformanceNavigationTiming): number {
  return e.connectEnd > 0 && e.domainLookupStart > 0 ? Math.max(0, e.connectEnd - e.domainLookupStart) : 0;
}

export function PerfWatcher() {
  useEffect(() => {
    const w = window as unknown as { __perfNav?: NavStart };
    // Oxirgi server so'rovlari (o'tish bo'laklarini hisoblash uchun)
    const rsc: PerformanceResourceTiming[] = [];
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries() as PerformanceResourceTiming[]) {
          if (!isRscFetch(e)) continue;
          rsc.push(e);
          if (rsc.length > 50) rsc.shift();
        }
      });
      observer.observe({ type: "resource" });
    } catch {
      // Brauzer qo'llamasa — faqat umumiy vaqt yuboriladi
    }
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, REPORT_DELAY_MS);
      timers.add(id);
    };

    const reportNav = (route: string, nav: NavStart, doneAt: number) => {
      const path = new URL(nav.url).pathname;
      later(() => {
        const mine = rsc.filter((e) => e.startTime >= nav.t - 20 && e.startTime <= doneAt && new URL(e.name).pathname === path);
        const data: Record<string, unknown> = { route, kind: "nav", ms: doneAt - nav.t };
        if (mine.length) {
          const end = Math.max(...mine.map((e) => e.responseEnd));
          const first = Math.min(...mine.map((e) => e.responseStart || e.responseEnd));
          data.wait = Math.min(end, doneAt) - nav.t;
          data.ttfb = first - nav.t;
          data.conn = Math.max(...mine.map(connTime));
        }
        send(data);
      });
    };

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
        if (route) reportNav(route, nav, performance.now());
        return;
      }
      loadDone = true;
      // Orqa fonda ochilgan varaqda vaqt cho'ziladi — bunday ochilish hisobga olinmaydi
      if (document.visibilityState !== "visible") return;
      const ms = performance.now();
      const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (route) {
        send({
          route,
          kind: "load",
          ms,
          ...(entry ? { ttfb: entry.responseStart, wait: entry.responseEnd || null, conn: connTime(entry) } : {}),
        });
      }
    };
    const mutations = new MutationObserver(check);
    mutations.observe(document.body, { childList: true, subtree: true });
    // Manzil DOM o'zgarishidan keyinroq yangilansa ham ushlab qolish uchun
    const timer = setInterval(check, 150);
    check();
    return () => {
      mutations.disconnect();
      observer?.disconnect();
      clearInterval(timer);
      timers.forEach(clearTimeout);
    };
  }, []);
  return null;
}
