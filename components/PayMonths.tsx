// «Oylar bo'yicha oylik» jadvali (xodim sahifasi va «Profilim»): har oy hisoblangan oylik, olingan oylik/avans va qolgani.
// Oy bosilsa — sahifa o'sha oyga o'tadi va yuqoridagi «Oylik» kartasi (id="oylik") ochiladi.
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import type { PayMonth } from "@/lib/data";
import { formatMoney, formatNumber, monthLabel } from "@/lib/time";
import { Card, cx, IconTile, td, th } from "./ui";

export function PayMonths({
  rows,
  selected,
  current,
  basePath,
  baseLabel,
}: {
  /** Eng yangisi birinchi */
  rows: PayMonth[];
  selected: string;
  current: string;
  /** Oy havolasi: `${basePath}?month=YYYY-MM` */
  basePath: string;
  /** Foizli oylikda tushum ustuni nomi ("O‘quvchilari tushumi" / "Markaz tushumi"); belgilangan oylikda — yo'q */
  baseLabel: string | null;
}) {
  const total = rows.reduce((t, r) => ({ base: t.base + r.base, share: t.share + r.share, taken: t.taken + r.taken, left: t.left + r.left }), {
    base: 0,
    share: 0,
    taken: 0,
    left: 0,
  });
  const right = cx(th, "text-right");

  return (
    <Card className="overflow-hidden">
      <div className="group flex items-start gap-3.5 px-6 pb-5 pt-6">
        <IconTile icon={CalendarRange} tone="violet" variant="solid" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">Oylar bo‘yicha</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-500">Har oy hisoblangan oylik, olingan oylik/avans va qolgani. Oyni bosing — tafsiloti yuqorida ochiladi.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-line-soft px-6 py-5 text-sm text-ink-400">Hali oylik hisoblanmagan.</p>
      ) : (
        <>
          {/* Telefon: ixcham ro'yxat (jadval sig'maydi) */}
          <ul className="divide-y divide-line-soft border-t border-line-soft sm:hidden">
            {rows.map((r) => {
              const active = r.month === selected;
              return (
                <li key={r.month}>
                  <Link
                    href={`${basePath}?month=${r.month}#oylik`}
                    aria-current={active ? "true" : undefined}
                    className={cx("relative flex items-center gap-3 px-5 py-3.5 transition", active ? "bg-brand-50/60" : "active:bg-slate-50")}
                  >
                    {active ? <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-600" aria-hidden /> : null}
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-[15px] font-medium", active ? "text-brand-700" : "text-ink-900")}>
                        {monthLabel(r.month)}
                        {r.month === current ? <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">joriy</span> : null}
                      </span>
                      <span className="num mt-0.5 block text-[13px] text-ink-500">
                        <span className="whitespace-nowrap">
                          oylik {formatNumber(r.share)}
                          {r.kind === "percent" ? ` (${r.percent}%)` : ""}
                        </span>{" "}
                        · <span className="whitespace-nowrap">olindi {formatNumber(r.taken)}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cx("num block text-[15px] font-semibold", r.left < 0 ? "text-rose-600" : r.left > 0 ? "text-emerald-600" : "text-ink-400")}>{formatNumber(r.left)}</span>
                      <span className="block text-[11px] text-ink-400">qoldi</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            <li className="num flex items-center gap-3 bg-slate-50/70 px-5 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink-900">Jami · {rows.length} oy</span>
                <span className="mt-0.5 block text-[13px] text-ink-500">
                  <span className="whitespace-nowrap">oylik {formatNumber(total.share)}</span> · <span className="whitespace-nowrap">olindi {formatNumber(total.taken)}</span>
                </span>
              </span>
              <span className={cx("shrink-0 text-right text-[15px] font-bold", total.left < 0 ? "text-rose-600" : "text-emerald-600")}>{formatMoney(total.left)}</span>
            </li>
          </ul>
          <div className="relative hidden overflow-x-auto border-t border-line-soft sm:block">
            <table className={cx("w-full", baseLabel ? "min-w-[620px]" : "min-w-[480px]")}>
              <thead className="bg-slate-50/70">
                <tr>
                  <th className={th}>Oy</th>
                  {baseLabel ? <th className={right}>{baseLabel}</th> : null}
                  <th className={right}>Oylik</th>
                  <th className={right}>Olindi</th>
                  <th className={right}>Qoldi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((r) => {
                  const active = r.month === selected;
                  return (
                    <tr key={r.month} className={cx("relative transition", active ? "bg-brand-50/60" : "hover:bg-slate-50/60")}>
                      <td className={cx(td, "whitespace-nowrap")}>
                        {active ? <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-600" aria-hidden /> : null}
                        <Link
                          href={`${basePath}?month=${r.month}#oylik`}
                          aria-current={active ? "true" : undefined}
                          className={cx("font-medium after:absolute after:inset-0", active ? "text-brand-700" : "text-ink-900 hover:text-brand-700")}
                        >
                          {monthLabel(r.month)}
                        </Link>
                        {r.month === current ? <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">joriy</span> : null}
                      </td>
                      {baseLabel ? <td className={cx(td, "num whitespace-nowrap text-right text-ink-600")}>{formatNumber(r.base)}</td> : null}
                      <td className={cx(td, "num whitespace-nowrap text-right")}>
                        <span className="font-semibold text-ink-900">{formatNumber(r.share)}</span>
                        {r.kind === "percent" ? <span className="ml-1.5 text-xs text-ink-400">{r.percent}%</span> : null}
                      </td>
                      <td className={cx(td, "num whitespace-nowrap text-right", r.taken ? "text-amber-700" : "text-ink-300")}>{r.taken ? `− ${formatNumber(r.taken)}` : "—"}</td>
                      <td className={cx(td, "num whitespace-nowrap text-right font-semibold", r.left < 0 ? "text-rose-600" : r.left > 0 ? "text-emerald-600" : "text-ink-300")}>
                        {formatNumber(r.left)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-line bg-slate-50/70">
                <tr>
                  <td className={cx(td, "whitespace-nowrap font-semibold text-ink-900")}>Jami · {rows.length} oy</td>
                  {baseLabel ? <td className={cx(td, "num whitespace-nowrap text-right font-semibold text-ink-700")}>{formatNumber(total.base)}</td> : null}
                  <td className={cx(td, "num whitespace-nowrap text-right font-bold text-ink-900")}>{formatNumber(total.share)}</td>
                  <td className={cx(td, "num whitespace-nowrap text-right font-semibold text-amber-700")}>{total.taken ? `− ${formatNumber(total.taken)}` : "—"}</td>
                  <td className={cx(td, "num whitespace-nowrap text-right font-bold", total.left < 0 ? "text-rose-600" : "text-emerald-600")}>{formatMoney(total.left)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
