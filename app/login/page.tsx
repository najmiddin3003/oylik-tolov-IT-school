import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { activeStaffRoles } from "@/lib/staff";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Kirish" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Tizimga kirish"
      subtitle="Telefon raqamingiz va parolingizni kiriting. Bir marta kirsangiz, brauzer 30 kun eslab qoladi."
      footer={
        <Link
          href="/register"
          className="group flex items-center gap-3 rounded-2xl border border-line bg-surface/80 px-4 py-3 text-sm shadow-card transition hover:bg-surface"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <UserPlus className="icon-wiggle size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink-900">Ro‘yxatdan o‘tish</span>
            <span className="block text-[13px] text-ink-500">Xodimlar uchun: SMS kod orqali parol yaratish</span>
          </span>
        </Link>
      }
    >
      <Suspense fallback={<LoginForm legacyHint={false} />}>
        <LoginFormWithHint />
      </Suspense>
    </AuthShell>
  );
}

async function LoginFormWithHint() {
  await connection();
  let legacyHint = false;
  try {
    // Rahbar yoki administrator profili hali faollashmagan bo'lsa — eski umumiy parol ham ishlaydi
    const roles = await activeStaffRoles();
    legacyHint = !roles.has("owner") || !roles.has("admin");
  } catch {
    legacyHint = false;
  }
  return <LoginForm legacyHint={legacyHint} />;
}
