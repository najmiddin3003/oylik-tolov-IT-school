import { logActivity } from "@/lib/activity";
import { requireAuth, requireOwner, type Session } from "@/lib/auth";
import {
  getMonthOverview,
  getStaffPay,
  getTeamOverview,
  listPayments,
  listStudents,
  parseStudentTab,
  type PayStatus,
  type StudentSort,
  type StudentTab,
} from "@/lib/data";
import type { SalaryRow } from "@/lib/pay";
import { parseDayFilter, scheduleLabel } from "@/lib/schedule";
import { isTeaching } from "@/lib/staff-rules";
import { blank, day, headerRow, int, money, text, totalRow, xlsxResponse, type XlsxSheet } from "@/lib/xlsx";
import { currentMonth, dateToISO, formatNumber, isoToDate, isValidMonth, monthLabel } from "@/lib/time";

// Excel eksport: /api/export/hisobot | oquvchilar | tolovlar  (?month=YYYY-MM va filtrlar)
// Administrator — faqat «tolovlar»; o'qituvchi — o'z o'quvchilari bo'yicha «tolovlar» va «oquvchilar»; «hisobot» — rahbar.

const STATUS: Record<PayStatus, string> = { paid: "To‘lagan", partial: "Qisman", unpaid: "To‘lamagan" };
const METHOD: Record<string, string> = { naqd: "Naqd", karta: "Karta", otkazma: "O‘tkazma" };
const BY: Record<string, string> = { owner: "Rahbar", admin: "Administrator", system: "Google Sheets" };

const code = (seq: number | null) => (seq ? `#${String(seq).padStart(3, "0")}` : "");

type Viewer = { role: Session["role"]; staffId: string | null };

/**
 * Oy bo'yicha qisqa xulosa varag'i. Rahbarga — xodimlar oyligi va markazga qolgani,
 * o'qituvchiga — o'z oyligi. Guruh tanlansa — shu guruh bo'yicha.
 */
async function summarySheet(month: string, viewer: Viewer, group = ""): Promise<XlsxSheet> {
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
  const payLines = (label: string, pay: { kind: "percent" | "fixed"; percent: number; share: number; taken: number; left: number }, salaries: SalaryRow[]) => {
    rows.push(
      [blank(), blank()],
      [text(pay.kind === "fixed" ? label : `${label} (${pay.percent}%)`), money(pay.share, { fontWeight: "bold" })],
      [text("Olindi (oylik va avans)"), money(pay.taken)],
      [text("Qoldi"), money(pay.left, { fontWeight: "bold", textColor: pay.left < 0 ? "#BE123C" : "#047857" })],
    );
    for (const x of salaries) {
      rows.push([text(`  ${x.kind === "oylik" ? "Oylik" : "Avans"} · ${dateToISO(new Date(x.date))}${x.note ? ` · ${x.note}` : ""}`), money(x.amount)]);
    }
  };
  if (viewer.role === "owner") {
    // Butun markaz bo'yicha (guruh filtridan qat'i nazar)
    const team = await getTeamOverview(month);
    rows.push(
      [blank(), blank()],
      [text("Butun markaz tushumi"), money(team.finance.collected)],
      [text("Xodimlar oyligi (jami)"), money(team.finance.staffShare, { fontWeight: "bold" })],
    );
    for (const m of team.members) {
      // Rahbar — faqat dars ham bersa (o'qituvchi sifatidagi oyligi)
      if (m.role === "owner" && !isTeaching(m)) continue;
      rows.push([text(`  ${m.name} · ${m.pay.kind === "fixed" ? "belgilangan oylik" : `${m.pay.percent}%`} · olindi ${formatNumber(m.pay.taken)}`), money(m.pay.share)]);
    }
    rows.push(
      [text("Berilgan avans (shu oy hisobidan)"), money(team.finance.given.avans)],
      [text("Berilgan oylik (shu oy hisobidan)"), money(team.finance.given.oylik)],
    );
  } else if (viewer.role === "teacher" && viewer.staffId) {
    const pay = await getStaffPay(viewer.staffId, month);
    if (pay) payLines("Mening oyligim", pay, pay.salaries);
  }
  return {
    sheet: "Xulosa",
    data: [headerRow(["Ko‘rsatkich", "Qiymat"]), ...rows],
    columns: [{ width: 40 }, { width: 22 }],
  };
}

export async function GET(request: Request, ctx: RouteContext<"/api/export/[kind]">) {
  const session = await requireAuth({ fresh: true });
  const { role } = session;
  const viewer: Viewer = { role, staffId: session.staffId };
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
      await summarySheet(month, viewer),
    ];
    await logActivity(session, "export.tolovlar", `Excel yuklab olindi: to‘lovlar — ${dayFilter || monthLabel(month)}`);
    return xlsxResponse(sheets, dayFilter ? `tolovlar-${dayFilter}.xlsx` : `tolovlar-${month}.xlsx`);
  }

  // O'qituvchi o'z o'quvchilari ro'yxatini yuklay oladi; qolganlari — faqat rahbar uchun
  if (!isOwner && !(role === "teacher" && kind === "oquvchilar")) await requireOwner();

  if (kind === "hisobot") {
    const { rows } = await getMonthOverview(month, p("group"));
    const sheets: XlsxSheet[] = [
      await summarySheet(month, viewer, p("group")),
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
    await logActivity(session, "export.hisobot", `Excel yuklab olindi: oylik hisobot — ${monthLabel(month)}`);
    return xlsxResponse(sheets, `hisobot-${month}.xlsx`);
  }

  if (kind === "oquvchilar") {
    const status = p("status") === "inactive" || p("status") === "all" ? (p("status") as "inactive" | "all") : "active";
    const tab: StudentTab = parseStudentTab(p("tab"));
    const { rows } = await listStudents({
      q: p("q"),
      group: p("group"),
      day: parseDayFilter(p("day")),
      teacher: /^([a-f0-9]{24}|none)$/i.test(p("teacher")) ? p("teacher") : "",
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
    await logActivity(session, "export.oquvchilar", `Excel yuklab olindi: o‘quvchilar ro‘yxati — ${monthLabel(month)}`);
    return xlsxResponse(sheets, `oquvchilar-${month}.xlsx`);
  }

  return Response.json({ error: "noma'lum eksport turi" }, { status: 404 });
}
