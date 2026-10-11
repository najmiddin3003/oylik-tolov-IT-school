// Menyu bandlari — server va client komponentlar birga ishlatadi (shuning uchun "use client" yo'q).
import { FileSpreadsheet, LayoutDashboard, Settings2, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/session";
import type { Tone } from "./ui";

export type NavKey = "home" | "students" | "payments" | "sync" | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  tone: Tone;
  monthAware: boolean;
  roles: Role[];
};

export const NAV: NavItem[] = [
  { key: "home", href: "/", label: "Bosh sahifa", short: "Bosh sahifa", icon: LayoutDashboard, tone: "brand", monthAware: true, roles: ["owner"] },
  { key: "students", href: "/students", label: "O‘quvchilar", short: "O‘quvchilar", icon: Users, tone: "violet", monthAware: true, roles: ["owner"] },
  { key: "payments", href: "/payments", label: "To‘lovlar", short: "To‘lovlar", icon: Wallet, tone: "emerald", monthAware: true, roles: ["owner", "admin"] },
  { key: "sync", href: "/sync", label: "Google Sheets", short: "Sheets", icon: FileSpreadsheet, tone: "teal", monthAware: false, roles: ["owner"] },
  { key: "settings", href: "/settings", label: "Sozlamalar", short: "Sozlamalar", icon: Settings2, tone: "amber", monthAware: true, roles: ["owner"] },
];

/** Foydalanuvchi turi: menyu va yuqori paneldagi belgi uchun. */
export const ROLE_INFO: Record<Role, { letter: string; name: string; hint: string }> = {
  owner: { letter: "R", name: "Rahbar", hint: "Markaz rahbari" },
  admin: { letter: "A", name: "Administrator", hint: "To‘lovlar bo‘limi" },
};

export function navFor(role: Role): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}

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
