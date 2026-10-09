"use client";

import { btn } from "@/components/ui";

// Sahifa ma'lumotini yuklashda xato bo'lsa (masalan, bazaga ulanib bo'lmasa) — tushunarli xabar.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isDb = /mongo|querySrv|ECONNREFUSED|ETIMEOUT|ENOTFOUND|server selection/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
      <p className="text-base font-semibold text-slate-900">
        {isDb ? "Ma'lumotlar bazasiga ulanib bo'lmadi" : "Sahifani yuklashda xato yuz berdi"}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        {isDb
          ? "Internet aloqasini va .env.local dagi MONGODB_URI ni tekshiring. MongoDB Atlas'da «Network Access» bo'limida kompyuteringiz IP manzili ruxsat etilganiga ishonch hosil qiling."
          : "Birozdan keyin qayta urinib ko'ring. Xato takrorlansa, bazaga ulanishni (MONGODB_URI) tekshiring."}
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-slate-400">Kod: {error.digest}</p> : null}
      <button type="button" onClick={reset} className={`${btn.primary} mt-5`}>
        Qayta urinish
      </button>
    </div>
  );
}
