"use client";

// Yorug' / qorong'i mavzu tugmasi (yuqori panelda). Tanlov shu brauzerda saqlanadi.
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "./theme-state";
import { cx } from "./ui";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

export function setTheme(dark: boolean) {
  const root = document.documentElement;
  // Ranglar silliq o'tishi uchun qisqa muddatga belgi qo'yiladi
  root.setAttribute("data-theme-switching", "");
  root.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // saqlab bo'lmasa ham shu sahifada ishlaydi
  }
  window.setTimeout(() => root.removeAttribute("data-theme-switching"), 300);
}

export function useIsDark() {
  return useSyncExternalStore(subscribe, isDark, () => false);
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark();
  const label = dark ? "Yorug‘ mavzuga o‘tish" : "Qorong‘i mavzuga o‘tish";
  return (
    <button
      type="button"
      onClick={() => setTheme(!dark)}
      aria-label={label}
      title={label}
      className={cx(
        "group relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full text-ink-500 transition hover:bg-slate-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-brand-600",
        className,
      )}
    >
      <Sun
        className={cx("absolute size-5 transition-all duration-300", dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0")}
        strokeWidth={1.8}
        aria-hidden
      />
      <Moon
        className={cx("absolute size-[19px] transition-all duration-300", dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")}
        strokeWidth={1.8}
        aria-hidden
      />
    </button>
  );
}
