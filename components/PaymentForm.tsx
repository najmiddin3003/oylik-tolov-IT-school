"use client";

import { useMemo, useState } from "react";
import { Banknote, BookOpen, CalendarCheck, Check, CreditCard, Landmark, Lock, Plus, type LucideIcon } from "lucide-react";
import { addPayment } from "@/app/actions/payments";
import type { FormState } from "@/app/actions/types";
import type { StudentOption } from "@/lib/data";
import { courseKey } from "@/lib/courses";
import { feeFor } from "@/lib/fees";
import type { PaymentMethod } from "@/lib/models";
import { formatMoney, formatNumber } from "@/lib/time";
import { MoneyInput } from "./inputs";
import { DatePicker, formatDayLong, MonthPicker, Select } from "./pickers";
import { btn, cx, inputCls, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

const METHODS: { key: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { key: "naqd", label: "Naqd", icon: Banknote },
  { key: "karta", label: "Karta", icon: CreditCard },
  { key: "otkazma", label: "O‘tkazma", icon: Landmark },
];

type Props = {
  students: StudentOption[];
  /** O'quvchi sahifasida — o'quvchi tanlanmaydi */
  fixedStudentId?: string;
  defaultStudentId?: string;
  defaultMonth: string;
  today: string;
  /** «To'langan sana» maydoni (rahbar Sozlamalar → Funksiyalar bo'limida rol bo'yicha yoqadi); o'chiq — har doim bugun */
  canPickDate: boolean;
  /** Kurslar tartibi (sozlamalardagi ro'yxat); to'lov kiritishda avval kurs tanlanadi */
  courses?: string[];
};

/** Kursi yo'q o'quvchilar uchun tanlov qiymati */
const NO_COURSE = "__none";
const courseOf = (s: StudentOption) => (s.group.trim() ? courseKey(s.group) : NO_COURSE);

/** To'lov qo'shish formasi (To'lovlar sahifasi va o'quvchi sahifasi). */
export function PaymentForm(props: Props) {
  const [state, onSubmit, pending] = useActionForm<FormState>(addPayment, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {/* Muvaffaqiyatli saqlangach maydonlar yangi qiymatlar bilan qayta chiziladi */}
      <PaymentFields key={state.nonce ?? 0} {...props} fe={state.fieldErrors ?? {}} />

      {state.error ? (
        <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800" role="status">
          ✓ {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={cx(btn.primary, "h-12 w-full")}>
        <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
        {pending ? "Saqlanmoqda…" : "To‘lovni saqlash"}
      </button>
      <p className="-mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-400">
        <Lock className="size-3" aria-hidden />
        Bazaga saqlanadi va Google Sheets bilan solishtiriladi
      </p>
    </form>
  );
}

function roundTo10k(n: number) {
  return Math.round(n / 10_000) * 10_000;
}

function PaymentFields({
  students,
  fixedStudentId,
  defaultStudentId,
  defaultMonth,
  today,
  canPickDate,
  courses = [],
  fe,
}: Props & { fe: Record<string, string> }) {
  // Kurslar: sozlamalardagi tartibda, keyin o'quvchilarda uchraydigan boshqalari; o'quvchilar soni bilan
  const courseOptions = useMemo(() => {
    const count = new Map<string, { label: string; n: number }>();
    for (const s of students) {
      const k = courseOf(s);
      const prev = count.get(k);
      count.set(k, { label: prev?.label ?? (k === NO_COURSE ? "Kursi belgilanmagan" : s.group.trim()), n: (prev?.n ?? 0) + 1 });
    }
    const ordered = [...courses.map(courseKey).filter((k) => count.has(k)), ...[...count.keys()].filter((k) => !courses.some((c) => courseKey(c) === k))];
    return [...new Set(ordered)].map((k) => ({ value: k, label: count.get(k)!.label, hint: `${count.get(k)!.n} ta` }));
  }, [students, courses]);
  const initialStudent = students.find((s) => s.id === (fixedStudentId ?? defaultStudentId));
  const [course, setCourse] = useState(initialStudent ? courseOf(initialStudent) : courseOptions.length === 1 ? courseOptions[0].value : "");
  const [openStudents, setOpenStudents] = useState(0);
  const [studentId, setStudentId] = useState(fixedStudentId ?? defaultStudentId ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [amount, setAmount] = useState<string | null>(null); // null — avtomatik (qolgan summa)
  const [method, setMethod] = useState<PaymentMethod>("naqd");
  const [showNote, setShowNote] = useState(false);

  const st = students.find((s) => s.id === studentId);
  const fee = st ? feeFor(st, month) : 0;
  const paid = st?.paid[month] ?? 0;
  const remaining = Math.max(0, fee - paid);
  const shown = amount ?? (st ? formatNumber(remaining || fee) : "");
  const chips = [...new Set([roundTo10k(fee / 3), roundTo10k(fee / 2)])].filter((v) => v > 0 && v < fee);

  // O'quvchilar ro'yxati (tanlangan kurs bo'yicha): faqat ism-familiya; o'ngda shu oy holati (to'lagan / qancha qolgan)
  const options = useMemo(
    () =>
      students.filter((s) => courseOf(s) === course).map((s) => {
        const f = feeFor(s, month);
        const p = s.paid[month] ?? 0;
        return {
          value: s.id,
          label: s.name,
          hint:
            f > 0 && p >= f ? (
              <span className="font-medium text-emerald-600">to‘lagan ✓</span>
            ) : p > 0 ? (
              <span className="num text-brand-600">qoldi {formatNumber(f - p)}</span>
            ) : undefined,
        };
      }),
    [students, month, course],
  );

  return (
    <>
      {fixedStudentId ? (
        <input type="hidden" name="studentId" value={fixedStudentId} />
      ) : (
        <>
          {courseOptions.length > 1 ? (
            <div>
              <label htmlFor="pf-course" className={labelCls}>
                Kurs <span className="text-brand-600">*</span>
              </label>
              <Select
                id="pf-course"
                value={course}
                onChange={(v) => {
                  setCourse(v);
                  // Boshqa kursdagi o'quvchi tanlangan bo'lsa — tozalanadi; o'quvchilar ro'yxati o'zi ochiladi
                  if (!students.some((s) => s.id === studentId && courseOf(s) === v)) {
                    setStudentId("");
                    setAmount(null);
                  }
                  setOpenStudents((n) => n + 1);
                }}
                options={courseOptions.map((o) => ({ ...o, icon: <BookOpen className="size-4 text-ink-400" aria-hidden /> }))}
                placeholder="Avval kursni tanlang"
                searchable={false}
                size="lg"
                aria-label="Kurs"
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="pf-student" className={labelCls}>
              O‘quvchi <span className="text-brand-600">*</span>
            </label>
            <Select
              // Kurs tanlanganda ro'yxat yangidan, ochiq holda chiqadi
              key={`students-${openStudents}`}
              defaultOpen={openStudents > 0}
              id="pf-student"
              name="studentId"
              value={studentId}
              onChange={(v) => {
                setStudentId(v);
                setAmount(null);
              }}
              options={options}
              placeholder={course ? "O‘quvchini tanlang" : "Avval kursni tanlang"}
              disabled={!course}
              searchable
              searchPlaceholder="Ism bo‘yicha qidirish..."
              emptyText="Bu kursda o‘quvchi topilmadi"
              size="lg"
              invalid={!!fe.studentId}
              aria-label="O‘quvchi"
            />
            {fe.studentId ? <p className="mt-1.5 text-xs text-rose-600">{fe.studentId}</p> : null}
          </div>
        </>
      )}

      {st ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink-500">Qolgan to‘lov</span>
            <span className={cx("num text-[17px] font-semibold", remaining ? "text-brand-700" : "text-emerald-600")}>
              {remaining ? formatMoney(remaining) : "To‘langan ✓"}
            </span>
          </div>
          <div className="num mt-2 flex items-center justify-between gap-3 text-xs text-ink-400">
            <span>Oylik: {formatMoney(fee)}</span>
            <span>To‘landi: {formatMoney(paid)}</span>
          </div>
        </div>
      ) : null}

      <div className={cx("grid gap-3", canPickDate && "sm:grid-cols-2 xl:grid-cols-1")}>
        <div>
          <span className={labelCls}>Qaysi oy uchun</span>
          <MonthPicker
            name="month"
            value={month}
            onChange={(m) => {
              setMonth(m);
              setAmount(null);
            }}
            invalid={!!fe.month}
            aria-label="Qaysi oy uchun"
          />
          {fe.month ? <p className="mt-1.5 text-xs text-rose-600">{fe.month}</p> : null}
        </div>
        {canPickDate ? (
          <div>
            <span className={labelCls}>To‘langan sana</span>
            <DatePicker name="paidAt" defaultValue={today} max={today} invalid={!!fe.paidAt} aria-label="To‘langan sana" />
            {fe.paidAt ? <p className="mt-1.5 text-xs text-rose-600">{fe.paidAt}</p> : null}
          </div>
        ) : null}
      </div>
      {!canPickDate ? (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-ink-400">
          <CalendarCheck className="size-3.5 text-emerald-500" aria-hidden />
          To‘langan sana: bugun, {formatDayLong(today)}
        </p>
      ) : null}

      <div>
        <label htmlFor="pf-amount" className={labelCls}>
          To‘lov summasi <span className="text-brand-600">*</span>
        </label>
        <MoneyInput
          id="pf-amount"
          name="amount"
          value={shown}
          onValueChange={(_, formatted) => setAmount(formatted)}
          maxDigits={12}
          className="h-16 pr-16 text-[26px] font-semibold tracking-[-0.01em]"
          placeholder="0"
          invalid={!!fe.amount}
        />
        {fe.amount ? <p className="mt-1.5 text-xs text-rose-600">{fe.amount}</p> : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {chips.map((v) => (
            <button key={v} type="button" onClick={() => setAmount(formatNumber(v))} className="num h-7 rounded-lg border border-line px-2.5 text-xs font-medium text-ink-500 transition hover:border-brand-200 hover:text-brand-700">
              {formatNumber(v)}
            </button>
          ))}
          {fee ? (
            <button
              type="button"
              onClick={() => setAmount(formatNumber(remaining || fee))}
              className="ml-auto h-7 rounded-lg bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              To‘liq to‘lash
            </button>
          ) : null}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-500">
          <input type="checkbox" name="spread" defaultChecked className="size-3.5 rounded accent-brand-600" />
          Oylikdan ortiq summani keyingi oylarga o‘tkazish
        </label>
      </div>

      <fieldset>
        <legend className={labelCls}>To‘lov usuli</legend>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const active = method === m.key;
            return (
              <label
                key={m.key}
                className={cx(
                  "group flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/15",
                  active ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line text-ink-500 hover:bg-slate-50",
                )}
              >
                <input type="radio" name="method" value={m.key} checked={active} onChange={() => setMethod(m.key)} className="sr-only" />
                <Icon className="icon-wiggle size-4" strokeWidth={1.9} fill="currentColor" fillOpacity={active ? 0.18 : 0} aria-hidden />
                {m.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {showNote ? (
        <div>
          <label htmlFor="pf-note" className={labelCls}>
            Izoh <span className="font-normal text-ink-400">(ixtiyoriy)</span>
          </label>
          <input id="pf-note" name="note" className={inputCls} placeholder="To‘lov haqida qisqacha" autoFocus />
        </div>
      ) : (
        <button type="button" onClick={() => setShowNote(true)} className="-my-1 inline-flex w-fit items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700">
          <Plus className="size-4" aria-hidden />
          Izoh qo‘shish <span className="text-ink-300">(ixtiyoriy)</span>
        </button>
      )}
    </>
  );
}
