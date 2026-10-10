"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { btn } from "@/components/ui";

// Sahifa ma'lumotini yuklashda xato bo'lsa (masalan, bazaga ulanib bo'lmasa) — tushunarli xabar.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isDb = /mongo|querySrv|ECONNREFUSED|ETIMEOUT|ENOTFOUND|server selection/i.test(error.message);
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-card">
      <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600" aria-hidden>
        <TriangleAlert className="size-6" strokeWidth={1.8} />
      </span>
      <p className="text-lg font-semibold text-ink-900">{isDb ? "Ma’lumotlar bazasiga ulanib bo‘lmadi" : "Sahifani yuklashda xato yuz berdi"}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        {isDb
          ? "Internet aloqasini va MONGODB_URI sozlamasini tekshiring. MongoDB Atlas’da «Network Access» bo‘limida server IP manzili ruxsat etilganiga ishonch hosil qiling."
          : "Birozdan keyin qayta urinib ko‘ring. Xato takrorlansa, bazaga ulanishni (MONGODB_URI) tekshiring."}
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-ink-400">Kod: {error.digest}</p> : null}
      <button type="button" onClick={reset} className={`${btn.primary} mt-6`}>
        <RefreshCw className="size-4" aria-hidden />
        Qayta urinish
      </button>
    </div>
  );
}
