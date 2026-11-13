"use client";

// Chegirmalar: turlarni boshqarish (Sozlamalar) va o'quvchiga switch bilan yoqish/o'chirish (Chegirmalar sahifasi).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { addDiscountType, deleteDiscountType, setStudentDiscount, updateDiscountType } from "@/app/actions/discounts";
import type { FormState } from "@/app/actions/types";
import type { DiscountStudentRow } from "@/lib/data";
import { discountLabel, type DiscountType } from "@/lib/discounts";
import { formatMoney, monthLabel } from "@/lib/time";
import { MonthPicker, Select } from "./pickers";
import { ConfirmAction } from "./SubmitButton";
import { btn, cx, inputCls, labelCls, Tag } from "./ui";
import { useActionForm } from "./useActionForm";

/** Yoqish/o'chirish tugmasi (switch). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full ring-1 ring-inset transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50",
        checked ? "bg-emerald-500 ring-emerald-600/30" : "bg-slate-200 ring-slate-300/60 dark:bg-slate-700",
      )}
    >
      <span
        className={cx(
          "inline-block size-5 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)]",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-rose-600">{msg}</p> : null;
}

const KIND_OPTIONS = [
  { value: "percent", label: "Foiz (%)" },
  { value: "amount", label: "Summa (so‘m)" },
];

/** Bitta tur formasi: qo'shish yoki tahrirlash. */
function TypeForm({ initial, onDone }: { initial?: DiscountType; onDone?: () => void }) {
  const action = initial ? updateDiscountType.bind(null, initial.id) : addDiscountType;
  const [state, onSubmit, pending] = useActionForm<FormState>(action, {});
  const [kind, setKind] = useState<string>(initial?.kind ?? "percent");
  const fe = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.ok && initial && onDone) onDone();
  }, [state, initial, onDone]);
  return (
    <form onSubmit={onSubmit} key={state.nonce ?? 0} className="grid gap-3 sm:grid-cols-[1fr_11rem_9rem_auto] sm:items-start" noValidate>
      <div>
        <input name="name" defaultValue={initial?.name} placeholder="Nomi: Aka-uka, A’lochi, Aksiya…" maxLength={60} className={inputCls} aria-label="Chegirma nomi" aria-invalid={!!fe.name} />
        <FieldError msg={fe.name} />
      </div>
      <div>
        <Select name="kind" value={kind} onChange={setKind} options={KIND_OPTIONS} searchable={false} aria-label="Chegirma turi" />
      </div>
      <div>
        <input
          name="value"
          defaultValue={initial ? String(initial.value) : ""}
          inputMode="decimal"
          placeholder={kind === "percent" ? "10" : "50 000"}
          className={cx(inputCls, "num")}
          aria-label="Qiymati"
          aria-invalid={!!fe.value}
        />
        <FieldError msg={fe.value} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn.primary}>
          {initial ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {pending ? "…" : initial ? "Saqlash" : "Qo‘shish"}
        </button>
        {initial && onDone ? (
          <button type="button" onClick={onDone} className={btn.outline} aria-label="Bekor qilish">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {state.error ? <p className="text-sm text-rose-600 sm:col-span-4">{state.error}</p> : null}
      {state.ok && state.message && !initial ? <p className="text-sm text-emerald-700 sm:col-span-4">✓ {state.message}</p> : null}
    </form>
  );
}

/** Sozlamalar: chegirma turlari — qo'shish, tahrirlash, o'chirish. */
export function DiscountTypesEditor({ types, usage }: { types: DiscountType[]; usage: Record<string, number> }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="grid gap-4">
      {types.length ? (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line">
          {types.map((t) => (
            <li key={t.id} className="px-4 py-3">
              {editing === t.id ? (
                <TypeForm initial={t} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
                    <BadgePercent className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink-900">{t.name}</span>
                    <span className="num text-[13px] text-ink-500">
                      {discountLabel(t)} · {usage[t.id] ? `${usage[t.id]} ta o‘quvchida` : "hali hech kimda yo‘q"}
                    </span>
                  </span>
                  <button type="button" onClick={() => setEditing(t.id)} className={btn.icon} title="Tahrirlash" aria-label={`${t.name} — tahrirlash`}>
                    <Pencil className="size-[18px]" strokeWidth={1.8} aria-hidden />
                  </button>
                  <ConfirmAction
                    action={deleteDiscountType.bind(null, t.id)}
                    confirmText={`«${t.name}» o‘chirilsinmi?${usage[t.id] ? ` ${usage[t.id]} ta o‘quvchida chegirma joriy oydan tugaydi (o‘tgan oylar hisobi o‘zgarmaydi).` : ""}`}
                    className={btn.iconDanger}
                    pendingText="…"
                    title="O‘chirish"
                  >
                    <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                  </ConfirmAction>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-500">Hali chegirma turi yo‘q — pastda qo‘shing.</p>
      )}
      <div className="rounded-2xl bg-slate-50/70 p-4">
        <p className={labelCls}>Yangi chegirma turi</p>
        <TypeForm />
        <p className="mt-2 text-xs leading-relaxed text-ink-400">
          Tahrirlansa — shu chegirmasi bor o‘quvchilarda yangi qiymat joriy oydan qo‘llanadi; o‘chirilsa — joriy oydan chegirma tugaydi. O‘tgan oylar
          hisobi hech qachon o‘zgarmaydi.
        </p>
      </div>
    </div>
  );
}

/** Bitta o'quvchi: switch (yoqish/o'chirish), tur va qaysi oydan. */
function StudentDiscountRow({ s, types, month, canLink }: { s: DiscountStudentRow; types: DiscountType[]; month: string; canLink: boolean }) {
  const active = Boolean(s.current);
  const [want, setWant] = useState(active);
  const [state, onSubmit, pending] = useActionForm<FormState>(setStudentDiscount, {});
  const [typeId, setTypeId] = useState(s.current?.typeId ?? types[0]?.id ?? "");
  const [seenNonce, setSeenNonce] = useState(state.nonce);
  // Saqlangach — panel yopiladi (switch yangi holatda qoladi)
  const [open, setOpen] = useState(false);
  if (seenNonce !== state.nonce) {
    setSeenNonce(state.nonce);
    setOpen(false);
  }
  const fe = state.fieldErrors ?? {};
  // Holat o'zgarsa — tasdiqlash paneli (tur va qaysi oydan); asl holatga qaytarilsa — yopiladi
  const toggle = (v: boolean) => {
    setWant(v);
    setOpen(v !== active);
  };
  return (
    <li className={cx("px-5 py-3.5 transition-colors sm:px-6", open && "bg-amber-50/40")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-[200px] flex-1">
          {canLink ? (
            <Link href={`/students/${s.id}`} className="text-[15px] font-medium text-ink-900 hover:text-brand-600 hover:underline">
              {s.name}
            </Link>
          ) : (
            <span className="text-[15px] font-medium text-ink-900">{s.name}</span>
          )}
          <p className="num text-[13px] text-ink-500">
            {s.group || "Kursi yo‘q"} · {monthLabel(month)}:{" "}
            {s.netFee !== s.listFee ? (
              <>
                <span className="text-ink-400 line-through">{formatMoney(s.listFee)}</span> <b className="font-semibold text-emerald-700">{formatMoney(s.netFee)}</b>
              </>
            ) : (
              formatMoney(s.listFee)
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {s.current ? <Tag tone="amber">{`${s.current.name} · ${discountLabel(s.current)} · ${monthLabel(s.current.from)} dan`}</Tag> : null}
          {s.next ? (
            <Tag tone="slate">{s.next.kind ? `${monthLabel(s.next.from)} dan: ${s.next.name} ${discountLabel(s.next)}` : `${monthLabel(s.next.from)} dan chegirma yo‘q`}</Tag>
          ) : null}
        </div>
        <Switch checked={want} onChange={toggle} label={`${s.name} — chegirma`} disabled={!types.length && !active} />
        {active && want && !open ? (
          <button type="button" onClick={() => setOpen(true)} className={cx(btn.sm, "text-ink-500")}>
            O‘zgartirish
          </button>
        ) : null}
      </div>
      {open ? (
        <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-start" noValidate>
          <input type="hidden" name="studentId" value={s.id} />
          <input type="hidden" name="on" value={want ? "1" : "0"} />
          {want ? (
            <div>
              <Select
                name="typeId"
                value={typeId}
                onChange={setTypeId}
                searchable={false}
                aria-label="Chegirma turi"
                options={types.map((t) => ({ value: t.id, label: `${t.name} — ${discountLabel(t)}` }))}
              />
              <FieldError msg={fe.typeId} />
            </div>
          ) : (
            <p className="text-sm text-ink-600">Chegirma qaysi oydan o‘chirilsin? O‘tgan oylar hisobi o‘zgarmaydi.</p>
          )}
          <div>
            <MonthPicker name="from" defaultValue={month} aria-label="Qaysi oydan" invalid={!!fe.from} />
            <FieldError msg={fe.from} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={want ? btn.primary : cx(btn.outline, "text-rose-700")}>
              {pending ? "…" : want ? "Yoqish" : "O‘chirish"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setWant(active);
              }}
              className={btn.outline}
              aria-label="Bekor qilish"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {state.error ? <p className="text-sm text-rose-600 sm:col-span-3">{state.error}</p> : null}
        </form>
      ) : null}
      {state.ok && state.message && !open ? <p className="mt-1.5 text-xs text-emerald-700">✓ {state.message}</p> : null}
    </li>
  );
}

/** Chegirmalar sahifasi: o'quvchilar ro'yxati (qidiruv, kurs va «faqat chegirmalilar» filtri). */
export function StudentDiscountList({
  students,
  types,
  month,
  canLink,
}: {
  students: DiscountStudentRow[];
  types: DiscountType[];
  month: string;
  canLink: boolean;
}) {
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [only, setOnly] = useState(false);
  const courses = useMemo(() => [...new Set(students.map((s) => s.group.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [students]);
  const nq = q.trim().toLowerCase();
  const list = students.filter(
    (s) => (!nq || s.name.toLowerCase().includes(nq)) && (!course || s.group.trim() === course) && (!only || s.current || s.next?.kind),
  );
  const withCount = students.filter((s) => s.current).length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3 sm:px-6">
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O‘quvchi qidirish…" className={cx(inputCls, "pl-9")} aria-label="Qidirish" />
        </label>
        {courses.length > 1 ? (
          <Select
            value={course}
            onChange={setCourse}
            searchable={false}
            aria-label="Kurs"
            wrapperClassName="w-full sm:w-56"
            options={[{ value: "", label: "Barcha kurslar" }, ...courses.map((c) => ({ value: c, label: c }))]}
          />
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <Switch checked={only} onChange={setOnly} label="Faqat chegirmalilar" />
          Faqat chegirmalilar ({withCount})
        </label>
      </div>
      {list.length ? (
        <ul className="divide-y divide-line-soft">
          {list.map((s) => (
            <StudentDiscountRow key={s.id} s={s} types={types} month={month} canLink={canLink} />
          ))}
        </ul>
      ) : (
        <p className="px-6 py-8 text-center text-sm text-ink-500">Topilmadi.</p>
      )}
    </>
  );
}
