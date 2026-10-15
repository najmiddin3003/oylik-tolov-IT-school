"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, Info } from "lucide-react";
import { saveStudent } from "@/app/actions/students";
import type { FormState } from "@/app/actions/types";
import { courseTeacher, teacherOnCourseChange } from "@/lib/courses";
import type { StudentDetail } from "@/lib/data";
import { feeFor, type FeeChange } from "@/lib/fees";
import type { Lesson } from "@/lib/schedule";
import { dateToISO, formatNumber } from "@/lib/time";
import { MoneyInput, PhoneInput } from "./inputs";
import { DatePicker, MonthPicker, Select } from "./pickers";
import { ScheduleField } from "./ScheduleField";
import { btn, cx, inputCls, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs text-rose-600">{msg}</p> : null;
}

function Section({ title, hint, children, wide = false }: { title: string; hint: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid gap-5 border-b border-line-soft px-6 py-6 last:border-b-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">{hint}</p>
      </div>
      <div className={cx("grid gap-5", !wide && "sm:grid-cols-2")}>{children}</div>
    </div>
  );
}

export function StudentForm({
  student,
  courses,
  today,
  month,
  standard,
  templates = [],
  teachers = [],
}: {
  student?: StudentDetail;
  /** Kurslar (Sozlamalar → Kurslar): standart oylik narxi va o'qituvchisi */
  courses: { name: string; fee: number | null; teacher?: string | null }[];
  /** O'qituvchilar (biriktirish uchun) */
  teachers?: { id: string; name: string; status: string }[];
  /** Boshqa o'quvchilarda ko'p uchraydigan dars jadvallari */
  templates?: Lesson[][];
  today: string;
  /** Joriy oy — narx o'zgarsa, standart holatda shu oydan boshlab qo'llanadi */
  month: string;
  /** Markazning standart narxi (yangi o'quvchi uchun): asosiy narx va "falon oydan" o'zgarishlar */
  standard?: { base: number; schedule: FeeChange[] } | null;
}) {
  const action = saveStudent.bind(null, student?.id ?? null);
  const [state, onSubmit, pending] = useActionForm<FormState>(action, {});
  const fe = state.fieldErrors ?? {};
  const [feeFrom, setFeeFrom] = useState(month);
  const feeAtFrom = student ? feeFor(student, feeFrom) : null;
  const standardAt = (iso: string) => (standard ? feeFor({ monthlyFee: standard.base, feeHistory: standard.schedule }, iso.slice(0, 7)) : null);
  const initialFee = student ? student.currentFee : standardAt(today);
  const [fee, setFee] = useState(initialFee !== null ? formatNumber(initialFee) : "");
  const [feeTouched, setFeeTouched] = useState(false);
  const [group, setGroup] = useState(student?.group ?? "");
  // Kurs o'qituvchisi: kurs tanlanganda (o'qituvchi bo'sh yoki avvalgi kursniki bo'lsa) o'zi qo'yiladi
  const teacherOf = (name: string) => courseTeacher(courses.map((c) => ({ name: c.name, fee: c.fee, teacher: c.teacher ?? null })), name);
  const [teacher, setTeacher] = useState(() =>
    student ? (student.teacherId ?? teacherOf(student.group) ?? "") : teachers.length === 1 ? teachers[0].id : "",
  );
  const anyCourseTeacher = courses.some((c) => c.teacher);
  const feeChanged = student !== undefined && feeAtFrom !== null && Number(fee.replace(/\D/g, "")) !== feeAtFrom;

  return (
    <form onSubmit={onSubmit} noValidate>
      {state.error ? (
        <p className="mx-6 mt-6 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <Section title="Shaxsiy ma’lumotlar" hint="Ism-familiya Google Sheets’dagi bilan bir xil yozilsa, solishtirish aniq bo‘ladi.">
        <div className="sm:col-span-2">
          <label htmlFor="fullName" className={labelCls}>
            Ism-familiya <span className="text-brand-600">*</span>
          </label>
          <input id="fullName" name="fullName" required defaultValue={student?.fullName} className={inputCls} placeholder="O‘quvchining ism-familiyasi" aria-invalid={!!fe.fullName} autoFocus={!student} />
          <FieldError msg={fe.fullName} />
        </div>
        <div>
          <label htmlFor="phone" className={labelCls}>
            Telefon
          </label>
          <PhoneInput id="phone" name="phone" defaultValue={student?.phone} placeholder="90 123 45 67" invalid={!!fe.phone} />
          <FieldError msg={fe.phone} />
        </div>
        <div>
          <label htmlFor="parentPhone" className={labelCls}>
            Ota-ona telefoni
          </label>
          <PhoneInput id="parentPhone" name="parentPhone" defaultValue={student?.parentPhone} placeholder="90 123 45 67" invalid={!!fe.parentPhone} />
          <FieldError msg={fe.parentPhone} />
        </div>
      </Section>

      <Section title="O‘qish va to‘lov" hint="Oylik to‘lov qarzni hisoblash uchun, boshlagan sana — qaysi oydan to‘lov kutilishini bilish uchun kerak.">
        <div>
          <label htmlFor="group" className={labelCls}>
            Kurs
          </label>
          <Select
            id="group"
            name="group"
            value={group}
            onChange={(v) => {
              setTeacher((cur) => teacherOnCourseChange(cur || null, teacherOf(group), teacherOf(v)) ?? "");
              setGroup(v);
              // Yangi o'quvchida narx hali o'zgartirilmagan bo'lsa — kursning standart narxi qo'yiladi
              const courseFee = courses.find((c) => c.name === v)?.fee;
              if (!student && !feeTouched && courseFee) setFee(formatNumber(courseFee));
            }}
            options={[
              { value: "", label: "Kurs tanlanmagan" },
              ...courses.map((c) => ({ value: c.name, label: c.name, hint: c.fee ? `${formatNumber(c.fee)} so‘m` : undefined })),
            ]}
            searchable={false}
            aria-label="Kurs"
          />
          <p className="mt-1.5 text-xs text-ink-400">Ro‘yxatda yo‘q kurs — Sozlamalar → Kurslar bo‘limida qo‘shiladi.</p>
        </div>
        <div>
          <label htmlFor="monthlyFee" className={labelCls}>
            Oylik to‘lov (so‘m) <span className="text-brand-600">*</span>
          </label>
          <MoneyInput
            id="monthlyFee"
            name="monthlyFee"
            required
            value={fee}
            onValueChange={(_, formatted) => {
              setFee(formatted);
              setFeeTouched(true);
            }}
            maxDigits={10}
            placeholder="Oylik to‘lov summasi"
            invalid={!!fe.monthlyFee}
          />
          <FieldError msg={fe.monthlyFee} />
        </div>
        {student ? (
          <div className="sm:col-span-2">
            <span className={labelCls}>Yangi narx qaysi oydan boshlab</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <MonthPicker name="feeFrom" value={feeFrom} onChange={setFeeFrom} aria-label="Qaysi oydan boshlab" />
              <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500 sm:pt-1">
                <Info className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden />
                {feeChanged
                  ? `${formatNumber(feeAtFrom!)} → ${fee || "0"} so‘m. Undan oldingi oylar hisobi o‘zgarmaydi.`
                  : "Narxni o‘zgartirsangiz, tanlangan oydan boshlab qo‘llanadi. O‘tgan oylar hisobi o‘zgarmaydi."}
              </p>
            </div>
          </div>
        ) : null}
        <div>
          <span className={labelCls}>
            O‘qishni boshlagan sana <span className="text-brand-600">*</span>
          </span>
          <DatePicker
            name="startDate"
            defaultValue={student ? dateToISO(new Date(student.startDate)) : today}
            onChange={(iso) => {
              // Yangi o'quvchi: narx qo'lda o'zgartirilmagan bo'lsa — boshlagan oydagi standart narx
              const std = !student && !feeTouched && iso ? standardAt(iso) : null;
              if (std !== null) setFee(formatNumber(std));
            }}
            invalid={!!fe.startDate}
            aria-label="O‘qishni boshlagan sana"
          />
          <FieldError msg={fe.startDate} />
        </div>
        {teachers.length ? (
          <div>
            <span className={labelCls}>O‘qituvchisi</span>
            <Select
              name="teacher"
              value={teacher}
              onChange={setTeacher}
              aria-label="O‘qituvchisi"
              searchable={false}
              invalid={!!fe.teacher}
              options={[
                { value: "", label: teacherOf(group) ? "Kurs o‘qituvchisi" : "Biriktirilmagan" },
                ...teachers.map((t) => ({ value: t.id, label: t.name, hint: t.status === "invited" ? "ro‘yxatdan o‘tmagan" : undefined })),
              ]}
            />
            <FieldError msg={fe.teacher} />
            {anyCourseTeacher ? <p className="mt-1.5 text-xs text-ink-400">Kurs tanlanganda kurs o‘qituvchisi o‘zi qo‘yiladi.</p> : null}
          </div>
        ) : null}
        <div>
          <span className={labelCls}>Holati</span>
          <Select
            name="active"
            defaultValue={student && !student.active ? "false" : "true"}
            aria-label="Holati"
            options={[
              { value: "true", label: "Faol (o‘qiyapti)", icon: <span className="block size-2 rounded-full bg-emerald-500" /> },
              { value: "false", label: "Nofaol (ketgan / to‘xtatgan)", icon: <span className="block size-2 rounded-full bg-ink-300" /> },
            ]}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="note" className={labelCls}>
            Izoh
          </label>
          <textarea id="note" name="note" rows={3} defaultValue={student?.note} className={cx(inputCls, "h-auto py-2.5")} placeholder="Chegirma, kelishuv va h.k." />
        </div>
      </Section>

      <Section
        title="Dars jadvali"
        hint="Qaysi kunlari, soat nechida darsga keladi. To‘lovlar sahifasida «Bugun darsga keladi» ro‘yxatida ko‘rinadi — to‘lovni shu vaqtda yig‘ish qulay."
        wide
      >
        <ScheduleField name="schedule" defaultValue={student?.lessons ?? []} templates={templates} error={fe.schedule} errorStamp={state.fieldErrors} />
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-5">
        <Link href={student ? `/students/${student.id}` : "/students"} className={btn.outline}>
          Bekor qilish
        </Link>
        <button type="submit" disabled={pending} className={btn.primary}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : student ? "O‘zgarishlarni saqlash" : "O‘quvchini qo‘shish"}
        </button>
      </div>
    </form>
  );
}
