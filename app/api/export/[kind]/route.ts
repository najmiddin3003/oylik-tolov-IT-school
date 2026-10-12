import { requireAuth, requireOwner } from "@/lib/auth";
import {
  getMonthOverview,
  getShareSummary,
  listPayments,
  listStudents,
  type PayStatus,
  type StudentSort,
  type StudentTab,
} from "@/lib/data";
import { parseDayFilter, scheduleLabel } from "@/lib/schedule";
import { blank, day, headerRow, int, money, text, totalRow, xlsxResponse, type XlsxSheet } from "@/lib/xlsx";
import { currentMonth, dateToISO, isoToDate, isValidMonth, monthLabel } from "@/lib/time";

// Excel eksport: /api/export/hisobot | oquvchilar | tolovlar  (?month=YYYY-MM va filtrlar)
// Administrator faqat «tolovlar» ni yuklay oladi (ulush va oylik ma'lumotlarisiz).

const STATUS: Record<PayStatus, string> = { paid: "To‘lagan", partial: "Qisman", unpaid: "To‘lamagan" };
const METHOD: Record<string, string> = { naqd: "Naqd", karta: "Karta", otkazma: "O‘tkazma" };
const BY: Record<string, string> = { owner: "Rahbar", admin: "Administrator", system: "Google Sheets" };

const code = (seq: number | null) => (seq ? `#${String(seq).padStart(3, "0")}` : "");

/** Oy bo'yicha qisqa xulosa varag'i (rahbarga ulush va oylik/avans bilan). Guruh tanlansa — shu guruh bo'yicha. */
async function summarySheet(month: string, withShare: boolean, group = ""): Promise<XlsxSheet> {
  const { totals } = await getMonthOverview(month, group);
  const rows = [
    [text("Oy"), text(monthLabel(month))],
    ...(group ? [[text("Guruh"), text(group)]] : []),
    [text("Kutilayotgan tushum"), money(totals.expected)],
    [text("Tushgan summa"), money(totals.collected)],
    [text("  shundan naqd"), money(totals.cash)],
    [text("  karta va o‘tkazma"), money(totals.nonCash)],
    [text("Qolgan qarz"), money(totals.debt)],
    [text("Faol o‘quvchilar"), int(totals.students)],
    [text("To‘liq to‘laganlar"), int(totals.paid)],
    [text("Qisman to‘laganlar"), int(totals.partial)],
    [text("To‘lamaganlar"), int(totals.unpaid)],
  ];
  if (withShare) {
    // Ulush butun tushumdan hisoblanadi (guruh filtridan qat'i nazar)
    const collected = group ? (await getMonthOverview(month)).totals.collected : totals.collected;
    const share = await getShareSummary(month, collected);
    if (group) rows.push([blank(), blank()], [text("Butun markaz tushumi"), money(collected)]);
    rows.push(
      [blank(), blank()],
      [text(`Tushumning ${share.percent}%`), money(share.share, { fontWeight: "bold" })],
      [text("Olindi (oylik va avans)"), money(share.taken)],
      [text("Qoldi"), money(share.left, { fontWeight: "bold", textColor: share.left < 0 ? "#BE123C" : "#047857" })],
    );
    for (const s of share.salaries) {
      rows.push([text(`  ${s.kind === "oylik" ? "Oylik" : "Avans"} · ${dateToISO(new Date(s.date))}${s.note ? ` · ${s.note}` : ""}`), money(s.amount)]);
    }
  }
  return {
    sheet: "Xulosa",
    data: [headerRow(["Ko‘rsatkich", "Qiymat"]), ...rows],
    columns: [{ width: 34 }, { width: 22 }],
  };
}

