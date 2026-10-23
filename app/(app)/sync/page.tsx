import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, CalendarClock, CircleCheck, Download, Eye, FileSpreadsheet, Info, TriangleAlert } from "lucide-react";
import { importAllMismatches, importMismatch, linkMismatch, resolveMismatch } from "@/app/actions/sync";
import { ConfirmAction } from "@/components/SubmitButton";
import { LinkStudentPicker, RunSyncButton, SheetSettingsForm } from "@/components/SyncForms";
import { Avatar, btn, Card, CardHeader, cx, EmptyState, MiniStat, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { courseLabel } from "@/lib/compare";
import { sameCourse } from "@/lib/courses";
import { getSyncPageData, type MismatchRow, type StudentPick, type SyncRunView } from "@/lib/data";
import type { MismatchKind } from "@/lib/models";
import { syncHour } from "@/lib/sync";
import { formatDate, formatDateTime, formatMoney, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Google Sheets" };

const KIND: Record<MismatchKind, { label: string; tone: "rose" | "amber" | "brand" | "slate"; help: string }> = {
  missing_on_site: { label: "Saytda yo‘q", tone: "rose", help: "Sheets’da to‘lov bor, saytda kiritilmagan" },
  missing_in_sheet: { label: "Sheets’da yo‘q", tone: "amber", help: "Saytda to‘lov bor, Sheets’da yozilmagan" },
  amount_diff: { label: "Summa farqi", tone: "brand", help: "Ikkala joyda bor, lekin summa har xil" },
  unknown_student: { label: "Saytda yo‘q o‘quvchi", tone: "slate", help: "Sheets’dagi o‘quvchi saytda topilmadi" },
};

const TRIGGER = { auto: "avtomatik", cron: "cron", manual: "qo‘lda" } as const;
const isImportable = (m: MismatchRow) => m.kind === "missing_on_site" || m.kind === "unknown_student";
/** «Saytda yo'q o'quvchi»: saytda bir xil ismli bir nechta yoki o'xshash ismli o'quvchi bor — qaysi biri ekanini tanlash kerak. */
const needsStudentChoice = (m: MismatchRow) =>
  m.kind === "unknown_student" && ((m.siteMatches?.length ?? 0) > 1 || (!m.siteMatches?.length && Boolean(m.similar?.length)));

export default function SyncPage({ searchParams }: PageProps<"/sync">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SyncView searchParams={searchParams} />
    </Suspense>
  );
}

async function SyncView({ searchParams }: { searchParams: PageProps<"/sync">["searchParams"] }) {
  await ownerGuard();
  const sp = await searchParams;
  const course = typeof sp.kurs === "string" ? sp.kurs.slice(0, 80) : "";
  const { settings, runs, students, paidByMonth } = await getSyncPageData();
  const last = runs[0];
  const hour = String(syncHour()).padStart(2, "0");

  return (
    <>
      <PageHeader
        eyebrow="Integratsiya"
        title="Google Sheets"
        subtitle={`Tizim har kuni soat ${hour}:00 da (Toshkent vaqti) Sheets’dagi to‘lovlar jadvalini saytdagi ma’lumotlar bilan solishtiradi.${
          settings.autoImport ? " Sheets’da bor, saytda yo‘q to‘lovlar avtomatik qo‘shiladi." : ""
        }`}
        actions={<RunSyncButton disabled={!settings.sheetUrl} />}
      />

      {!settings.sheetUrl ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-5 py-4 text-sm text-brand-800">
          <Info className="size-[18px] shrink-0" aria-hidden />
          Boshlash uchun pastdagi sozlamalarga Google Sheets havolasini kiriting va saqlang.
        </div>
      ) : null}

      {last ? (
        <LastRun run={last} course={course} students={students} paidByMonth={paidByMonth} />
      ) : settings.sheetUrl ? (
        <Card className="mb-6">
          <EmptyState title="Hali tekshiruv o‘tkazilmagan" icon={FileSpreadsheet}>
            «Hozir tekshirish» tugmasini bosing.
          </EmptyState>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card id="sozlamalar" className="scroll-mt-24 p-6">
          <h2 className="mb-5 text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Sozlamalar</h2>
          <SheetSettingsForm
            sheetUrl={settings.sheetUrl}
            columns={settings.columns}
            courseFilter={settings.courseFilter}
            autoImport={settings.autoImport}
            courses={settings.courses}
          />
        </Card>

        <Card className="self-start">
          <CardHeader title="Oxirgi tekshiruvlar" count={runs.length} />
          {runs.length ? (
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {runs.map((r) => {
                const open = r.mismatches.filter((m) => !m.resolved).length;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                    <span className="num text-ink-700">
                      {formatDateTime(r.startedAt)} <span className="text-ink-400">· {TRIGGER[r.trigger]}</span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {r.autoImported ? <Tag tone="brand">+{r.autoImported} qo‘shildi</Tag> : null}
                      {r.ok ? open ? <Tag tone="amber">{open} ta farq</Tag> : <Tag tone="emerald">Bir xil ✓</Tag> : <Tag tone="rose">Xato</Tag>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-line-soft px-6 py-5 text-sm text-ink-400">Hali tekshiruv bo‘lmagan.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function periodLabel(run: SyncRunView): string {
  if (run.basis === "date" && run.dateFrom) return `${formatDate(run.dateFrom)} – ${formatDate(run.dateTo)}`;
  if (run.monthFrom) return run.monthFrom === run.monthTo ? monthLabel(run.monthFrom) : `${monthLabel(run.monthFrom)} – ${monthLabel(run.monthTo)}`;
  return "—";
}

function LastRun({
  run,
  course,
  students,
  paidByMonth,
}: {
  run: SyncRunView;
  course: string;
  students: StudentPick[];
  paidByMonth: Record<string, string[]>;
}) {
  // Kurs bo'yicha filtr (?kurs=): ko'rsatkichlar va farqlar shu kurs bo'yicha
  const stat = course ? run.courseStats.find((c) => sameCourse(c.course, course)) : undefined;
  const selected = stat?.course ?? "";
  const inCourse = (m: MismatchRow) => !selected || sameCourse(courseLabel(m.group), selected);
  const allOpen = run.mismatches.filter((m) => !m.resolved);
  const open = allOpen.filter(inCourse);
  const resolved = run.mismatches.filter(inCourse).length - open.length;
  const importable = allOpen.filter(isImportable);
  // Bir xil ismli bir nechta yoki o'xshash ismli o'quvchi bor — ommaviy qo'shishda o'tkazib yuboriladi, alohida tanlanadi
  const needsChoice = importable.filter(needsStudentChoice);
  const bulkCount = importable.length - needsChoice.length;
  // Saytda shu ismli o'quvchi bo'lsa — to'lovi unga qo'shiladi (yangi o'quvchi yaratilmaydi)
  const newStudents = new Set(
    importable
      .filter((m) => m.kind === "unknown_student" && !m.siteMatches?.length && !needsStudentChoice(m))
      .map((m) => m.studentName.toLowerCase()),
  ).size;

  if (!run.ok) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-5 py-4">
        <TriangleAlert className="mt-0.5 size-[18px] shrink-0 text-rose-600" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold text-rose-800">Oxirgi tekshiruv bajarilmadi · {formatDateTime(run.startedAt)}</p>
          <p className="mt-1 text-rose-700/90">{run.error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {run.courseStats.length ? <CourseChips run={run} selected={selected} /> : null}
      <div className="mb-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MiniStat label="Oxirgi tekshiruv" value={<span className="text-xl">{formatDateTime(run.startedAt)}</span>} icon={CalendarClock} tone="slate" />
        <MiniStat
          label={selected ? `«${selected}» to‘lovlari` : run.courseFilter ? `«${run.courseFilter}» to‘lovlari` : "Sheets’dagi to‘lovlar"}
          value={stat ? stat.rows : run.sheetRowCount}
          icon={FileSpreadsheet}
          tone="brand"
        />
        <MiniStat label="Mos keldi" value={stat ? stat.matched : run.matchedCount} icon={CircleCheck} tone="emerald" />
        <MiniStat label={resolved ? `Farqlar (${resolved} tasi hal qilingan)` : "Farqlar"} value={open.length} icon={TriangleAlert} tone={open.length ? "amber" : "emerald"} />
      </div>
      {run.autoImported ? (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm sm:px-5" role="status">
          <CircleCheck className="size-[18px] shrink-0 text-emerald-600" aria-hidden />
          <span className="font-semibold text-emerald-900">Sheets’dan {run.autoImported} ta to‘lov avtomatik saytga qo‘shildi</span>
          <span className="text-emerald-800/75">— Sheets’da bor, saytda yo‘q edi</span>
          <Link href="/payments" className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950">
            To‘lovlarni ko‘rish →
          </Link>
        </div>
      ) : null}
      <p className="mb-6 flex items-start gap-2 text-xs leading-relaxed text-ink-400">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          {run.basis === "date" ? "To‘lov sanasi bo‘yicha" : "To‘lov oyi bo‘yicha"} solishtirildi:{" "}
          <span className="num font-medium text-ink-600">{periodLabel(run)}</span>
          {run.courseFilter ? ` · faqat «${run.courseFilter}»${run.filteredOut ? `, boshqa kurslarning ${run.filteredOut} ta qatori e’tiborsiz` : ""}` : ""}
          {run.basis === "date" ? ". Saytdagi to‘lovlar «To‘langan sana» bo‘yicha olinadi; jadvaldagi oxirgi sanadan keyingilari hali solishtirilmaydi." : "."}
        </span>
      </p>

      <Card className="mb-6">
        <CardHeader
          title={open.length ? "Mos kelmagan to‘lovlar" : "Natija"}
          count={open.length || undefined}
          right={
            bulkCount && !selected ? (
              <ConfirmAction
                action={importAllMismatches.bind(null, run.id)}
                confirmText={`Sheets’dan saytga qo‘shiladi: ${newStudents ? `${newStudents} ta yangi o‘quvchi va ` : ""}${bulkCount} ta yozuvdagi to‘lovlar.${
                  needsChoice.length ? ` ${needsChoice.length} ta yozuv (saytda o‘xshash yoki bir xil ismli o‘quvchi bor) qo‘shilmaydi — ularni alohida tanlang.` : ""
                } Keyin qayta tekshiriladi. Davom etilsinmi?`}
                className={cx(btn.primary, "h-10")}
                pendingText="Qo‘shilmoqda…"
              >
                <Download className="size-4" aria-hidden />
                Hammasini saytga qo‘shish ({bulkCount})
              </ConfirmAction>
            ) : null
          }
        />
        {open.length === 0 ? (
          <div className="border-t border-line-soft">
            <EmptyState title={selected ? `«${selected}»: farq yo‘q ✓` : "Sayt va Google Sheets bir xil ✓"} icon={CircleCheck}>
              {(stat ? stat.rows : run.sheetRowCount) ? `${periodLabel(run)} oralig‘idagi barcha to‘lovlar mos keldi.` : "Sheets’da solishtiriladigan to‘lov topilmadi."}
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {open.map((m) => (
              <MismatchItem key={m.id} m={m} runId={run.id} basis={run.basis} students={students} paidIds={paidByMonth[m.month] ?? []} />
            ))}
          </ul>
        )}
      </Card>

      {run.skipped.length ? (
        <Card className="mb-6">
          <details>
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-ink-700">
              O‘qib bo‘lmagan qatorlar: {run.skipped.length} ta <span className="text-ink-400">(ko‘rsatish)</span>
            </summary>
            <ul className="border-t border-line-soft px-6 py-3 text-sm text-ink-600">
              {run.skipped.map((s) => (
                <li key={s.row} className="py-0.5">
                  <span className="num font-medium">{s.row}-qator:</span> {s.reason}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </>
  );
}

function MismatchItem({
  m,
  runId,
  basis,
  students,
  paidIds,
}: {
  m: MismatchRow;
  runId: string;
  basis: "month" | "date";
  students: StudentPick[];
  /** Shu oyda saytda to'lovi bor o'quvchilar */
  paidIds: string[];
}) {
  const k = KIND[m.kind];
  const details = [m.group, m.fee ? `oylik ${formatMoney(m.fee)}` : ""].filter(Boolean).join(", ");
  const unknown = m.kind === "unknown_student";
  // «Saytda yo'q o'quvchi»: saytda hozir shu ismli (yoki Sheets'dagi ismi bog'langan) o'quvchi bormi, o'xshashlari
  const matches = unknown ? (m.siteMatches ?? []) : [];
  const similar = unknown && !matches.length ? (m.similar ?? []) : [];
  const single = matches.length === 1 ? matches[0] : null;
  const amount = formatMoney(m.sheetAmount);
  const label = (s: StudentPick) => `${s.seq ? `#${String(s.seq).padStart(3, "0")} ` : ""}${s.name}${s.group ? ` · ${s.group}` : ""}${s.active ? "" : " · nofaol"}`;
  // Shu oyda saytda to'lovi bor o'quvchi — Sheets yozuvi o'sha to'lovning o'zi: qayta yozilmaydi, faqat ism bog'lanadi
  const hasPay = (s: StudentPick) => paidIds.includes(s.id);
  const aliasNote = (s: StudentPick) => (s.name === m.studentName ? "" : " va keyingi tekshiruvlarda bu ism unga bog‘lanadi");
  const linkText = (s: StudentPick) =>
    hasPay(s)
      ? `Saytdagi «${s.name}»ning ${monthLabel(m.month)} to‘lovi allaqachon bor — Sheets’dagi «${m.studentName}» yozuvi o‘sha to‘lov deb yopiladi, qayta yozilmaydi${aliasNote(s)}. Davom etilsinmi?`
      : `Sheets’dagi «${m.studentName}» — saytdagi «${s.name}»${s.group ? ` (${s.group})` : ""}: ${amount} to‘lov unga yoziladi${aliasNote(s)}. Davom etilsinmi?`;

  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-3 px-6 py-4 transition hover:bg-slate-50/50">
      <div className="flex min-w-[240px] flex-1 items-start gap-3.5">
        <Avatar name={m.studentName} />
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {m.studentId ? (
              <Link href={`/students/${m.studentId}`} className="text-[15px] font-medium text-ink-900 hover:text-brand-600">
                {m.studentName}
              </Link>
            ) : (
              <span className="text-[15px] font-medium text-ink-900">{m.studentName}</span>
            )}
            <span title={k.help}>
              <Tag tone={k.tone}>{k.label}</Tag>
            </span>
          </div>
          <p className="text-[13px] text-ink-500">
            {monthLabel(m.month)}
            {basis === "date" ? " (to‘langan oy)" : ""}
            {unknown && details ? ` · ${details}` : ""}
          </p>
          {m.parts.length ? (
            <p className="num mt-0.5 text-xs text-ink-400">
              Sheets:{" "}
              {m.parts
                .map((p) => `${p.date ? formatDate(p.date) : "sanasiz"} — ${formatMoney(p.amount)}${p.card && !p.cash ? " (plastik)" : ""} · ${p.row}-qator`)
                .join("; ")}
            </p>
          ) : null}
          {m.note && !matches.length ? <p className="mt-0.5 text-xs text-amber-700">{m.note}</p> : null}

          {single ? (
            <p className="mt-1.5 text-xs text-emerald-700">
              Saytda bor:{" "}
              <Link href={`/students/${single.id}`} className="font-semibold underline-offset-2 hover:underline">
                {label(single)}
              </Link>{" "}
              {hasPay(single)
                ? "— uning bu oydagi to‘lovi saytda bor: qayta yozilmaydi, yozuv yopiladi."
                : "— to‘lov shu o‘quvchiga qo‘shiladi, yangi o‘quvchi yaratilmaydi."}
            </p>
          ) : null}
          {matches.length > 1 || similar.length ? (
            <div className="mt-2">
              <p className="text-xs text-ink-500">
                {matches.length > 1 ? `Saytda bu ismli ${matches.length} ta o‘quvchi bor — qaysi biriga qo‘shilsin:` : "Saytda o‘xshash ismli o‘quvchi bor — o‘sha bo‘lsa:"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(matches.length > 1 ? matches : similar).map((s) => (
                  <ConfirmAction key={s.id} action={linkMismatch.bind(null, runId, m.id, s.id)} confirmText={linkText(s)} className={cx(btn.sm, "text-brand-700")} pendingText="…">
                    {label(s)} — {hasPay(s) ? "bog‘lash (to‘lovi bor)" : "shunga qo‘shish"}
                  </ConfirmAction>
                ))}
              </div>
            </div>
          ) : null}
          {unknown && students.length ? <LinkStudentPicker
              runId={runId}
              mismatchId={m.id}
              sheetName={m.studentName}
              amountText={amount}
              monthText={monthLabel(m.month)}
              paidIds={paidIds}
              students={students}
            /> : null}
        </div>
      </div>

      {/* O'ng ustun: tepada summalar (bitta qatorda, ism bilan bir chiziqda), ostida tugmalar; keng ekranda kengligi qat'iy */}
      <div className="flex w-full flex-col gap-2.5 sm:ml-auto sm:w-auto sm:items-end lg:w-[24rem]">
        <dl className="num flex flex-wrap items-baseline gap-x-5 gap-y-1 pt-0.5 text-sm sm:justify-end">
          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            <dt className="text-ink-400">Saytda</dt>
            <dd className="font-semibold text-ink-900">{m.siteAmount ? formatMoney(m.siteAmount) : "—"}</dd>
          </div>
          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            <dt className="text-ink-400">Sheets’da</dt>
            <dd className="font-semibold text-ink-900">{m.sheetAmount ? formatMoney(m.sheetAmount) : "—"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {m.kind === "missing_on_site" ? (
            <ConfirmAction
              action={importMismatch.bind(null, runId, m.id)}
              confirmText={`${m.studentName}: Sheets’dagi ${amount} to‘lov saytga qo‘shilsinmi?`}
              className={cx(btn.sm, "text-brand-700")}
              pendingText="…"
            >
              Saytga qo‘shish
            </ConfirmAction>
          ) : null}
          {single ? (
            <ConfirmAction action={linkMismatch.bind(null, runId, m.id, single.id)} confirmText={linkText(single)} className={cx(btn.sm, "text-brand-700")} pendingText="…">
              {hasPay(single) ? "Saytdagi o‘quvchiga bog‘lash" : "Saytdagi o‘quvchiga qo‘shish"}
            </ConfirmAction>
          ) : null}
          {unknown && !matches.length ? (
            <ConfirmAction
              action={importMismatch.bind(null, runId, m.id)}
              confirmText={`«${m.studentName}» saytga yangi o‘quvchi sifatida qo‘shiladi${details ? ` (${details})` : ""} va Sheets’dagi to‘lovlari kiritiladi. Davom etilsinmi?`}
              className={cx(btn.sm, "text-brand-700")}
              pendingText="…"
            >
              Yangi o‘quvchi sifatida qo‘shish
            </ConfirmAction>
          ) : null}
          {m.studentId && m.kind !== "missing_on_site" ? (
            <Link href={`/students/${m.studentId}?month=${m.month}`} className={btn.sm}>
              <Eye className="size-4" aria-hidden />
              Ko‘rish
            </Link>
          ) : null}
          <ConfirmAction
            action={resolveMismatch.bind(null, runId, m.id)}
            confirmText="Bu farq hal qilindi deb belgilansinmi? (Keyingi tekshiruvda farq saqlansa, yana ko‘rinadi.)"
            className={btn.sm}
            pendingText="…"
            title="Hal qilindi deb belgilash"
          >
            Hal qilindi ✓
          </ConfirmAction>
        </div>
      </div>
    </li>
  );
}

/** Kurslar bo'yicha filtr: solishtirilgan kurslar va (sozlamadagi filtr tufayli) solishtirilmaganlari. */
function CourseChips({ run, selected }: { run: SyncRunView; selected: string }) {
  const compared = run.courseStats.filter((c) => c.rows > 0);
  const ignored = run.courseStats.filter((c) => c.rows === 0 && c.ignored > 0);
  const chip = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Kurs bo‘yicha">
      <Link href="/sync" scroll={false} className={cx(chip, !selected ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-600 ring-line hover:bg-slate-50")}>
        Barcha kurslar
        <span className="num opacity-70">{run.sheetRowCount}</span>
      </Link>
      {compared.map((c) => {
        const on = sameCourse(c.course, selected);
        return (
          <Link
            key={c.course}
            href={`/sync?${new URLSearchParams({ kurs: c.course })}`}
            scroll={false}
            className={cx(chip, on ? "bg-ink-900 text-surface ring-ink-900" : "bg-surface text-ink-600 ring-line hover:bg-slate-50")}
          >
            <BookOpen className="size-3.5" aria-hidden />
            {c.course}
            <span className="num opacity-70">{c.rows}</span>
          </Link>
        );
      })}
      {ignored.map((c) => (
        <Link
          key={c.course}
          href="/sync#sozlamalar"
          title="Sozlamalardagi kurs filtri tufayli solishtirilmaydi — qo‘shish uchun bosing"
          className={cx(chip, "border-dashed bg-transparent text-ink-400 ring-line hover:text-ink-600")}
        >
          {c.course}
          <span className="num">{c.ignored} qator · solishtirilmaydi</span>
        </Link>
      ))}
    </div>
  );
}
