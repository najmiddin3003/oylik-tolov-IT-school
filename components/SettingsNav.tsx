"use client";

// Sozlamalar sahifasidagi bo'limlar menyusi: bosilganda silliq o'tadi, aylantirilganda qaysi bo'limda turgani belgilanadi.
import { useEffect, useState } from "react";
import { BookOpen, Building2, KeyRound, MessageSquareText, SlidersHorizontal, Tags, type LucideIcon } from "lucide-react";
import { cx, IconTile, type Tone } from "./ui";

export const SETTINGS_SECTIONS: { id: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { id: "kurslar", label: "Kurslar", icon: BookOpen, tone: "emerald" },
  { id: "narx", label: "Oylik to‘lov narxi", icon: Tags, tone: "violet" },
  { id: "funksiyalar", label: "Funksiyalar", icon: SlidersHorizontal, tone: "brand" },
  { id: "parollar", label: "Parollar", icon: KeyRound, tone: "amber" },
  { id: "sms", label: "SMS eslatma", icon: MessageSquareText, tone: "sky" },
  { id: "umumiy", label: "Umumiy", icon: Building2, tone: "slate" },
];

/** Qaysi bo'lim ko'rinib turibdi: yuqori panel ostidagi chiziqdan o'tgan eng oxirgi bo'lim. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const pick = () => {
      const line = 120; // yuqori panel balandligi + biroz joy
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top - line <= 0) current = el.id;
      // Sahifa oxiriga yetilganda — oxirgi bo'lim
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els[els.length - 1].id;
      setActive(current);
    };
    // URL dagi #bo'lim bilan ochilsa — o'sha (birinchi kadrdan keyin)
    let raf = requestAnimationFrame(() => {
      const fromHash = window.location.hash.slice(1);
      if (ids.includes(fromHash)) setActive(fromHash);
      else pick();
    });
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);
  return [active, setActive] as const;
}

const IDS = SETTINGS_SECTIONS.map((s) => s.id);

export function SettingsNav() {
  const [active, setActive] = useActiveSection(IDS);
  return (
    <>
      {/* Kompyuter: chapda yopishqoq menyu */}
      <nav className="hidden xl:block" aria-label="Sozlamalar bo‘limlari">
        <ul className="sticky top-24 grid gap-1">
          {SETTINGS_SECTIONS.map((s) => {
            const on = s.id === active;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  aria-current={on ? "location" : undefined}
                  className={cx(
                    "group relative flex items-center gap-3 rounded-xl px-2 py-2 text-[15px] font-medium transition",
                    on ? "bg-surface text-ink-900 shadow-card ring-1 ring-line" : "text-ink-600 hover:bg-surface/70 hover:text-ink-900",
                  )}
                >
                  {on ? <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" aria-hidden /> : null}
                  <IconTile icon={s.icon} tone={s.tone} size="sm" variant={on ? "solid" : "soft"} />
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Telefon va planshet: yuqorida yopishqoq gorizontal menyu */}
      <nav className="sticky top-16 z-10 -mx-4 mb-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-line bg-canvas/90 px-4 py-2 backdrop-blur xl:hidden" aria-label="Sozlamalar bo‘limlari">
        <ul className="flex gap-1.5">
          {SETTINGS_SECTIONS.map((s) => {
            const on = s.id === active;
            return (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  aria-current={on ? "location" : undefined}
                  className={cx(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition",
                    on ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-600 ring-line",
                  )}
                >
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
