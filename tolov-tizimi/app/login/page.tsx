import type { Metadata } from "next";
import { LogoMark } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Kirish" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark className="mx-auto mb-4 size-12" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">To&apos;lov nazorati</h1>
          <p className="mt-1 text-sm text-slate-500">O&apos;quv markaz to&apos;lovlari tizimiga kirish</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
