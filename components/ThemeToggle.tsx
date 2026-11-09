"use client";

// Yorug' / qorong'i mavzu (akkaunt menyusida almashtiriladi). Tanlov shu brauzerda saqlanadi.
import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-state";

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
