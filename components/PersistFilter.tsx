"use client";

// Filtr tanlovini brauzerda (localStorage) eslab qolish: sahifa yangilansa yoki qayta ochilsa ham o'sha filtr qo'yiladi.
// Manzilda parametr yo'q bo'lsa (yangi ochilish) — saqlangan qiymat qo'yiladi; tanlansa — saqlanadi.
// «Hammasi» ham alohida qiymat bilan saqlanadi (aks holda yangi ochilish bilan farqlab bo'lmaydi).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function PersistFilter({ param, storageKey }: { param: string; storageKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param);
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (current === null) {
      if (stored) {
        const sp = new URLSearchParams(params.toString());
        sp.set(param, stored);
        router.replace(`${pathname}?${sp}`, { scroll: false });
      }
      return;
    }
    try {
      localStorage.setItem(storageKey, current);
    } catch {
      // saqlab bo'lmasa — oddiy filtr bo'lib ishlayveradi
    }
  }, [current, param, params, pathname, router, storageKey]);
  return null;
}
