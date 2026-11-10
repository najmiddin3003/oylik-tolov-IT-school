import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarRange, Download, ExternalLink, FileSpreadsheet, History, Info, ListChecks, Wallet } from "lucide-react";
import { btn, Card, CardHeader, cx, MiniStat, PageHeader, PageSkeleton, Tag } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { getSheetArchive } from "@/lib/data";
import { columnLetter, sheetDocument } from "@/lib/sheet-archive-rules";
import { formatDate, formatDateTime, formatMoney, formatNumber, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Sheets arxivi" };

export default function SheetArchivePage({ params, searchParams }: PageProps<"/sync/arxiv/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SheetArchiveView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Archive = NonNullable<Awaited<ReturnType<typeof getSheetArchive>>>;

const TRIGGER: Record<Archive["trigger"], string> = {
  salary: "oylik olinganda (avtomatik)",
  auto: "oylik olingan — tekshiruvda (avtomatik)",
  manual: "qo‘lda",
};

async function SheetArchiveView({
  params,
  searchParams,
}: {
  params: PageProps<"/sync/arxiv/[id]">["params"];
  searchParams: PageProps<"/sync/arxiv/[id]">["searchParams"];
}) {
  await ownerGuard();
  const { id } = await params;
  const sp = await searchParams;
  const a = await getSheetArchive(id);
  if (!a) notFound();
  // Ko'rinish: Google'dagi varaq (?v=0, 1…) yoki qiymatlar va qatorlar kuzatuvi (?v=qiymatlar)
  const v = typeof sp.v === "string" ? sp.v : "";
  const tabIndex = /^\d+$/.test(v) ? Number(v) : a.tabs.length && v !== "qiymatlar" ? 0 : -1;
  const tab = tabIndex >= 0 ? a.tabs[tabIndex] : undefined;
  const showValues = !tab;
  const chip = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition";
  const on = "bg-ink-900 text-surface ring-ink-900";
  const off = "bg-surface text-ink-600 ring-line hover:bg-slate-50";

  return (
    <>
      <PageHeader
        eyebrow="Google Sheets arxivi"
        title={`${monthLabel(a.month)} jadvali`}
        subtitle={[a.title, a.tab].filter(Boolean).join(" · ") || "Google Sheets"}
        actions={
          <>
            <Link href="/sync" className={btn.outline}>
              <ArrowLeft className="size-4" aria-hidden />
              Google Sheets
            </Link>
            {a.hasXlsx ? (
              <a href={`/api/sheet-archive/${a.id}?f=xlsx`} className={btn.outline}>
                <Download className="size-4" aria-hidden />
                Asl fayl (.xlsx)
              </a>
            ) : null}
            <a href={`/api/sheet-archive/${a.id}?f=csv`} className={btn.outline}>
              <Download className="size-4" aria-hidden />
              CSV
            </a>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4 xl:gap-5">
        <MiniStat label="To‘lov qatorlari" value={a.records} hint={`jadvalda ${a.rowCount} qator`} icon={ListChecks} tone="brand" />
        <MiniStat label="Jami summa" value={<span className="text-xl">{formatNumber(a.total)}</span>} unit="so‘m" icon={Wallet} tone="emerald" />
        <MiniStat
          label="To‘lov sanalari"
          value={<span className="text-lg">{a.dateFrom ? `${shortDate(a.dateFrom, a.dateTo)} – ${formatDate(a.dateTo)}` : "—"}</span>}
          icon={CalendarRange}
          tone="violet"
        />
        <MiniStat
          label="Arxivga saqlangan"
          value={<span className="text-xl">{formatDate(a.capturedAt)}</span>}
          hint={<span title={`${TRIGGER[a.trigger]}${a.capturedByName ? ` · ${a.capturedByName}` : ""}`}>{formatDateTime(a.capturedAt).split(" ").at(-1)} · {TRIGGER[a.trigger]}</span>}
          icon={History}
          tone="slate"
        />
      </div>

      <div className="mb-6 grid gap-2 text-[13px] text-ink-500">
        <p className="flex min-w-0 items-start gap-2">
          <FileSpreadsheet className="mt-px size-4 shrink-0 text-ink-400" aria-hidden />
          <span className="min-w-0">
            Asl havola:{" "}
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="break-all text-brand-700 hover:underline">
              {a.url}
              <ExternalLink className="ml-1 inline size-3.5 align-[-2px]" aria-hidden />
            </a>{" "}
            <span className="text-ink-400">— jadval keyin o‘chirilsa yoki o‘zgartirilsa ham, quyidagi nusxa arxivlash paytidagi holicha qoladi.</span>
          </span>
        </p>
        {a.courses.length ? (
          <p className="num flex flex-wrap items-center gap-1.5">
            <span>Kurslar:</span>
            {a.courses.map((c) => (
              <Tag key={c.course}>
                {c.course} · {c.rows} ta · {formatMoney(c.total)}
              </Tag>
            ))}
          </p>
        ) : null}
        {a.warnings.length ? <p className="text-amber-700">Eslatma: {a.warnings.join("; ")}</p> : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Varaqlar">
        {a.tabs.map((t, i) => (
          <Link key={t.name + i} href={`/sync/arxiv/${a.id}?v=${i}`} scroll={false} className={cx(chip, i === tabIndex ? on : off)}>
            <FileSpreadsheet className="size-3.5" aria-hidden />
            {t.name}
            {t.main ? <span className="opacity-70">· solishtirilgan</span> : null}
          </Link>
        ))}
        <Link href={`/sync/arxiv/${a.id}?v=qiymatlar`} scroll={false} className={cx(chip, showValues ? on : off)}>
          <History className="size-3.5" aria-hidden />
          Qatorlar va vaqtlari
          {a.removedRows.length ? <span className="opacity-70">· {a.removedRows.length} o‘chirilgan</span> : null}
        </Link>
      </div>

      {tab ? (
        <Card className="mb-6 overflow-hidden">
          {/* Google'ning o'zi chizgan ko'rinish (ranglar, shriftlar, kenglik) — skriptsiz, alohida oynada */}
          <iframe
            title={`${tab.name} — arxivlangan ko‘rinish`}
            sandbox=""
            srcDoc={sheetDocument(a.css, tab.html)}
            className="block h-[75vh] w-full border-0 bg-white"
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              «{a.tab || "Asosiy varaq"}» qiymatlari. Google jadvalga qachon yozilganini bermaydi — oxirgi ustunda sayt shu qatorni Sheets’da{" "}
              <b className="font-semibold text-ink-700">birinchi marta ko‘rgan vaqt</b> (har tekshiruvda: kuniga kamida bir marta va «Hozir tekshirish»da).
              Kuzatuv shu imkoniyat qo‘shilgan kundan boshlab yuritiladi.
            </span>
          </p>
          <Card className="mb-6 overflow-hidden">
            <SheetGrid rows={a.rows} extra={{ title: "Saytda birinchi ko‘rilgan", values: a.rowSeen.map((d) => (d ? formatDateTime(d) : "")) }} />
          </Card>
          {a.removedRows.length ? (
            <Card className="mb-6 overflow-hidden">
              <CardHeader
                title="O‘chirilgan yoki o‘zgartirilgan qatorlar"
                count={a.removedRows.length}
                subtitle="Ilgari Sheets’da ko‘rilgan, arxivlash paytida esa yo‘q edi. Qator o‘zgartirilsa — eski holati shu yerda, yangisi jadvalda."
              />
              <div className="border-t border-line-soft">
                <SheetGrid
                  rows={a.removedRows.map((r) => r.cells)}
                  rowNumbers={a.removedRows.map((r) => r.row)}
                  extra={{
                    title: "Ko‘rilgan vaqti",
                    values: a.removedRows.map((r) => `${formatDateTime(r.firstSeenAt)} – ${formatDateTime(r.lastSeenAt)}`),
                  }}
                />
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

/** Oraliq boshi: yil bir xil bo'lsa — yilsiz ("12.10"). */
function shortDate(from: string, to: string): string {
  const f = formatDate(from);
  return from.slice(0, 4) === to.slice(0, 4) ? f.slice(0, 5) : f;
}

const NUMERIC = /^[-+]?[\d\s.,]+%?$/;

/** Google Sheets ko'rinishidagi jadval: ustun harflari, qator raqamlari, katakchalar chiziqlari. */
function SheetGrid({ rows, rowNumbers, extra }: { rows: string[][]; rowNumbers?: number[]; extra?: { title: string; values: string[] } }) {
  const cols = Math.max(0, ...rows.map((r) => r.length));
  const cell = "border-b border-r border-[#e1e1e1] px-2 py-[3px] align-bottom";
  const head = "sticky top-0 z-10 border-b border-r border-[#c7c7c7] bg-[#f8f9fa] px-2 py-1 text-center text-[11px] font-normal text-[#5f6368]";
  if (!rows.length) return <p className="px-6 py-5 text-sm text-ink-400">Jadval bo‘sh edi.</p>;
  return (
    <div className="max-h-[75vh] overflow-auto bg-white text-[13px] leading-snug text-[#202124] [font-family:Arial,Helvetica,sans-serif]">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cx(head, "sticky left-0 z-20 min-w-11")} aria-label="Qator" />
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} className={head}>
                {columnLetter(i)}
              </th>
            ))}
            {extra ? <th className={cx(head, "bg-[#eef0ff] font-medium text-[#1a24b8]")}>{extra.title}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th className="sticky left-0 z-[5] border-b border-r border-[#c7c7c7] bg-[#f8f9fa] px-2 text-center text-[11px] font-normal text-[#5f6368]">
                {rowNumbers ? rowNumbers[i] : i + 1}
              </th>
              {Array.from({ length: cols }, (_, j) => {
                const v = r[j] ?? "";
                return (
                  <td key={j} className={cx(cell, "max-w-[22rem] whitespace-pre-line", NUMERIC.test(v.trim()) && "num text-right")}>
                    {v}
                  </td>
                );
              })}
              {extra ? <td className={cx(cell, "num whitespace-nowrap bg-[#fafbff] text-[12px] text-[#5f6368]")}>{extra.values[i] ?? ""}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
