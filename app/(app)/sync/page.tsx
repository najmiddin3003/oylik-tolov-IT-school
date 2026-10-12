import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CircleCheck, Download, Eye, FileSpreadsheet, Info, TriangleAlert } from "lucide-react";
import { importAllMismatches, importMismatch, resolveMismatch } from "@/app/actions/sync";
import { ConfirmAction } from "@/components/SubmitButton";
import { RunSyncButton, SheetSettingsForm } from "@/components/SyncForms";
import { Avatar, btn, Card, CardHeader, cx, EmptyState, MiniStat, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { getSyncPageData, type MismatchRow, type SyncRunView } from "@/lib/data";
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

export default function SyncPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SyncView />
    </Suspense>
  );
}

async function SyncView() {
  await ownerGuard();
  const { settings, runs } = await getSyncPageData();
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
        <LastRun run={last} />
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
          <SheetSettingsForm sheetUrl={settings.sheetUrl} columns={settings.columns} courseFilter={settings.courseFilter} autoImport={settings.autoImport} />
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

function LastRun({ run }: { run: SyncRunView }) {
  const open = run.mismatches.filter((m) => !m.resolved);
  const resolved = run.mismatches.length - open.length;
  const importable = open.filter(isImportable);
  const newStudents = new Set(importable.filter((m) => m.kind === "unknown_student").map((m) => m.studentName.toLowerCase())).size;

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
      <div className="mb-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MiniStat label="Oxirgi tekshiruv" value={<span className="text-xl">{formatDateTime(run.startedAt)}</span>} icon={CalendarClock} tone="slate" />
        <MiniStat label={run.courseFilter ? `«${run.courseFilter}» to‘lovlari` : "Sheets’dagi to‘lovlar"} value={run.sheetRowCount} icon={FileSpreadsheet} tone="brand" />
        <MiniStat label="Mos keldi" value={run.matchedCount} icon={CircleCheck} tone="emerald" />
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
            importable.length ? (
              <ConfirmAction
                action={importAllMismatches.bind(null, run.id)}
                confirmText={`Sheets’dan saytga qo‘shiladi: ${newStudents ? `${newStudents} ta yangi o‘quvchi va ` : ""}${importable.length} ta yozuvdagi to‘lovlar. Keyin qayta tekshiriladi. Davom etilsinmi?`}
                className={cx(btn.primary, "h-10")}
                pendingText="Qo‘shilmoqda…"
              >
                <Download className="size-4" aria-hidden />
                Hammasini saytga qo‘shish ({importable.length})
              </ConfirmAction>
            ) : null
          }
        />
        {open.length === 0 ? (
          <div className="border-t border-line-soft">
            <EmptyState title="Sayt va Google Sheets bir xil ✓" icon={CircleCheck}>
              {run.sheetRowCount ? `${periodLabel(run)} oralig‘idagi barcha to‘lovlar mos keldi.` : "Sheets’da solishtiriladigan to‘lov topilmadi."}
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {open.map((m) => (
              <MismatchItem key={m.id} m={m} runId={run.id} basis={run.basis} />
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

function MismatchItem({ m, runId, basis }: { m: MismatchRow; runId: string; basis: "month" | "date" }) {
  const k = KIND[m.kind];
  const details = [m.group, m.fee ? `oylik ${formatMoney(m.fee)}` : ""].filter(Boolean).join(", ");
  const importText =
    m.kind === "unknown_student"
      ? `«${m.studentName}» saytga yangi o‘quvchi sifatida qo‘shiladi${details ? ` (${details})` : ""} va Sheets’dagi to‘lovlari kiritiladi. Davom etilsinmi?`
      : `${m.studentName}: Sheets’dagi ${formatMoney(m.sheetAmount)} to‘lov saytga qo‘shilsinmi?`;

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
            {m.kind === "unknown_student" && details ? ` · ${details}` : ""}
          </p>
          {m.parts.length ? (
            <p className="num mt-0.5 text-xs text-ink-400">
              Sheets:{" "}
              {m.parts
                .map((p) => `${p.date ? formatDate(p.date) : "sanasiz"} — ${formatMoney(p.amount)}${p.card && !p.cash ? " (plastik)" : ""} · ${p.row}-qator`)
                .join("; ")}
            </p>
          ) : null}
          {m.note ? <p className="mt-0.5 text-xs text-amber-700">{m.note}</p> : null}
        </div>
      </div>

      <dl className="num grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-400">Saytda</dt>
        <dd className="whitespace-nowrap text-right font-semibold text-ink-900">{m.siteAmount ? formatMoney(m.siteAmount) : "—"}</dd>
        <dt className="text-ink-400">Sheets’da</dt>
        <dd className="whitespace-nowrap text-right font-semibold text-ink-900">{m.sheetAmount ? formatMoney(m.sheetAmount) : "—"}</dd>
      </dl>

      <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto sm:justify-end">
        {isImportable(m) ? (
          <ConfirmAction action={importMismatch.bind(null, runId, m.id)} confirmText={importText} className={cx(btn.sm, "text-brand-700")} pendingText="…">
            Saytga qo‘shish
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
    </li>
  );
}
