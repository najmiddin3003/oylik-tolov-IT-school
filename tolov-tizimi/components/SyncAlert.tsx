import Link from "next/link";
import { getSyncAlert } from "@/lib/data";
import { formatDateTime } from "@/lib/time";
import { pageGuard } from "@/lib/auth";

/** Oxirgi Sheets tekshiruvida farq yoki xato bo'lsa — har sahifa tepasida ogohlantirish. */
export async function SyncAlert() {
  await pageGuard();
  const alert = await getSyncAlert();
  if (!alert) return null;

  const isError = Boolean(alert.error);
  return (
    <Link
      href="/sync"
      className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
        isError
          ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100/70"
          : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100/70"
      }`}
    >
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">
          {isError
            ? "Google Sheets bilan tekshiruv bajarilmadi"
            : `Sayt va Google Sheets o'rtasida ${alert.unresolved} ta farq topildi`}
        </span>
        <span className="block opacity-80">
          {isError ? alert.error : "Qaysi to'lovlar mos kelmayotganini ko'rish uchun bosing."} · Tekshiruv:{" "}
          {formatDateTime(alert.at)}
        </span>
      </span>
      <span className="shrink-0 self-center font-medium" aria-hidden>
        →
      </span>
    </Link>
  );
}
