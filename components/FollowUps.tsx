"use client";

// «Kelmadi» belgilangan o'quvchilar: keyingi darsi boshlanishi bilan sababini o'rganish — «Gaplashildi» va izoh.
// Saytga kirilganda oyna bir marta chiqadi (har foydalanuvchiga; ko'rilganlari brauzerda eslab qolinadi),
// keyin ro'yxat «Davomat» sahifasida turadi — gaplashilguncha.
import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageCircleQuestion, PhoneCall } from "lucide-react";
import { resolveFollowUp } from "@/app/actions/attendance";
import type { FormState } from "@/app/actions/types";
import type { FollowUp } from "@/lib/attendance";
import type { Role } from "@/lib/session";
import { formatDate, formatMoney } from "@/lib/time";
import { Modal, ModalBody, ModalHeader } from "./Modal";
import { Avatar, btn, cx, inputCls, Tag } from "./ui";
import { useActionForm } from "./useActionForm";

const PAY: Record<NonNullable<FollowUp["pay"]>["status"], { label: string; tone: "emerald" | "amber" | "rose" }> = {
  paid: { label: "To‘lagan", tone: "emerald" },
  partial: { label: "Qisman to‘lagan", tone: "amber" },
  unpaid: { label: "To‘lamagan", tone: "rose" },
};

export function studentHref(role: Role, id: string): string | null {
  // Administratorda o'quvchi profili yo'q — to'lov oynasi
  return role === "admin" ? `/payments?student=${id}#yangi-tolov` : `/students/${id}`;
}

/** Bitta o'quvchi: ismi (profilga), qachon kelmagani, to'lov holati va «Gaplashildi». */
export function FollowUpItem({ f, role, onDone }: { f: FollowUp; role: Role; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useActionForm<FormState>(resolveFollowUp, {});
  const href = studentHref(role, f.studentId);
  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);
  if (state.ok) return null;
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex min-w-[200px] flex-1 items-start gap-3">
          <Avatar name={f.name} />
          <div className="min-w-0">
            {href ? (
              <Link href={href} className="text-[15px] font-semibold text-ink-900 hover:text-brand-600 hover:underline">
                {f.name}
              </Link>
            ) : (
              <span className="text-[15px] font-semibold text-ink-900">{f.name}</span>
            )}
            <p className="num text-[13px] text-ink-500">
              {f.group || "Kursi yo‘q"} · {formatDate(f.date)}
              {f.start ? ` ${f.start}` : ""} darsiga kelmagan
            </p>
            {f.note ? <p className="mt-0.5 text-[13px] text-ink-600">Izoh: {f.note}</p> : null}
            {f.pay ? (
              <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                <Tag tone={PAY[f.pay.status].tone}>{PAY[f.pay.status].label}</Tag>
                {f.pay.debt > 0 ? `bu oy qarzi ${formatMoney(f.pay.debt)}` : `bu oy ${formatMoney(f.pay.fee)}`}
              </p>
            ) : null}
          </div>
        </div>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className={cx(btn.sm, "text-emerald-700")}>
            <PhoneCall className="size-4" aria-hidden />
            Gaplashildi
          </button>
        ) : null}
      </div>
      {open ? (
        <form onSubmit={onSubmit} className="mt-3 grid gap-2 sm:pl-[52px]">
          <input type="hidden" name="id" value={f.id} />
          <textarea
            name="note"
            required
            rows={2}
            maxLength={500}
            autoFocus
            placeholder="Nima gaplashildi (majburiy): sababi, keyingi darsga keladimi…"
            className={cx(inputCls, "h-auto py-2.5 text-sm", state.fieldErrors?.note && "border-rose-300")}
          />
          {state.fieldErrors?.note ? <p className="text-xs text-rose-600">{state.fieldErrors.note}</p> : null}
          {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={btn.primary}>
              {pending ? "Saqlanmoqda…" : "Saqlash"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btn.outline}>
              Bekor qilish
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** «Davomat» sahifasidagi ro'yxat. */
export function FollowUpList({ items, role }: { items: FollowUp[]; role: Role }) {
  return (
    <ul className="divide-y divide-line-soft px-5 sm:px-6">
      {items.map((f) => (
        <FollowUpItem key={f.id} f={f} role={role} />
      ))}
    </ul>
  );
}

/** Saytga kirilganda: hali ko'rsatilmagan kelmaganlar — oynada bir marta. */
export function FollowUpModal({ items, role, storageKey }: { items: FollowUp[]; role: Role; storageKey: string }) {
  const [shown, setShown] = useState<FollowUp[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      seen = [];
    }
    const fresh = items.filter((f) => !seen.includes(f.id));
    if (!fresh.length) return;
    // Ko'rsatildi — keyingi safar chiqmaydi (ro'yxat «Davomat» sahifasida qoladi)
    try {
      localStorage.setItem(storageKey, JSON.stringify([...seen, ...fresh.map((f) => f.id)].slice(-500)));
    } catch {
      // saqlab bo'lmasa — keyingi kirishda yana chiqadi
    }
    const t = window.setTimeout(() => {
      setShown(fresh);
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [items, storageKey]);
  const left = shown.length;
  return (
    <Modal open={open} onClose={() => setOpen(false)} labelledBy="followup-title" size="lg">
      <ModalHeader
        id="followup-title"
        icon={MessageCircleQuestion}
        tone="rose"
        title="O‘tgan darsga kelmagan o‘quvchilar"
        subtitle={`Bugun darsi boshlandi — sababini o‘rganing (${left} ta)`}
        onClose={() => setOpen(false)}
      />
      <ModalBody className="py-1">
        <ul className="divide-y divide-line-soft">
          {shown.map((f) => (
            <FollowUpItem key={f.id} f={f} role={role} onDone={() => setShown((s) => s.filter((x) => x.id !== f.id))} />
          ))}
        </ul>
        {!left ? <p className="py-6 text-center text-sm text-emerald-700">Hammasi bilan gaplashildi ✓</p> : null}
      </ModalBody>
      <div className="flex justify-end border-t border-line-soft px-5 py-3 sm:px-6">
        <Link href="/davomat#sabab" onClick={() => setOpen(false)} className={cx(btn.outline, "mr-2")}>
          Davomat sahifasida
        </Link>
        <button type="button" onClick={() => setOpen(false)} className={btn.primary}>
          Keyinroq
        </button>
      </div>
    </Modal>
  );
}
