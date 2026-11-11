import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceiptActions } from "@/components/ReceiptActions";
import { roleGuard } from "@/lib/auth";
import { getReceipt, type Receipt } from "@/lib/data";
import { formatDate, formatDateTime, formatMoney, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "To‘lov cheki" };

const METHOD: Record<Receipt["method"], string> = { naqd: "Naqd", karta: "Karta", otkazma: "O‘tkazma" };

export default function ReceiptPage({ params, searchParams }: PageProps<"/chek/[id]">) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0 dark:bg-slate-950">
      <Suspense fallback={null}>
        <ReceiptView params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReceiptView({ params, searchParams }: { params: PageProps<"/chek/[id]">["params"]; searchParams: PageProps<"/chek/[id]">["searchParams"] }) {
  const { role } = await roleGuard(["owner", "admin", "teacher"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await getReceipt(id);
  if (!r) notFound();
  const backHref = role === "admin" ? "/payments" : `/students/${r.student.id}`;
  const no = r.no ? String(r.no).padStart(6, "0") : r.id.slice(-8).toUpperCase();
  return (
    <>
      {/* Chop etishda: A5 varaq, faqat chek */}
      <style>{`@page { size: A5 portrait; margin: 10mm; }`}</style>
      <ReceiptActions autoPrint={sp.print === "1"} backHref={backHref} />
      <article className="mx-auto w-full max-w-[440px] rounded-2xl bg-white px-7 py-8 text-[14px] leading-relaxed text-slate-900 shadow-xl ring-1 ring-slate-200 print:max-w-none print:rounded-none print:shadow-none print:ring-0 [font-family:Arial,Helvetica,sans-serif]">
        <header className="border-b border-dashed border-slate-300 pb-4 text-center">
          <p className="text-[18px] font-bold">{r.centerName}</p>
          <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-slate-500">To‘lov cheki</p>
          <p className="mt-2 font-mono text-[15px] font-semibold">№ {no}</p>
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-b border-dashed border-slate-300 py-4">
          <Row label="O‘quvchi" value={`${r.student.name}${r.student.seq ? ` (#${String(r.student.seq).padStart(3, "0")})` : ""}`} strong />
          {r.student.group ? <Row label="Kurs" value={r.student.group} /> : null}
          {r.teacherName ? <Row label="O‘qituvchi" value={r.teacherName} /> : null}
          <Row label="To‘langan sana" value={formatDate(r.paidAt)} />
          <Row label="Kiritilgan" value={formatDateTime(r.createdAt)} />
          <Row label="To‘lov usuli" value={METHOD[r.method]} />
          <Row label="Qabul qildi" value={r.receivedBy} />
        </dl>

        <table className="w-full border-b border-dashed border-slate-300 py-2">
          <thead>
            <tr className="text-[12px] text-slate-500">
              <th className="py-2 text-left font-medium">Qaysi oy uchun</th>
              <th className="py-2 text-right font-medium">Summa</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((it) => (
              <tr key={it.month} className={it.archived ? "text-slate-400 line-through" : ""}>
                <td className="py-1">{monthLabel(it.month)}</td>
                <td className="py-1 text-right font-mono">{formatMoney(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="flex items-baseline justify-between py-4 text-[17px] font-bold">
          <span>Jami</span>
          <span className="font-mono">{formatMoney(r.total)}</span>
        </p>
        {r.items.some((it) => it.archived) ? <p className="-mt-2 pb-3 text-[12px] text-rose-600">Chizilgan qator — to‘lov bekor qilingan (arxivda).</p> : null}
        {r.note ? <p className="border-t border-dashed border-slate-300 pt-3 text-[13px] text-slate-600">Izoh: {r.note}</p> : null}

        <footer className="mt-6 grid grid-cols-2 gap-6 text-[12px] text-slate-500">
          <p className="border-t border-slate-300 pt-1">Qabul qiluvchi imzosi</p>
          <p className="border-t border-slate-300 pt-1">To‘lovchi imzosi</p>
        </footer>
        <p className="mt-6 text-center text-[12px] text-slate-400">To‘lovingiz uchun rahmat!</p>
      </article>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "text-right font-semibold" : "text-right"}>{value}</dd>
    </>
  );
}
