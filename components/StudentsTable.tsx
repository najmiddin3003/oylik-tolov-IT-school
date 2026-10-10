"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Eye, Pencil, Trash2, UserCheck, UserX, X } from "lucide-react";
import { bulkStudents, deleteStudent } from "@/app/actions/students";
import type { StudentRow } from "@/lib/data";
import { formatMoney } from "@/lib/time";
import { StudentCell } from "./cells";
import { ConfirmAction } from "./SubmitButton";
import { btn, cx, GroupChip, StatusBadge, Tag, td, th } from "./ui";

export function StudentsTable({ rows, month, monthTitle }: { rows: StudentRow[]; month: string; monthTitle: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const visibleSelected = ids.filter((id) => selected.has(id));
  const allChecked = ids.length > 0 && visibleSelected.length === ids.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const run = (action: "activate" | "deactivate" | "delete") => {
    const list = visibleSelected;
    if (!list.length) return;
    if (action === "delete" && !window.confirm(`${list.length} ta o‘quvchi va ularning barcha to‘lovlari o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.`)) return;
    startTransition(async () => {
      await bulkStudents(action, list);
      setSelected(new Set());
    });
  };

  const checkbox = "size-[18px] cursor-pointer rounded-[5px] border-line accent-brand-600";

  return (
    <>
      {visibleSelected.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 bg-brand-50/60 px-6 py-3 text-sm">
          <span className="mr-2 font-semibold text-brand-800">{visibleSelected.length} ta tanlandi</span>
          <button type="button" disabled={pending} onClick={() => run("deactivate")} className={btn.sm}>
            <UserX className="size-4" aria-hidden />
            Nofaol qilish
          </button>
          <button type="button" disabled={pending} onClick={() => run("activate")} className={btn.sm}>
            <UserCheck className="size-4" aria-hidden />
            Faol qilish
          </button>
          <button type="button" disabled={pending} onClick={() => run("delete")} className={cx(btn.sm, "text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700")}>
            <Trash2 className="size-4" aria-hidden />
            O‘chirish
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className={cx(btn.icon, "ml-auto")} aria-label="Tanlovni bekor qilish">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="relative overflow-x-auto border-t border-line-soft">
        <table className="w-full min-w-[920px]">
          <thead className="bg-slate-50/70">
            <tr>
              <th className={cx(th, "w-12 pr-0")}>
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(ids))}
                  aria-label="Hammasini tanlash"
                />
              </th>
              <th className={cx(th, "pl-3")}>O‘quvchi</th>
              <th className={th}>Guruh</th>
              <th className={cx(th, "text-right")}>Oylik to‘lov</th>
              <th className={cx(th, "text-right")}>Qolgan to‘lov</th>
              <th className={th}>{monthTitle}</th>
              <th className={cx(th, "text-right")}>Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <tr key={r.id} className={cx("transition", isSel ? "bg-brand-50/40" : "hover:bg-slate-50/50")}>
                  <td className={cx(td, "w-12 pr-0")}>
                    <input type="checkbox" className={checkbox} checked={isSel} onChange={() => toggle(r.id)} aria-label={`${r.fullName}ni tanlash`} />
                  </td>
                  <td className={cx(td, "pl-3")}>
                    <StudentCell id={r.id} name={r.fullName} seq={r.seq} phone={r.phone} href={`/students/${r.id}?month=${month}`} muted={!r.active} />
                  </td>
                  <td className={td}>
                    <GroupChip name={r.group} />
                  </td>
                  <td className={cx(td, "num whitespace-nowrap text-right text-[15px] font-medium text-ink-900")}>{formatMoney(r.monthlyFee)}</td>
                  <td className={cx(td, "num whitespace-nowrap text-right text-[15px] font-medium", r.active && r.started && r.debt ? "text-ink-900" : "text-ink-300")}>
                    {r.active && r.started ? formatMoney(r.debt) : "—"}
                  </td>
                  <td className={td}>
                    {!r.active ? <Tag>Nofaol</Tag> : !r.started ? <Tag tone="brand">Hali boshlamagan</Tag> : <StatusBadge status={r.status} />}
                  </td>
                  <td className={cx(td, "text-right")}>
                    <div className="flex items-center justify-end gap-0.5">
                      <Link href={`/students/${r.id}?month=${month}`} className={btn.icon} aria-label="Ko‘rish" title="Ko‘rish">
                        <Eye className="size-[18px]" strokeWidth={1.8} aria-hidden />
                      </Link>
                      <Link href={`/students/${r.id}/edit`} className={btn.icon} aria-label="Tahrirlash" title="Tahrirlash">
                        <Pencil className="size-[17px]" strokeWidth={1.8} aria-hidden />
                      </Link>
                      <ConfirmAction
                        action={deleteStudent.bind(null, r.id, null)}
                        confirmText={`${r.fullName} va uning barcha to‘lovlari o‘chirib yuborilsinmi? Bu amalni qaytarib bo‘lmaydi.`}
                        className={btn.iconDanger}
                        pendingText="…"
                        title="O‘chirish"
                      >
                        <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                      </ConfirmAction>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
