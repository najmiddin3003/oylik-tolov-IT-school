import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { deleteStudent } from "@/app/actions/students";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, EmptyState, inputCls, PageHeader, PageSkeleton, StatusBadge, Tag, td, th } from "@/components/ui";
import { listGroups, listStudents } from "@/lib/data";
import { formatMoney, monthLabel } from "@/lib/time";
import { pageGuard } from "@/lib/auth";

export const metadata: Metadata = { title: "O'quvchilar" };

export default function StudentsPage({ searchParams }: PageProps<"/students">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Students searchParams={searchParams} />
    </Suspense>
  );
}

async function Students({ searchParams }: { searchParams: PageProps<"/students">["searchParams"] }) {
  await pageGuard();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const group = typeof sp.group === "string" ? sp.group : "";
  const status = sp.status === "inactive" || sp.status === "all" ? sp.status : "active";
  const [{ rows, month }, groups] = await Promise.all([listStudents({ q, group, status }), listGroups()]);

  return (
    <>
      <PageHeader
        title="O'quvchilar"
        subtitle={`${rows.length} ta o'quvchi · to'lov holati ${monthLabel(month)} bo'yicha`}
        actions={
          <Link href="/students/new" className={btn.primary}>
            + Yangi o&apos;quvchi
          </Link>
        }
      />

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_170px_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Ism, telefon yoki guruh bo'yicha qidirish…" className={inputCls} aria-label="Qidirish" />
        <select name="group" defaultValue={group} className={inputCls} aria-label="Guruh">
          <option value="">Barcha guruhlar</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={inputCls} aria-label="Holat">
          <option value="active">Faol o&apos;quvchilar</option>
          <option value="inactive">Nofaol</option>
          <option value="all">Hammasi</option>
        </select>
        <button type="submit" className={btn.secondary}>
          Qidirish
        </button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title={q || group ? "Hech narsa topilmadi" : "Hali o'quvchi qo'shilmagan"}>
            {q || group ? (
              "Qidiruv shartlarini o'zgartirib ko'ring."
            ) : (
              <Link href="/students/new" className="font-medium text-brand-600 hover:underline">
                Birinchi o&apos;quvchini qo&apos;shing
              </Link>
            )}
          </EmptyState>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className={th}>O&apos;quvchi</th>
                  <th className={th}>Guruh</th>
                  <th className={`${th} text-right`}>Oylik to&apos;lov</th>
                  <th className={th}>{monthLabel(month)}</th>
                  <th className={`${th} text-right`}>Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className={`hover:bg-slate-50/60 ${r.active ? "" : "opacity-60"}`}>
                    <td className={td}>
                      <Link href={`/students/${r.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {r.fullName}
                      </Link>
                      <span className="num block text-xs text-slate-500">{r.phone || "telefon yo'q"}</span>
                    </td>
                    <td className={`${td} text-slate-500`}>{r.group || "—"}</td>
                    <td className={`${td} num whitespace-nowrap text-right`}>{formatMoney(r.monthlyFee)}</td>
                    <td className={td}>
                      {!r.active ? <Tag>Nofaol</Tag> : !r.started ? <Tag tone="brand">Hali boshlamagan</Tag> : <StatusBadge status={r.status} />}
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/students/${r.id}`} className={btn.ghost}>
                          Ko&apos;rish
                        </Link>
                        <Link href={`/students/${r.id}/edit`} className={btn.ghost}>
                          Tahrirlash
                        </Link>
                        <ConfirmAction
                          action={deleteStudent.bind(null, r.id, null)}
                          confirmText={`${r.fullName} va uning barcha to'lovlari o'chirib yuborilsinmi? Bu amalni qaytarib bo'lmaydi.`}
                          className={`${btn.ghost} text-rose-600 hover:bg-rose-50 hover:text-rose-700`}
                          pendingText="…"
                        >
                          O&apos;chirish
                        </ConfirmAction>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
