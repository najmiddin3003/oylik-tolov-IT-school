"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { BookOpen, CalendarClock, Check, Eye, GraduationCap, Pencil, Trash2, UserCheck, UserX, X, type LucideIcon } from "lucide-react";
import { bulkStudents, deleteStudent, setCourseBulk, setLessonsBulk, setTeacherBulk } from "@/app/actions/students";
import { sameCourse } from "@/lib/courses";
import type { StudentRow } from "@/lib/data";
import { lessonsKey, type Lesson } from "@/lib/schedule";
import { formatMoney } from "@/lib/time";
import { StudentCell } from "./cells";
import { ColumnResizer, useColumnWidths } from "./ColumnWidths";
import { NextLessonCell } from "./Lessons";
import { useDialog } from "./Modal";
import { Select } from "./pickers";
import { ScheduleDialog } from "./ScheduleField";
import { ConfirmAction } from "./SubmitButton";
import { btn, cx, GroupChip, IconTile, StatusBadge, Tag, td, th } from "./ui";

type TeacherOption = { id: string; name: string; status: string };

// Ustunlar (o'zgaruvchan kenglik, px): standart qiymatlar; foydalanuvchi o'zgartirganini brauzer eslab qoladi
type ColKey = "student" | "teacher" | "group" | "lesson" | "fee" | "debt" | "status";
const COL_DEFAULTS: Record<ColKey, number> = { student: 300, teacher: 180, group: 170, lesson: 220, fee: 170, debt: 170, status: 190 };
const COL_STORAGE = "tt-students-cols-v1";
const CHECK_WIDTH = 48;
type CourseOption = { name: string; teachers: string[] };

