"use client";

// Chegirmalar: turlarni boshqarish (Sozlamalar) va o'quvchiga switch bilan yoqish/o'chirish (Chegirmalar sahifasi).
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgePercent, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { addDiscountType, deleteDiscountType, setStudentDiscount, updateDiscountType } from "@/app/actions/discounts";
import type { FormState } from "@/app/actions/types";
import type { DiscountStudentRow } from "@/lib/data";
import { applyDiscount, discountLabel, type DiscountType } from "@/lib/discounts";
import { formatMoney, monthLabel } from "@/lib/time";
import { MonthPicker, Select } from "./pickers";
import { Switch } from "./Switch";
import { ConfirmAction } from "./SubmitButton";
import { btn, cx, inputCls, labelCls, Tag } from "./ui";
import { useActionForm } from "./useActionForm";

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

/**
 * O'quvchi chegirmasi: switch (yoqish/o'chirish), tur va qaysi oydan. Holat o'zgarsa — tasdiqlash paneli ochiladi.
 * «Chegirmalar» sahifasidagi qator va o'quvchi profilidagi blok uchun umumiy.
 */
function DiscountToggle({
  s,
  types,
  month,
  as: Wrap,
  className,
  switchText,
  children,
}: {
  s: DiscountStudentRow;
  types: DiscountType[];
  month: string;
  as: "li" | "div";
  className?: string;
  /** Switch yonidagi matn (profil uchun) */
  switchText?: boolean;
  children: ReactNode;
}) {
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
  // Server yangi holatni yuborsa (masalan, boshqa oynada o'zgartirilgan) — switch unga moslashadi
  const [seenActive, setSeenActive] = useState(active);
  if (seenActive !== active) {
    setSeenActive(active);
    if (!open) setWant(active);
  }
  const fe = state.fieldErrors ?? {};
  // Holat o'zgarsa — tasdiqlash paneli (tur va qaysi oydan); asl holatga qaytarilsa — yopiladi
  const toggle = (v: boolean) => {
    setWant(v);
    setOpen(v !== active);
  };
  return (
    <Wrap className={cx("transition-colors", className, open && "bg-amber-50/40")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {children}
        <div className="flex flex-wrap items-center gap-1.5">
          {s.current ? <Tag tone="amber">{`${s.current.name} · ${discountLabel(s.current)} · ${monthLabel(s.current.from)} dan`}</Tag> : null}
          {s.next ? (
            <Tag tone="slate">{s.next.kind ? `${monthLabel(s.next.from)} dan: ${s.next.name} ${discountLabel(s.next)}` : `${monthLabel(s.next.from)} dan chegirma yo‘q`}</Tag>
          ) : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
          <Switch checked={want} onChange={toggle} label={`${s.name} — chegirma`} disabled={!types.length && !active} />
          {switchText ? <span className={cx("font-medium", want ? "text-amber-700" : "text-ink-500")}>{want ? "Chegirma bor" : "Chegirmasiz"}</span> : null}
        </label>
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
    </Wrap>
  );
}

/** Narx: chegirma bo'lsa — eski narx ustidan chizilgan va yangi narx. */
function FeeWithDiscount({ s }: { s: Pick<DiscountStudentRow, "listFee" | "netFee"> }) {
  return s.netFee !== s.listFee ? (
    <>
      <span className="whitespace-nowrap text-ink-400 line-through">{formatMoney(s.listFee)}</span>{" "}
      <b className="whitespace-nowrap font-semibold text-emerald-700">{formatMoney(s.netFee)}</b>
    </>
  ) : (
    <span className="whitespace-nowrap">{formatMoney(s.listFee)}</span>
  );
}

/** «Chegirmalar» sahifasidagi bitta o'quvchi qatori. */
function StudentDiscountRow({ s, types, month, canLink }: { s: DiscountStudentRow; types: DiscountType[]; month: string; canLink: boolean }) {
  return (
    <DiscountToggle s={s} types={types} month={month} as="li" className="px-5 py-3.5 sm:px-6">
      <div className="min-w-[200px] flex-1">
        {canLink ? (
          <Link href={`/students/${s.id}`} className="text-[15px] font-medium text-ink-900 hover:text-brand-600 hover:underline">
            {s.name}
          </Link>
        ) : (
          <span className="text-[15px] font-medium text-ink-900">{s.name}</span>
        )}
        <p className="num text-[13px] text-ink-500">
          {s.group || "Kursi yo‘q"} · {monthLabel(month)}: <FeeWithDiscount s={s} />
        </p>
      </div>
    </DiscountToggle>
  );
}

/** O'quvchi profili: chegirmani shu yerning o'zida yoqish/o'chirish (rahbar). */
export function StudentDiscountPanel({ s, types, month }: { s: DiscountStudentRow; types: DiscountType[]; month: string }) {
  return (
    <DiscountToggle s={s} types={types} month={month} as="div" switchText>
      <p className="num w-full text-sm text-ink-600">
        {monthLabel(month)} oylik to‘lovi: <FeeWithDiscount s={s} />
      </p>
    </DiscountToggle>
  );
}

/**
 * Yangi o'quvchi formasi: chegirma turi (ixtiyoriy) — o'qishni boshlagan oydan qo'llanadi.
 * Tanlansa, chegirmali narx ko'rsatiladi.
 */
export function NewStudentDiscountField({ types, fee, error }: { types: DiscountType[]; fee: number; error?: string }) {
  const [typeId, setTypeId] = useState("");
  const t = types.find((x) => x.id === typeId);
  const net = t && fee > 0 ? applyDiscount(fee, t) : null;
  return (
    <div>
      <span className={labelCls}>
        Chegirma <span className="font-normal text-ink-400">(ixtiyoriy)</span>
      </span>
      <Select
        name="discountType"
        value={typeId}
        onChange={setTypeId}
        searchable={false}
        aria-label="Chegirma"
        invalid={!!error}
        options={[{ value: "", label: "Chegirmasiz" }, ...types.map((x) => ({ value: x.id, label: x.name, hint: discountLabel(x) }))]}
      />
      <FieldError msg={error} />
      <p className="num mt-1.5 text-xs text-ink-500">
        {net !== null ? (
          <>
            Oylik to‘lov chegirma bilan: <b className="font-semibold text-emerald-700">{formatMoney(net)}</b> — boshlagan oyidan. Chegirma tushumga va o‘qituvchi oyligiga kirmaydi.
          </>
        ) : (
          "Tanlansa — o‘qishni boshlagan oyidan qo‘llanadi."
        )}
      </p>
    </div>
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
  const [page, setPage] = useState(1);
  const courses = useMemo(() => [...new Set(students.map((s) => s.group.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [students]);
  const nq = q.trim().toLowerCase();
  const list = students.filter(
    (s) => (!nq || s.name.toLowerCase().includes(nq)) && (!course || s.group.trim() === course) && (!only || s.current || s.next?.kind),
  );
  const withCount = students.filter((s) => s.current).length;
  const pages = Math.max(1, Math.ceil(list.length / DISCOUNT_PAGE));
  const current = Math.min(page, pages);
  const shown = list.slice((current - 1) * DISCOUNT_PAGE, current * DISCOUNT_PAGE);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3 sm:px-6">
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="O‘quvchi qidirish…" className={cx(inputCls, "pl-9")} aria-label="Qidirish" />
        </label>
        {courses.length > 1 ? (
          <Select
            value={course}
            onChange={(v) => (setCourse(v), setPage(1))}
            searchable={false}
            aria-label="Kurs"
            wrapperClassName="w-full sm:w-56"
            options={[{ value: "", label: "Barcha kurslar" }, ...courses.map((c) => ({ value: c, label: c }))]}
          />
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <Switch checked={only} onChange={(v) => (setOnly(v), setPage(1))} label="Faqat chegirmalilar" />
          Faqat chegirmalilar ({withCount})
        </label>
      </div>
      {list.length ? (
        <ul className="divide-y divide-line-soft">
          {shown.map((s) => (
            <StudentDiscountRow key={s.id} s={s} types={types} month={month} canLink={canLink} />
          ))}
        </ul>
      ) : (
        <p className="px-6 py-8 text-center text-sm text-ink-500">Topilmadi.</p>
      )}
      {list.length > DISCOUNT_PAGE ? (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 sm:px-6" aria-label="Sahifalar">
          <span className="num text-[13px] text-ink-500">
            {(current - 1) * DISCOUNT_PAGE + 1}–{Math.min(current * DISCOUNT_PAGE, list.length)} / {list.length} ta o‘quvchi
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage(current - 1)} disabled={current <= 1} className={btn.sm} aria-label="Oldingi 10 ta">
              <ChevronLeft className="size-4" aria-hidden />
              Oldingi
            </button>
            <span className="num px-2 text-[13px] text-ink-500">
              {current} / {pages}
            </span>
            <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages} className={btn.sm} aria-label="Keyingi 10 ta">
              Keyingi
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </nav>
      ) : null}
    </>
  );
}

/** Chegirmalar ro'yxati: bir sahifada shuncha o'quvchi */
const DISCOUNT_PAGE = 10;
