// Menyu bandlari — server va client komponentlar birga ishlatadi (shuning uchun "use client" yo'q).
import { CreditCard, LayoutGrid, Sheet, Users, type LucideIcon } from "lucide-react";

export type NavKey = "home" | "students" | "payments" | "sync";

export const NAV: { key: NavKey; href: string; label: string; short: string; icon: LucideIcon; monthAware: boolean }[] = [
  { key: "home", href: "/", label: "Bosh sahifa", short: "Bosh sahifa", icon: LayoutGrid, monthAware: true },
  { key: "students", href: "/students", label: "O‘quvchilar", short: "O‘quvchilar", icon: Users, monthAware: true },
  { key: "payments", href: "/payments", label: "To‘lovlar", short: "To‘lovlar", icon: CreditCard, monthAware: true },
  { key: "sync", href: "/sync", label: "Google Sheets", short: "Sheets", icon: Sheet, monthAware: false },
];

export type NavCounts = { students: number; payments: number; sync: "ok" | "warn" | "error" | "off" };

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sahifa nomi (yuqoridagi yo'l ko'rsatkich uchun). */
export function pageTitle(pathname: string): { section: string; sectionHref: string; page?: string } {
  if (pathname.startsWith("/students/new")) return { section: "O‘quvchilar", sectionHref: "/students", page: "Yangi o‘quvchi" };
  if (/^\/students\/[^/]+\/edit/.test(pathname)) return { section: "O‘quvchilar", sectionHref: "/students", page: "Tahrirlash" };
  if (/^\/students\/[^/]+/.test(pathname)) return { section: "O‘quvchilar", sectionHref: "/students", page: "Profil" };
  const item = NAV.find((n) => isActivePath(pathname, n.href));
  return { section: item?.label ?? "Bosh sahifa", sectionHref: item?.href ?? "/" };
}