export async function GET(request: Request, ctx: RouteContext<"/api/export/[kind]">) {
  const { role } = await requireAuth({ fresh: true });
  const { kind } = await ctx.params;
  const url = new URL(request.url);
  const p = (k: string) => (url.searchParams.get(k) ?? "").slice(0, 100);
  const month = isValidMonth(p("month")) ? p("month") : currentMonth();
  const isOwner = role === "owner";

  if (kind === "tolovlar") {
    const dayFilter = isoToDate(p("day")) ? p("day") : "";
    const { rows, total } = await listPayments(month, { q: p("q"), method: p("method") in METHOD ? p("method") : "", day: dayFilter });
    const data = [
      headerRow(["Sana", "O‘quvchi", "Qaysi oy uchun", "Summa", "Usul", "Izoh", "Kim kiritgan"]),
      ...rows.map((r) => [
        day(dateToISO(new Date(r.paidAt))),
        text(r.studentName),
        text(monthLabel(r.month)),
        money(r.amount),
        text(METHOD[r.method] ?? r.method),
        text(r.note),
        text(BY[r.createdBy] ?? ""),
      ]),
      totalRow([text("Jami"), text(`${rows.length} ta to‘lov`), blank(), money(total), blank(), blank(), blank()]),
    ];
    const sheets: XlsxSheet[] = [
      {
        sheet: "To‘lovlar",
        data,
        columns: [{ width: 12 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 11 }, { width: 30 }, { width: 15 }],
        stickyRowsCount: 1,
      },
      await summarySheet(month, isOwner),
    ];
    return xlsxResponse(sheets, dayFilter ? `tolovlar-${dayFilter}.xlsx` : `tolovlar-${month}.xlsx`);
  }

  // Quyidagilari — faqat rahbar uchun
  if (!isOwner) await requireOwner();

  if (kind === "hisobot") {
    const { rows } = await getMonthOverview(month, p("group"));
    const sheets: XlsxSheet[] = [
      await summarySheet(month, true, p("group")),
      {
        sheet: "O‘quvchilar",
        data: [
          headerRow(["№", "Ism Familiya", "Guruh", "Dars vaqti", "Telefon", "Oylik to‘lov", "To‘landi", "Qarz", "Holat"]),
          ...rows.map((r) => [
            text(code(r.seq)),
            text(r.fullName),
            text(r.group),
            text(scheduleLabel(r.lessons)),
            text(r.phone),
            money(r.monthlyFee),
            money(r.paid),
            money(r.debt),
            text(STATUS[r.status], { textColor: r.status === "paid" ? "#047857" : r.status === "partial" ? "#1F2DE6" : "#B45309" }),
          ]),
          totalRow([
            text("Jami"),
            text(`${rows.length} ta o‘quvchi`),
            blank(),
            blank(),
            blank(),
            money(rows.reduce((s, r) => s + r.monthlyFee, 0)),
            money(rows.reduce((s, r) => s + r.paid, 0)),
            money(rows.reduce((s, r) => s + r.debt, 0)),
            blank(),
          ]),
        ],
        columns: [{ width: 7 }, { width: 30 }, { width: 18 }, { width: 28 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 13 }],
        stickyRowsCount: 1,
      },
    ];
    return xlsxResponse(sheets, `hisobot-${month}.xlsx`);
  }

  if (kind === "oquvchilar") {
    const status = p("status") === "inactive" || p("status") === "all" ? (p("status") as "inactive" | "all") : "active";
    const tab: StudentTab = p("tab") === "debt" || p("tab") === "paid" ? (p("tab") as StudentTab) : "all";
    const { rows } = await listStudents({
      q: p("q"),
      group: p("group"),
      day: parseDayFilter(p("day")),
      status,
      month,
      tab,
      sort: "name" satisfies StudentSort,
      page: 1,
      pageSize: 100_000,
    });
    const sheets: XlsxSheet[] = [
      {
        sheet: "O‘quvchilar",
        data: [
          headerRow(["№", "Ism Familiya", "Telefon", "Guruh", "Dars vaqti", "Oylik to‘lov", `${monthLabel(month)}: to‘landi`, "Qarz", "Holat"]),
          ...rows.map((r) => [
            text(code(r.seq)),
            text(r.fullName),
            text(r.phone),
            text(r.group),
            text(scheduleLabel(r.lessons)),
            money(r.monthlyFee),
            money(r.paid),
            money(r.active && r.started ? r.debt : 0),
            text(!r.active ? "Nofaol" : !r.started ? "Hali boshlamagan" : STATUS[r.status]),
          ]),
        ],
        columns: [{ width: 7 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 28 }, { width: 14 }, { width: 20 }, { width: 14 }, { width: 17 }],
        stickyRowsCount: 1,
      },
    ];
    return xlsxResponse(sheets, `oquvchilar-${month}.xlsx`);
  }

  return Response.json({ error: "noma'lum eksport turi" }, { status: 404 });
}
