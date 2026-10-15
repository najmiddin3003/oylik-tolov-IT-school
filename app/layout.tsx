import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SIDEBAR_BOOT_SCRIPT } from "@/components/sidebar-state";
import { THEME_BOOT_SCRIPT } from "@/components/theme-state";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "To‘lov nazorati", template: "%s · To‘lov nazorati" },
  description: "O‘quv markaz uchun to‘lovlarni hisobga olish tizimi",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Yon menyu holati (data-sb, --sb-w) va mavzu (class="dark") sahifa chizilishidan oldin skript orqali qo'yiladi.
    // data-scroll-behavior: sahifa ichida silliq aylanish, sahifalar orasida o'tganda — darhol tepaga.
    <html lang="uz" className={`${inter.variable} h-full antialiased`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
