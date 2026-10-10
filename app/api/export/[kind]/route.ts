import { requireAuth } from "@/lib/auth";
import { getMonthOverview, listPayments, listStudents, type PayStatus, type StudentSort, type StudentTab } from "@/lib/data";
import { currentMonth, dateToISO, isValidMonth } from "@/lib/time";

// CSV eksport: /api/export/hisobot | oquvchilar | tolovlar  (?month=YYYY-MM va filtrlar)
// Excel (uz/ru) to'g'ri ochishi uchun: UTF-8 BOM va ";" ajratgich.

const STATUS: Record<PayStatus, string> = { paid: "To‘lagan", partial: "Qisman", unpaid: "To‘lamagan" };
const METHOD: Record<string, string> = { naqd: "Naqd", karta: "Karta", otkazma: "O‘tkazma" };

type Cell = string | number;

function cell(v: Cell): string {
  if (typeof v === "number") return String(v);
  // Formula sifatida bajarilib ketmasligi uchun (CSV injection)
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(header: string[], rows: Cell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

const code = (seq: number | null) => (seq ? `#${String(seq).padStart(3, "0")}` : "");

export async function GET(request: Request, ctx: RouteContext<"/api/export/[kind]">) {
  await requireAuth();
  const { kind } = await ctx.params;
  const url = new URL(request.url);
  const p = (k: string) => url.searchParams.get(k) ?? "";
  const month = isValidMonth(p("month")) ? p("month") : currentMonth();

  let body: string;
  let name: string;

  if (kind === "hisobot") {
    const { rows } = await getMonthOverview(month, p("group"));
    body = csv(
      ["№", "Ism Familiya", "Guruh", "Telefon", "Oylik to‘lov", "To‘landi", "Qarz", "Holat"],
      rows.map((r) => [code(r.seq), r.fullName, r.group, r.phone, r.monthlyFee, r.paid, r.debt, STATUS[r.status]]),
    );
    name = `hisobot-${month}.csv`;
  } else if (kind === "oquvchilar") {
    const status = p("status") === "inactive" || p("status") === "all" ? (p("status") as "inactive" | "all") : "active";
    const tab: StudentTab = p("tab") === "debt" || p("tab") === "paid" ? (p("tab") as StudentTab) : "all";
    const { rows } = await listStudents({
      q: p("q"),
      group: p("group"),
      status,
      month,
      tab,
      sort: "name" satisfies StudentSort,
      page: 1,
      pageSize: 100_000,
    });
    body = csv(
      ["№", "Ism Familiya", "Telefon", "Guruh", "Oylik to‘lov", `${month} to‘landi`, "Qarz", "Holat", "Faol"],
      rows.map((r) => [
        code(r.seq),
        r.fullName,
        r.phone,
        r.group,
        r.monthlyFee,
        r.paid,
        r.active && r.started ? r.debt : 0,
        !r.active ? "Nofaol" : !r.started ? "Hali boshlamagan" : STATUS[r.status],
        r.active ? "ha" : "yo‘q",
      ]),
    );
    name = `oquvchilar-${month}.csv`;
  } else if (kind === "tolovlar") {
    const { rows } = await listPayments(month, { q: p("q"), method: p("method") in METHOD ? p("method") : "" });
    body = csv(
      ["Sana", "O‘quvchi", "Guruh", "Oy uchun", "Summa", "Usul", "Izoh", "Manba"],
      rows.map((r) => [
        dateToISO(new Date(r.paidAt)),
        r.studentName,
        r.studentGroup,
        r.month,
        r.amount,
        METHOD[r.method] ?? r.method,
        r.note,
        r.source === "sheets" ? "Google Sheets" : "Sayt",
      ]),
    );
    name = `tolovlar-${month}.csv`;
  } else {
    return Response.json({ error: "noma'lum eksport turi" }, { status: 404 });
  }

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
