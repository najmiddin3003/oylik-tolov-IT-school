// Menyu bandlari — server va client komponentlar birga ishlatadi (shuning uchun "use client" yo'q).
import {
  CircleUserRound,
  Crown,
  FileSpreadsheet,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  Rocket,
  Settings2,
  UsersRound,
  Users,
  Coins,
  Wallet,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/session";
import type { Tone } from "./ui";

export type NavKey = "home" | "students" | "debtors" | "payments" | "kassa" | "salary" | "staff" | "sync" | "settings" | "roadmap" | "me";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  tone: Tone;
  monthAware: boolean;
  roles: Role[];
  /** Rolga qarab boshqacha nom yoki ikonka (masalan, rahbarda «Rahbar paneli») */
  per?: Partial<Record<Role, { label?: string; short?: string; icon?: LucideIcon; tone?: Tone }>>;
  /** false — telefondagi pastki menyuda ko'rsatilmaydi (joy tor; yuqoridagi profil menyusida bor) */
  mobile?: false;
};

export const NAV: NavItem[] = [
  {
    key: "home",
    href: "/",
    label: "Bosh sahifa",
    short: "Bosh sahifa",
    icon: LayoutDashboard,
    tone: "brand",
    monthAware: true,
    roles: ["owner", "teacher"],
    per: { owner: { label: "Rahbar paneli", short: "Panel", icon: Crown, tone: "amber" } },
  },
  {
    key: "students",
    href: "/students",
    label: "O‘quvchilar",
    short: "O‘quvchilar",
    icon: Users,
    tone: "violet",
    monthAware: true,
    roles: ["owner", "teacher"],
    per: { teacher: { label: "O‘quvchilarim", short: "O‘quvchilar" } },
  },
  { key: "debtors", href: "/qarzdorlar", label: "Qarzdorlar", short: "Qarzdorlar", icon: UserX, tone: "rose", monthAware: true, roles: ["owner", "admin", "teacher"] },
  { key: "payments", href: "/payments", label: "To‘lovlar", short: "To‘lovlar", icon: Wallet, tone: "emerald", monthAware: true, roles: ["owner", "admin", "teacher"] },
  { key: "kassa", href: "/kassa", label: "Kassa", short: "Kassa", icon: Coins, tone: "orange", monthAware: false, roles: ["owner", "admin"] },
  {
    key: "salary",
    href: "/olinganlar",
    label: "Olingan avans/oylik",
    short: "Avans",
    icon: HandCoins,
    tone: "violet",
    monthAware: false,
    roles: ["admin", "teacher"],
  },
  { key: "staff", href: "/staff", label: "Xodimlar", short: "Xodimlar", icon: UsersRound, tone: "sky", monthAware: true, roles: ["owner"] },
  { key: "sync", href: "/sync", label: "Google Sheets", short: "Sheets", icon: FileSpreadsheet, tone: "teal", monthAware: false, roles: ["owner"], mobile: false },
  { key: "settings", href: "/settings", label: "Sozlamalar", short: "Sozlamalar", icon: Settings2, tone: "amber", monthAware: true, roles: ["owner"], mobile: false },
  { key: "roadmap", href: "/reja", label: "Reja va yangiliklar", short: "Reja", icon: Rocket, tone: "rose", monthAware: false, roles: ["owner"], mobile: false },
  { key: "me", href: "/me", label: "Profilim", short: "Profilim", icon: CircleUserRound, tone: "rose", monthAware: true, roles: ["admin", "teacher"] },
];

/** Foydalanuvchi turi: menyu va yuqori paneldagi belgi uchun. */
export const ROLE_INFO: Record<Role, { letter: string; name: string; hint: string; icon: LucideIcon }> = {
  owner: { letter: "R", name: "Rahbar", hint: "Markaz rahbari", icon: Crown },
  admin: { letter: "A", name: "Administrator", hint: "To‘lovlar bo‘limi", icon: Wallet },
  teacher: { letter: "O", name: "O‘qituvchi", hint: "O‘quvchilar va oylik", icon: GraduationCap },
};

/** Rol uchun menyu bandlari (rolga xos nom va ikonka bilan). */
export function navFor(role: Role): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role)).map((n) => ({ ...n, ...(n.per?.[role] ?? {}) }));
}

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sahifa nomi (yuqoridagi yo'l ko'rsatkich uchun). */
export function pageTitle(pathname: string, role?: Role): { section: string; sectionHref: string; page?: string } {
  if (pathname.startsWith("/students/new")) return { section: "O‘quvchilar", sectionHref: "/students", page: "Yangi o‘quvchi" };
  if (/^\/students\/[^/]+\/edit/.test(pathname)) return { section: "O‘quvchilar", sectionHref: "/students", page: "Tahrirlash" };
  if (/^\/students\/[^/]+/.test(pathname)) return { section: "O‘quvchilar", sectionHref: "/students", page: "Profil" };
  if (/^\/staff\/[^/]+/.test(pathname)) return { section: "Xodimlar", sectionHref: "/staff", page: "Xodim" };
  if (pathname.startsWith("/faoliyat")) return { section: "Faoliyat tarixi", sectionHref: "/faoliyat" };
  const items = role ? navFor(role) : NAV;
  const item = items.find((n) => isActivePath(pathname, n.href));
  return { section: item?.label ?? "Bosh sahifa", sectionHref: item?.href ?? "/" };
}
