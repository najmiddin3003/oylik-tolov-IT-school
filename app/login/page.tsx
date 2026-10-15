import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { activeStaffRoles } from "@/lib/staff";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Kirish" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Tizimga kirish"
      subtitle="Telefon raqamingiz bilan kiring. Bir marta kirsangiz, brauzer 30 kun eslab qoladi."
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
