import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Ro‘yxatdan o‘tish" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <Suspense fallback={<Shell reset={false} />}>
      <RegisterView searchParams={searchParams} />
    </Suspense>
  );
}

async function RegisterView({ searchParams }: { searchParams: PageProps<"/register">["searchParams"] }) {
  const sp = await searchParams;
  return <Shell reset={sp.reset === "1"} />;
}

function Shell({ reset }: { reset: boolean }) {
  return (
    <AuthShell
      title={reset ? "Parolni tiklash" : "Ro‘yxatdan o‘tish"}
      subtitle={
        reset
          ? "Telefon raqamingizga SMS kod yuboriladi. Kodni kiritib, yangi parol yaratasiz."
          : "Rahbar sizni «Xodimlar» bo‘limida qo‘shgan bo‘lishi kerak. Telefon raqamingizga SMS kod keladi — uni kiritib, o‘zingiz parol yaratasiz."
      }
      footer={
        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-800">
          <ArrowLeft className="size-4" aria-hidden />
          Kirish sahifasiga qaytish
        </Link>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
