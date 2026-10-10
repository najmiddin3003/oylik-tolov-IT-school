import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { importAllMismatches, importMismatch, resolveMismatch } from "@/app/actions/sync";
import { ConfirmAction } from "@/components/SubmitButton";
import { RunSyncButton, SheetSettingsForm } from "@/components/SyncForms";
import { btn, Card, CardHeader, EmptyState, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { pageGuard } from "@/lib/auth";
import { getSyncPageData, type MismatchRow, type SyncRunView } from "@/lib/data";
import type { MismatchKind } from "@/lib/models";
import { syncHour } from "@/lib/sync";
import { formatDate, formatDateTime, formatMoney, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Google Sheets" };

const KIND: Record<MismatchKind, { label: string; tone: "rose" | "amber" | "brand" | "slate"; help: string }> = {
  missing_on_site: { label: "Saytda yo'q", tone: "rose", help: "Sheets'da to'lov bor, saytda kiritilmagan" },
  missing_in_sheet: { label: "Sheets'da yo'q", tone: "amber", help: "Saytda to'lov bor, Sheets'da yozilmagan" },
  amount_diff: { label: "Summa farqi", tone: "brand", help: "Ikkala joyda bor, lekin summa har xil" },
  unknown_student: { label: "Saytda yo'q o'quvchi", tone: "slate", help: "Sheets'dagi o'quvchi saytda topilmadi" },
};

const TRIGGER = { auto: "avtomatik", cron: "cron", manual: "qo'lda" } as const;
const isImportable = (m: MismatchRow) => m.kind === "missing_on_site" || m.kind === "unknown_student";

export default function SyncPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SyncView />
    </Suspense>
  );
}

