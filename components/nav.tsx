// Menyu bandlari va ikonka — server va client komponentlar birga ishlatadi (shuning uchun "use client" yo'q).
export const NAV = [
  { href: "/", label: "Bosh sahifa", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/students", label: "O'quvchilar", icon: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.87M16 2.13a4 4 0 010 7.75" },
  { href: "/payments", label: "To'lovlar", icon: "M2 7h20v12H2zM2 11h20M6 15h4" },
  { href: "/sync", label: "Google Sheets", icon: "M4 4h16v16H4zM4 10h16M4 15h16M10 4v16" },
];

export function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
