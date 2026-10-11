// Excel (.xlsx) fayl yasash uchun kichik yordamchilar (write-excel-file).
import writeXlsxFile, { type CellObject, type Row, type Sheet } from "write-excel-file/node";
import { isoToDate } from "./time";

export type XlsxSheet = Sheet<never>;

const BRAND_BG = "#EEF0FF";
const BRAND_TEXT = "#1A24B8";
const LINE = "#C6CCFF";

export function headerRow(titles: string[]): Row {
  return titles.map(
    (value): CellObject => ({
      value,
      type: String,
      fontWeight: "bold",
      backgroundColor: BRAND_BG,
      textColor: BRAND_TEXT,
      bottomBorderStyle: "thin",
      bottomBorderColor: LINE,
      alignVertical: "center",
      height: 22,
    }),
  );
}

export function text(value: string | null | undefined, extra: Omit<CellObject, "value" | "type"> = {}): CellObject {
  return { value: value ?? "", type: String, ...extra };
}

export function money(value: number, extra: Omit<CellObject, "value" | "type"> = {}): CellObject {
  return { value, type: Number, format: "#,##0", ...extra };
}

export function int(value: number, extra: Omit<CellObject, "value" | "type"> = {}): CellObject {
  return { value, type: Number, ...extra };
}

/** "YYYY-MM-DD" (Toshkent sanasi) -> Excel sanasi. UTC yarim tunida beriladi — kun siljib ketmaydi. */
export function day(iso: string): CellObject {
  if (!isoToDate(iso)) return text(iso);
  return { value: new Date(`${iso}T00:00:00Z`), type: Date, format: "dd.mm.yyyy" };
}

const TOTAL_STYLE: Omit<CellObject, "value" | "type"> = {
  fontWeight: "bold",
  topBorderStyle: "thin",
  topBorderColor: LINE,
  backgroundColor: "#F6F7FB",
};

/** Jadval oxiridagi "Jami" kabi ajratilgan qator. */
export function totalRow(cells: CellObject[]): Row {
  return cells.map((c) => ({ ...c, ...TOTAL_STYLE }));
}

export function blank(): CellObject {
  return text("");
}

export async function xlsxResponse(sheets: XlsxSheet[], filename: string): Promise<Response> {
  const buffer = await writeXlsxFile(sheets, { fontFamily: "Calibri", fontSize: 11 }).toBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