async function SyncView() {
  await pageGuard();
  const { settings, runs } = await getSyncPageData();
  const last = runs[0];
  const hour = String(syncHour()).padStart(2, "0");

  return (
    <>
      <PageHeader
        title="Google Sheets bilan solishtirish"
        subtitle={`Tizim har kuni soat ${hour}:00 da (Toshkent vaqti) Sheets'dagi to'lovlar jadvalini saytdagi ma'lumotlar bilan solishtiradi.`}
        actions={<RunSyncButton disabled={!settings.sheetUrl} />}
      />

      {!settings.sheetUrl ? (
        <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Boshlash uchun pastda Google Sheets havolasini kiriting va saqlang.
        </div>
      ) : null}

      {last ? (
        <LastRun run={last} />
      ) : settings.sheetUrl ? (
        <Card className="mb-6">
          <EmptyState title="Hali tekshiruv o'tkazilmagan">«Hozir tekshirish» tugmasini bosing.</EmptyState>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader title="Sozlamalar" />
        <div className="p-5">
          <SheetSettingsForm sheetUrl={settings.sheetUrl} columns={settings.columns} courseFilter={settings.courseFilter} />
        </div>
      </Card>

      {runs.length > 1 ? (
        <Card>
          <CardHeader title="Oxirgi tekshiruvlar" />
          <ul className="divide-y divide-slate-100">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span className="num text-slate-700">
                  {formatDateTime(r.startedAt)} <span className="text-slate-400">· {TRIGGER[r.trigger]}</span>
                </span>
                {r.ok ? (
                  r.mismatches.filter((m) => !m.resolved).length ? (
                    <Tag tone="amber">{r.mismatches.filter((m) => !m.resolved).length} ta farq</Tag>
                  ) : (
                    <Tag tone="emerald">Bir xil ✓</Tag>
                  )
                ) : (
                  <Tag tone="rose">Xato</Tag>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
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
      <Card className="mb-6 border-rose-200">
        <div className="p-5">
          <p className="text-sm font-semibold text-rose-700">Oxirgi tekshiruv bajarilmadi · {formatDateTime(run.startedAt)}</p>
          <p className="mt-1 text-sm text-rose-700/90">{run.error}</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Oxirgi tekshiruv" value={formatDateTime(run.startedAt)} small />
        <Mini
          label="Sheets'dagi to'lovlar"
          value={String(run.sheetRowCount)}
          hint={run.courseFilter ? `«${run.courseFilter}» qatorlari` : "barcha qatorlar"}
        />
        <Mini label="Mos keldi" value={String(run.matchedCount)} tone="text-emerald-600" />
        <Mini label="Farqlar" value={String(open.length)} tone={open.length ? "text-rose-600" : "text-emerald-600"} hint={resolved ? `${resolved} tasi hal qilingan` : undefined} />
      </div>
      <p className="mb-6 text-xs leading-relaxed text-slate-500">
        {run.basis === "date" ? "To'lov sanasi bo'yicha" : "To'lov oyi bo'yicha"} solishtirildi:{" "}
        <span className="num font-medium text-slate-700">{periodLabel(run)}</span>
        {run.courseFilter ? (
          <>
            {" "}
            · faqat «{run.courseFilter}»{run.filteredOut ? `, boshqa kurslarning ${run.filteredOut} ta qatori e'tiborsiz` : ""}
          </>
        ) : null}
        {run.basis === "date" ? ". Saytdagi to'lovlar «To'langan sana»si bo'yicha olinadi; jadvaldagi oxirgi sanadan keyingilari hali solishtirilmaydi." : "."}
      </p>

      <Card className="mb-6">
        <CardHeader
          title={open.length ? "Mos kelmagan to'lovlar" : "Natija"}
          right={
            importable.length ? (
              <ConfirmAction
                action={importAllMismatches.bind(null, run.id)}
                confirmText={`Sheets'dan saytga qo'shiladi: ${newStudents ? `${newStudents} ta yangi o'quvchi va ` : ""}${importable.length} ta yozuvdagi to'lovlar. Keyin qayta tekshiriladi. Davom etilsinmi?`}
                className={`${btn.primary} py-1.5`}
                pendingText="Qo'shilmoqda…"
              >
                Hammasini saytga qo&apos;shish ({importable.length})
              </ConfirmAction>
            ) : null
          }
        />
        {open.length === 0 ? (
          <EmptyState title="Sayt va Google Sheets bir xil ✓">
            {run.sheetRowCount ? `${periodLabel(run)} oralig'idagi barcha to'lovlar mos keldi.` : "Sheets'da solishtiriladigan to'lov topilmadi."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {open.map((m) => (
              <MismatchItem key={m.id} m={m} runId={run.id} basis={run.basis} />
            ))}
          </ul>
        )}
      </Card>

      {run.skipped.length ? (
        <Card className="mb-6">
          <details>
            <summary className="cursor-pointer px-5 py-3.5 text-sm font-medium text-slate-700">
              O&apos;qib bo&apos;lmagan qatorlar: {run.skipped.length} ta <span className="text-slate-400">(ko&apos;rsatish)</span>
            </summary>
            <ul className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
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
      ? `«${m.studentName}» saytga yangi o'quvchi sifatida qo'shiladi${details ? ` (${details})` : ""} va Sheets'dagi to'lovlari kiritiladi. Davom etilsinmi?`
      : `${m.studentName}: Sheets'dagi ${formatMoney(m.sheetAmount)} to'lov saytga qo'shilsinmi?`;

  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4 hover:bg-slate-50/60">
      <div className="min-w-[200px] flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span title={k.help}>
            <Tag tone={k.tone}>{k.label}</Tag>
          </span>
          <span className="text-xs text-slate-500">
            {monthLabel(m.month)}
            {basis === "date" ? " (to'langan oy)" : ""}
          </span>
        </div>
        {m.studentId ? (
          <Link href={`/students/${m.studentId}`} className="font-medium text-slate-900 hover:text-brand-600">
            {m.studentName}
          </Link>
        ) : (
          <span className="font-medium text-slate-900">{m.studentName}</span>
        )}
        {m.phone ? <span className="num ml-2 text-xs text-slate-500">{m.phone}</span> : null}
        {m.parts.length ? (
          <p className="num mt-0.5 text-xs text-slate-500">
            Sheets:{" "}
            {m.parts
              .map((p) => `${p.date ? formatDate(p.date) : "sanasiz"} — ${formatMoney(p.amount)}${p.card && !p.cash ? " (plastik)" : ""} · ${p.row}-qator`)
              .join("; ")}
          </p>
        ) : null}
        {m.kind === "unknown_student" && (m.group || m.fee) ? (
          <p className="mt-0.5 text-xs text-slate-500">
            {[m.group && `Kurs: ${m.group}`, m.fee && `oylik ${formatMoney(m.fee)}`].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {m.note ? <p className="mt-0.5 text-xs text-amber-700">{m.note}</p> : null}
      </div>

      <dl className="num grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-slate-500">Saytda</dt>
        <dd className="whitespace-nowrap text-right font-medium text-slate-900">{m.siteAmount ? formatMoney(m.siteAmount) : "—"}</dd>
        <dt className="text-slate-500">Sheets&apos;da</dt>
        <dd className="whitespace-nowrap text-right font-medium text-slate-900">{m.sheetAmount ? formatMoney(m.sheetAmount) : "—"}</dd>
      </dl>

      <div className="flex w-full flex-wrap gap-1 sm:ml-auto sm:w-auto sm:justify-end">
        {isImportable(m) ? (
          <ConfirmAction
            action={importMismatch.bind(null, runId, m.id)}
            confirmText={importText}
            className={`${btn.ghost} text-brand-600 hover:bg-brand-50`}
            pendingText="…"
          >
            Saytga qo&apos;shish
          </ConfirmAction>
        ) : null}
        {m.studentId && m.kind !== "missing_on_site" ? (
          <Link href={`/students/${m.studentId}?month=${m.month}`} className={btn.ghost}>
            Ko&apos;rish
          </Link>
        ) : null}
        <ConfirmAction
          action={resolveMismatch.bind(null, runId, m.id)}
          confirmText="Bu farq hal qilindi deb belgilansinmi? (Keyingi tekshiruvda farq saqlansa, yana ko'rinadi.)"
          className={btn.ghost}
          pendingText="…"
          title="Hal qilindi deb belgilash"
        >
          Hal qilindi ✓
        </ConfirmAction>
      </div>
    </li>
  );
}

function Mini({ label, value, hint, tone = "text-slate-900", small = false }: { label: string; value: string; hint?: string; tone?: string; small?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`num mt-1 font-semibold ${small ? "text-base" : "text-lg"} ${tone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}
