"use client";

// Tezkor «Yangi o'quvchi» oynasi (administrator «To'lovlar» sahifasidan): kurs, oylik to'lov, telefon, dars vaqti.
import { useState } from "react";
import { BookOpen, Check, UserPlus } from "lucide-react";
import { addStudentQuick } from "@/app/actions/students";
import type { FormState } from "@/app/actions/types";
import { teacherOnCourseChange } from "@/lib/courses";
import type { Lesson } from "@/lib/schedule";
import { formatNumber } from "@/lib/time";
import { MoneyInput, PhoneInput } from "./inputs";
import { Modal, ModalBody, ModalHeader } from "./Modal";
import { DatePicker, Select } from "./pickers";
import { ScheduleField } from "./ScheduleField";
import { btn, cx, inputCls, labelCls } from "./ui";
import { useActionForm } from "./useActionForm";

type Course = { name: string; fee: number | null; teacher?: string | null; teachers?: string[] };
type Teacher = { id: string; name: string; status: string };

export function QuickStudentButton({
  courses,
  teachers,
  templates,
  today,
  className,
}: {
  courses: Course[];
  teachers: Teacher[];
  templates: Lesson[][];
  today: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx(btn.primary, className)}>
        <UserPlus className="size-[18px]" aria-hidden />
        Yangi o‘quvchi
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="quick-student-title" size="lg">
        <ModalHeader
          id="quick-student-title"
          icon={UserPlus}
          tone="violet"
          title="Yangi o‘quvchi"
          subtitle="Kurs va oylik to‘lov majburiy. Saqlangach, to‘lov formasida darhol ko‘rinadi."
          onClose={() => setOpen(false)}
        />
        <QuickStudentForm courses={courses} teachers={teachers} templates={templates} today={today} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function QuickStudentForm({ courses, teachers, templates, today, onDone }: { courses: Course[]; teachers: Teacher[]; templates: Lesson[][]; today: string; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm<FormState>(addStudentQuick, {});
  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <ModalBody className="grid gap-5">
        {state.ok && state.message ? (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800" role="status">
            ✓ {state.message}. Yana qo‘shishingiz yoki oynani yopishingiz mumkin.
          </p>
        ) : null}
        {state.error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
            {state.error}
          </p>
        ) : null}
        {/* Bir xil ismli o'quvchi bor deb ogohlantirilgan bo'lsa — keyingi yuborishda tasdiq */}
        {state.fieldErrors?.confirmDuplicate ? <input type="hidden" name="confirmDuplicate" value="1" /> : null}
        <QuickFields key={state.nonce ?? 0} courses={courses} teachers={teachers} templates={templates} today={today} fe={state.fieldErrors ?? {}} />
      </ModalBody>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-slate-50/60 px-5 py-3.5 sm:px-6">
        <button type="button" onClick={onDone} className={cx(btn.outline, "h-10")}>
          Yopish
        </button>
        <button type="submit" disabled={pending} className={cx(btn.primary, "h-10")}>
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : "O‘quvchini qo‘shish"}
        </button>
      </div>
    </form>
  );
}

function QuickFields({ courses, teachers, templates, today, fe }: { courses: Course[]; teachers: Teacher[]; templates: Lesson[][]; today: string; fe: Record<string, string> }) {
  const [group, setGroup] = useState(courses.length === 1 ? courses[0].name : "");
  const [fee, setFee] = useState(courses.length === 1 && courses[0].fee ? formatNumber(courses[0].fee) : "");
  const [feeTouched, setFeeTouched] = useState(false);
  // Kurs o'qituvchisi: kurs tanlanganda (o'qituvchi bo'sh yoki avvalgi kursniki bo'lsa) o'zi qo'yiladi
  const teacherOf = (name: string) => courses.find((c) => c.name === name)?.teacher ?? null;
  const teachersOf = (name: string) => courses.find((c) => c.name === name)?.teachers ?? [];
  const [teacher, setTeacher] = useState(() => (courses.length === 1 ? (courses[0].teacher ?? "") : ""));
  const err = (k: string) => (fe[k] ? <p className="mt-1.5 text-xs text-rose-600">{fe[k]}</p> : null);

  return (
    <>
      <div>
        <label htmlFor="qs-name" className={labelCls}>
          Ism-familiya <span className="text-brand-600">*</span>
        </label>
        <input id="qs-name" name="fullName" className={inputCls} placeholder="O‘quvchining ism-familiyasi" aria-invalid={!!fe.fullName} autoFocus />
        {err("fullName")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="qs-phone" className={labelCls}>
            Telefon
          </label>
          <PhoneInput id="qs-phone" name="phone" placeholder="90 123 45 67" invalid={!!fe.phone} />
          {err("phone")}
        </div>
        <div>
          <span className={labelCls}>Boshlagan sana</span>
          <DatePicker name="startDate" defaultValue={today} invalid={!!fe.startDate} aria-label="Boshlagan sana" />
          {err("startDate")}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="qs-course" className={labelCls}>
            Kurs <span className="text-brand-600">*</span>
          </label>
          <Select
            id="qs-course"
            name="group"
            value={group}
            onChange={(v) => {
              setTeacher((cur) => teacherOnCourseChange(cur || null, teacherOf(group), teacherOf(v), teachersOf(v)) ?? "");
              setGroup(v);
              const f = courses.find((c) => c.name === v)?.fee;
              if (!feeTouched && f) setFee(formatNumber(f));
            }}
            options={courses.map((c) => ({
              value: c.name,
              label: c.name,
              hint: c.fee ? `${formatNumber(c.fee)} so‘m` : undefined,
              icon: <BookOpen className="size-4 text-ink-400" aria-hidden />,
            }))}
            placeholder="Kursni tanlang"
            searchable={false}
            invalid={!!fe.group}
            aria-label="Kurs"
          />
          {err("group")}
        </div>
        <div>
          <label htmlFor="qs-fee" className={labelCls}>
            Oylik to‘lov <span className="text-brand-600">*</span>
          </label>
          <MoneyInput
            id="qs-fee"
            name="monthlyFee"
            value={fee}
            onValueChange={(_, f) => {
              setFee(f);
              setFeeTouched(true);
            }}
            maxDigits={10}
            placeholder="Oylik to‘lov summasi"
            invalid={!!fe.monthlyFee}
          />
          {err("monthlyFee")}
        </div>
      </div>
      {teachers.length ? (
        <div className="max-w-sm">
          <span className={labelCls}>
            O‘qituvchisi <span className="font-normal text-ink-400">(ixtiyoriy)</span>
          </span>
          <Select
            name="teacher"
            value={teacher}
            onChange={setTeacher}
            options={[
              { value: "", label: teacherOf(group) ? "Kurs o‘qituvchisi" : "Hozircha biriktirilmagan" },
              ...teachers.map((t) => ({ value: t.id, label: t.name, hint: teachersOf(group).includes(t.id) ? "shu kurs" : undefined })),
            ]}
            searchable={false}
            invalid={!!fe.teacher}
            aria-label="O‘qituvchisi"
          />
          {err("teacher")}
          {teachersOf(group).length > 1 && !fe.teacher ? (
            <p className="mt-1.5 text-xs text-amber-700">Bu kursda bir nechta o‘qituvchi bor — o‘quvchining ustozini tanlang.</p>
          ) : null}
        </div>
      ) : null}
      <div>
        <span className={labelCls}>
          Dars kunlari va vaqti <span className="font-normal text-ink-400">(ixtiyoriy)</span>
        </span>
        <ScheduleField name="schedule" templates={templates} error={fe.schedule} errorStamp={fe} />
      </div>
    </>
  );
}
