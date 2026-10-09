"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NavIcon } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  if (variant === "bottom") {
    return (
      <>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand-600" : "text-slate-500"}`}
            >
              <NavIcon d={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </>
    );
  }
  return (
    <>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <NavIcon d={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