export function StudentsTable({
  rows,
  month,
  monthTitle,
  templates,
  serverNow,
  showGroup,
  readOnly = false,
  teachers = [],
  courses = [],
}: {
  rows: StudentRow[];
  month: string;
  monthTitle: string;
  /** Ko'p uchraydigan dars jadvallari (bir bosishda qo'yish uchun) */
  templates: Lesson[][];
  serverNow: number;
  /** Bitta guruh bo'lsa — «Guruh» ustuni ko'rsatilmaydi */
  showGroup: boolean;
  /** O'qituvchi: faqat ko'rish (belgilash, tahrirlash va o'chirish yo'q) */
  readOnly?: boolean;
  /** Rahbar: o'qituvchilar (ustun va biriktirish uchun) */
  teachers?: TeacherOption[];
  /** Rahbar: Sozlamalar → Kurslar ro'yxati (ommaviy kurs belgilash uchun) va kurs o'qituvchisi */
  courses?: CourseOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const visibleSelected = ids.filter((id) => selected.has(id));
  const allChecked = ids.length > 0 && visibleSelected.length === ids.length;
  const teacherName = useMemo(() => new Map(teachers.map((t) => [t.id, t.name])), [teachers]);
  const showTeacher = !readOnly && teachers.length > 0;
  // Ustun kengliklari: standart holatda avtomatik; surilganda — qo'lda (hozirgi kengliklar o'lchanib, shundan boshlanadi)
  const headRow = useRef<HTMLTableRowElement>(null);
  const measure = () => {
    const out: Partial<Record<ColKey, number>> = {};
    headRow.current?.querySelectorAll<HTMLElement>("th[data-col]").forEach((el) => {
      // Yuqoriga yaxlitlab +1px: avtomatik holatdagi sarlavha matni qo'lda boshqarishda ham sig'sin
      out[el.dataset.col as ColKey] = Math.ceil(el.getBoundingClientRect().width) + 1;
    });
    return out;
  };
  const { custom, widthOf, startResize, resizeBy, reset } = useColumnWidths<ColKey>(COL_STORAGE, measure, COL_DEFAULTS);
  const cols: { key: ColKey; label: string; right?: boolean }[] = [
    { key: "student", label: "O‘quvchi" },
    ...(showTeacher ? [{ key: "teacher" as const, label: "O‘qituvchi" }] : []),
    ...(showGroup ? [{ key: "group" as const, label: "Kurs" }] : []),
    { key: "lesson", label: "Dars vaqti" },
    { key: "fee", label: "Oylik to‘lov", right: true },
    { key: "debt", label: "Qolgan to‘lov", right: true },
    { key: "status", label: monthTitle },
  ];
  const actionsWidth = readOnly ? 104 : 136;
  const tableMin = (readOnly ? 0 : CHECK_WIDTH) + cols.reduce((sum, c) => sum + widthOf(c.key), 0) + actionsWidth;

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

  // Tanlanganlarning hammasida bir xil jadval bo'lsa — oynada o'sha ko'rsatiladi
  const chosen = rows.filter((r) => selected.has(r.id));
  const commonLessons = chosen.length && chosen.every((r) => lessonsKey(r.lessons) === lessonsKey(chosen[0].lessons)) ? chosen[0].lessons : [];
  const commonTeacher = chosen.length && chosen.every((r) => r.teacherId === chosen[0].teacherId) ? (chosen[0].teacherId ?? "") : "";
  const commonCourse =
    chosen.length && chosen.every((r) => sameCourse(r.group, chosen[0].group)) ? (courses.find((c) => sameCourse(c.name, chosen[0].group))?.name ?? "") : "";

  return (
    <>
      {!readOnly && visibleSelected.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 bg-brand-50/60 px-6 py-3 text-sm">
          <span className="mr-2 font-semibold text-brand-800">{visibleSelected.length} ta tanlandi</span>
          {courses.length ? (
            <button type="button" disabled={pending} onClick={() => setCourseOpen(true)} className={btn.sm}>
              <BookOpen className="size-4" aria-hidden />
              Kurs
            </button>
          ) : null}
          {teachers.length ? (
            <button type="button" disabled={pending} onClick={() => setTeacherOpen(true)} className={btn.sm}>
              <GraduationCap className="size-4" aria-hidden />
              O‘qituvchi
            </button>
          ) : null}
          <button type="button" disabled={pending} onClick={() => setScheduleOpen(true)} className={btn.sm}>
            <CalendarClock className="size-4" aria-hidden />
            Dars vaqti
          </button>
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

      {!readOnly ? (
        <>
          <ScheduleDialog
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
            count={visibleSelected.length}
            initial={commonLessons}
            templates={templates}
            onSave={async (lessons) => {
              const res = await setLessonsBulk(visibleSelected, JSON.stringify(lessons));
              if (res.error) return res.error;
              setSelected(new Set());
              return null;
            }}
          />
          <BulkPickDialog
            open={teacherOpen}
            onClose={() => setTeacherOpen(false)}
            id="teacher-dialog"
            icon={GraduationCap}
            title="O‘qituvchini biriktirish"
            label="O‘qituvchi"
            count={visibleSelected.length}
            initial={commonTeacher}
            options={[
              ...teachers.map((t) => ({ value: t.id, label: t.name, hint: t.status === "invited" ? "ro‘yxatdan o‘tmagan" : undefined })),
              { value: "", label: "Biriktirilmagan (o‘qituvchisiz)" },
            ]}
            hint="O‘qituvchi o‘z profilida shu o‘quvchilarni, ularning to‘lovlarini ko‘radi va ularning to‘lovlaridan oyligi hisoblanadi."
            onSave={async (teacherId) => {
              const res = await setTeacherBulk(visibleSelected, teacherId);
              if (res.error) return res.error;
              setSelected(new Set());
              return null;
            }}
          />
          <BulkPickDialog
            open={courseOpen}
            onClose={() => setCourseOpen(false)}
            id="course-dialog"
            icon={BookOpen}
            title="Kursni belgilash"
            label="Kurs"
            count={visibleSelected.length}
            initial={commonCourse}
            options={[
              ...courses.map((c) => {
                const names = c.teachers.flatMap((t) => (teacherName.has(t) ? [teacherName.get(t)!] : []));
                return { value: c.name, label: c.name, hint: names.length ? `${names.length > 1 ? "o‘qituvchilari" : "o‘qituvchisi"}: ${names.join(", ")}` : undefined };
              }),
              { value: "", label: "Kurs tanlanmagan" },
            ]}
            hint="Kursda bitta o‘qituvchi bo‘lsa, o‘qituvchisi yo‘q o‘quvchilar unga biriktiriladi va oyligi ularning to‘lovlaridan hisoblanadi. Bir nechta o‘qituvchi bo‘lsa — keyin «O‘qituvchi» tugmasi bilan tanlaysiz. Boshqa o‘qituvchiga biriktirilganlar o‘zgarmaydi."
            onSave={async (course) => {
              const res = await setCourseBulk(visibleSelected, course);
              if (res.error) return res.error;
              setSelected(new Set());
              return null;
            }}
          />
        </>
      ) : null}

      <div className="relative overflow-x-auto border-t border-line-soft">
        {/* Standart holatda ustunlar mazmunga qarab joylashadi. Sarlavha cheti surilsa — aniq kengliklar (bo'sh joyni
            «Amallar» oldidagi ustun oladi, kengliklar ekrandan oshsa — jadval yonga suriladi) */}
        <table
          className={cx("w-full", custom ? "table-fixed" : showGroup || showTeacher ? "min-w-[1120px]" : readOnly ? "min-w-[860px]" : "min-w-[940px]")}
          style={custom ? { minWidth: tableMin } : undefined}
        >
          {custom ? (
            <colgroup>
              {readOnly ? null : <col style={{ width: CHECK_WIDTH }} />}
              {cols.map((c) => (
                <col key={c.key} style={{ width: widthOf(c.key) }} />
              ))}
              <col />
              <col style={{ width: actionsWidth }} />
            </colgroup>
          ) : null}
          <thead className="bg-slate-50/70">
            <tr ref={headRow}>
              {readOnly ? null : (
                <th className={cx(th, "pr-0")}>
                  <input
                    type="checkbox"
                    className={checkbox}
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(ids))}
                    aria-label="Hammasini tanlash"
                  />
                </th>
              )}
              {cols.map((c, i) => (
                <th key={c.key} data-col={c.key} className={cx(th, "relative", c.right && "text-right", i === 0 && !readOnly && "pl-3")}>
                  <span className={cx("block", custom ? "truncate" : "whitespace-nowrap", c.right && "pr-2")}>{c.label}</span>
                  <ColumnResizer label={c.label} onPointerDown={(e) => startResize(c.key, e)} onReset={reset} onStep={(d) => resizeBy(c.key, d)} />
                </th>
              ))}
              <th aria-hidden className="p-0" />
              <th className={cx(th, "pl-2 text-right")}>{readOnly ? <span className="sr-only">Amallar</span> : "Amallar"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <tr key={r.id} className={cx("transition", isSel ? "bg-brand-50/40" : "hover:bg-slate-50/50")}>
                  {readOnly ? null : (
                    <td className={cx(td, "pr-0")}>
                      <input type="checkbox" className={checkbox} checked={isSel} onChange={() => toggle(r.id)} aria-label={`${r.fullName}ni tanlash`} />
                    </td>
                  )}
                  <td className={cx(td, "overflow-hidden", !readOnly && "pl-3")}>
                    <StudentCell id={r.id} name={r.fullName} seq={r.seq} phone={r.phone} href={`/students/${r.id}?month=${month}`} muted={!r.active} />
                  </td>
                  {showTeacher ? (
                    <td className={cx(td, "overflow-hidden")}>
                      {r.teacherId ? (
                        <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink-700" title={teacherName.get(r.teacherId) ?? ""}>
                          <GraduationCap className="size-3.5 shrink-0 text-brand-500" aria-hidden />
                          <span className="truncate">{teacherName.get(r.teacherId) ?? "—"}</span>
                        </span>
                      ) : (
                        <span className="text-[13px] text-ink-300">biriktirilmagan</span>
                      )}
                    </td>
                  ) : null}
                  {showGroup ? (
                    <td className={cx(td, "overflow-hidden")}>
                      <GroupChip name={r.group} />
                    </td>
                  ) : null}
                  <td className={cx(td, "overflow-hidden")}>
                    <NextLessonCell lessons={r.lessons} serverNow={serverNow} muted={!r.active} fluid={custom} away={r.away} />
                  </td>
                  <td className={cx(td, "num overflow-hidden text-ellipsis whitespace-nowrap text-right text-[15px] font-medium text-ink-900")}>{formatMoney(r.monthlyFee)}</td>
                  <td
                    className={cx(
                      td,
                      "num overflow-hidden text-ellipsis whitespace-nowrap text-right text-[15px] font-medium",
                      r.active && r.started && r.debt ? "text-ink-900" : "text-ink-300",
                    )}
                  >
                    {r.active && r.started ? formatMoney(r.debt) : "—"}
                  </td>
                  <td className={cx(td, "overflow-hidden")}>
                    {!r.active ? <Tag>Nofaol</Tag> : !r.started ? <Tag tone="brand">Hali boshlamagan</Tag> : <StatusBadge status={r.status} />}
                  </td>
                  <td aria-hidden className="p-0" />
                  <td className={cx(td, "pl-2 text-right")}>
                    <div className="flex items-center justify-end gap-0.5">
                      <Link href={`/students/${r.id}?month=${month}`} className={btn.icon} aria-label="Ko‘rish" title="Ko‘rish">
                        <Eye className="size-[18px]" strokeWidth={1.8} aria-hidden />
                      </Link>
                      {/* Tahrirlash — o'qituvchiga ham (o'z o'quvchilari, cheklangan maydonlar); o'chirish — faqat rahbar */}
                      <Link href={`/students/${r.id}/edit`} className={btn.icon} aria-label="Tahrirlash" title="Tahrirlash">
                        <Pencil className="size-[17px]" strokeWidth={1.8} aria-hidden />
                      </Link>
                      {readOnly ? null : (
                        <ConfirmAction
                          action={deleteStudent.bind(null, r.id, null)}
                          confirmText={`${r.fullName} va uning barcha to‘lovlari o‘chirib yuborilsinmi? Bu amalni qaytarib bo‘lmaydi.`}
                          className={btn.iconDanger}
                          pendingText="…"
                          title="O‘chirish"
                        >
                          <Trash2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                        </ConfirmAction>
                      )}
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

type PickOption = { value: string; label: string; hint?: string };

type BulkPickProps = {
  id: string;
  icon: LucideIcon;
  title: string;
  label: string;
  count: number;
  initial: string;
  options: PickOption[];
  hint: string;
  onSave: (value: string) => Promise<string | null>;
};

/** Tanlangan o'quvchilar uchun bitta qiymat tanlash oynasi (o'qituvchi yoki kurs). */
function BulkPickDialog({ open, onClose, ...props }: BulkPickProps & { open: boolean; onClose: () => void }) {
  const { ref, present } = useDialog(open);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={`${props.id}-title`}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-2xl border border-line bg-surface p-0 text-ink-700 shadow-pop"
    >
      {present ? <BulkPickBody {...props} onClose={onClose} /> : null}
    </dialog>
  );
}

function BulkPickBody({ id, icon, title, label, count, initial, options, hint, onSave, onClose }: BulkPickProps & { onClose: () => void }) {
  const [value, setValue] = useState(initial || options[0]?.value || "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <div className="group flex items-start gap-3.5 border-b border-line-soft px-5 py-4 sm:px-6">
        <IconTile icon={icon} tone="brand" variant="solid" />
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">
            {title}
          </h2>
          <p className="num mt-0.5 text-sm text-ink-500">{count} ta o‘quvchi uchun</p>
        </div>
        <button type="button" onClick={onClose} className={btn.icon} aria-label="Yopish">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <span className="mb-2 block text-sm font-medium text-ink-700">{label}</span>
        <Select value={value} onChange={setValue} aria-label={label} searchable={false} options={options} />
        <p className="mt-2 text-xs leading-relaxed text-ink-400">{hint}</p>
        {error ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-slate-50/60 px-5 py-3 sm:px-6">
        <button type="button" onClick={onClose} className={cx(btn.outline, "h-10")}>
          Bekor qilish
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const err = await onSave(value);
              if (err) setError(err);
              else onClose();
            })
          }
          className={cx(btn.primary, "h-10")}
        >
          <Check className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
