// Google Sheets jadvalini qatorlar (string[][]) ko'rinishida o'qish.
//
// Ikki usul:
//  1) Service account (maxfiy jadval uchun tavsiya): GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
//     .env da bo'lsa, Sheets API orqali o'qiladi. Jadvalni shu email bilan "Ko'ruvchi" qilib ulashish kerak.
//  2) Kalitsiz: jadval "Havolaga ega har kim ko'ra oladi" bo'lsa, CSV eksport orqali o'qiladi.
import { importPKCS8, SignJWT } from "jose";
import { parseCSV } from "./csv";
import { filenameFromDisposition, sanitizeSheetHtml } from "./sheet-archive-rules";
import { readZip } from "./zip";

type SheetSource =
  | { kind: "gsheet"; id: string; gid: string | null }
  | { kind: "csv"; url: string };

/**
 * Jadvalning barqaror kaliti (havoladagi ortiqcha qismlarsiz): "gsheet:<id>:<gid>" yoki "csv:<havola>".
 * Bir jadvalning har xil ko'rinishdagi havolalari (…/edit#gid=0, …/edit?usp=sharing) bitta kalit beradi.
 */
export function sheetSourceKey(raw: string): string | null {
  const s = parseSheetUrl(raw);
  if (!s) return null;
  return s.kind === "gsheet" ? `gsheet:${s.id}:${s.gid ?? ""}` : `csv:${s.url}`;
}

export function parseSheetUrl(raw: string): SheetSource | null {
  const input = raw.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  if (url.hostname === "docs.google.com") {
    // "Internetda nashr qilish" havolasi: /spreadsheets/d/e/<pubId>/pubhtml yoki /pub
    const pub = /^\/spreadsheets\/d\/e\/([\w-]+)\/pub(html)?/.exec(url.pathname);
    if (pub) {
      const out = new URL(`https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub`);
      const gid = url.searchParams.get("gid");
      if (gid) out.searchParams.set("gid", gid);
      out.searchParams.set("single", "true");
      out.searchParams.set("output", "csv");
      return { kind: "csv", url: out.toString() };
    }
    const m = /^\/spreadsheets\/d\/([\w-]+)/.exec(url.pathname);
    if (!m) return null;
    // "#gid=" — hozir ochiq turgan varaq; "?gid=" esa havola birinchi ochilgandagisi bo'lib qolishi mumkin
    const gid =
      /(?:^#|[#&])gid=(\d+)/.exec(url.hash)?.[1] ?? url.searchParams.get("gid") ?? null;
    return { kind: "gsheet", id: m[1], gid };
  }

  // Boshqa har qanday CSV havola
  return { kind: "csv", url: url.toString() };
}

export class SheetError extends Error {}

export async function fetchSheetRows(sheetUrl: string): Promise<string[][]> {
  return (await readSheet(sheetUrl)).rows;
}

/** Jadval qiymatlari va (bilinsa) nomlari: jadval nomi («Chortoq tumani oktabr») va varaq nomi («O'quvchilar»). */
type SheetRead = { rows: string[][]; title: string; tab: string };

async function readSheet(sheetUrl: string): Promise<SheetRead> {
  const source = parseSheetUrl(sheetUrl);
  if (!source) throw new SheetError("Google Sheets havolasi noto'g'ri");

  if (source.kind === "gsheet" && hasServiceAccount()) {
    return fetchViaApi(source.id, source.gid);
  }
  const csvUrl =
    source.kind === "csv"
      ? source.url
      : `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv${
          source.gid ? `&gid=${source.gid}` : ""
        }`;
  return fetchCsv(csvUrl);
}

/**
 * Arxiv uchun to'liq nusxa: qiymatlar (asosiy varaq) va — Google jadvali bo'lsa — barcha varaqlarning Google'ning o'zi
 * chizgan HTML ko'rinishi (ranglar, shriftlar, kenglik) hamda asl .xlsx fayli. Qiymatlarni o'qib bo'lmasa — SheetError;
 * HTML yoki .xlsx olinmasa — faqat ogohlantirish (`warnings`), qiymatlar baribir saqlanadi.
 */
export type SheetSnapshot = SheetRead & {
  /** Varaqlar (Google HTML eksporti): nomi, HTML (tozalangan) va havoladagi (solishtiriladigan) varaqmi */
  tabs: { name: string; html: string; main: boolean }[];
  /** Google'ning varaq uslublari (resources/sheet.css) */
  css: string;
  xlsx: Buffer | null;
  warnings: string[];
};

const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
const MAX_TABS_HTML = 9 * 1024 * 1024;

export async function fetchSheetSnapshot(sheetUrl: string): Promise<SheetSnapshot> {
  const source = parseSheetUrl(sheetUrl);
  if (!source) throw new SheetError("Google Sheets havolasi noto'g'ri");
  const base = await readSheet(sheetUrl);
  const out: SheetSnapshot = { ...base, tabs: [], css: "", xlsx: null, warnings: [] };
  if (source.kind !== "gsheet") {
    out.warnings.push("Havola Google jadvali emas — faqat qiymatlar saqlandi");
    return out;
  }
  const exportUrl = (format: string) => `https://docs.google.com/spreadsheets/d/${source.id}/export?format=${format}`;
  const [zip, xlsx] = await Promise.allSettled([download(exportUrl("zip")), download(exportUrl("xlsx"))]);

  if (xlsx.status === "fulfilled") {
    out.xlsx = xlsx.value.buf;
    const name = filenameFromDisposition(xlsx.value.headers.get("content-disposition"));
    if (name) out.title = name.replace(/\.xlsx$/i, "");
  } else {
    out.warnings.push(`Asl .xlsx fayl olinmadi: ${(xlsx.reason as Error).message}`);
  }
  // CSV fayl nomi: "<jadval> - <varaq>"
  if (out.title && out.tab.startsWith(`${out.title} - `)) out.tab = out.tab.slice(out.title.length + 3);

  if (zip.status === "fulfilled") {
    try {
      const entries = readZip(zip.value.buf);
      out.css = entries.find((e) => e.name === "resources/sheet.css")?.data.toString("utf8") ?? "";
      let budget = MAX_TABS_HTML;
      for (const e of entries) {
        if (!e.name.endsWith(".html")) continue;
        const html = e.data.toString("utf8");
        if (!html.includes("<table")) continue; // bo'sh (diagramma) varaqlar
        if (html.length > budget) {
          out.warnings.push(`«${e.name.slice(0, -5)}» varag'i juda katta — ko'rinishi saqlanmadi`);
          continue;
        }
        budget -= html.length;
        out.tabs.push({ name: e.name.slice(0, -5), html: sanitizeSheetHtml(html), main: false });
      }
      const main =
        (source.gid && out.tabs.find((t) => t.html.includes(`id="${source.gid}R0"`))) ||
        out.tabs.find((t) => t.name === out.tab) ||
        out.tabs[0];
      if (main) {
        main.main = true;
        if (!out.tab) out.tab = main.name;
        // Asosiy (solishtiriladigan) varaq birinchi
        out.tabs = [main, ...out.tabs.filter((t) => t !== main)];
      }
    } catch (err) {
      out.warnings.push(`Jadval ko'rinishini o'qib bo'lmadi: ${(err as Error).message}`);
    }
  } else {
    out.warnings.push(`Jadval ko'rinishi (HTML) olinmadi: ${(zip.reason as Error).message}`);
  }
  return out;
}

/** Eksport faylini yuklab olish (service account bo'lsa — kalit bilan). */
async function download(url: string): Promise<{ buf: Buffer; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (hasServiceAccount()) headers.authorization = `Bearer ${await getAccessToken()}`;
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", cache: "no-store", headers, signal: AbortSignal.timeout(45_000) });
  } catch (err) {
    throw new SheetError(`ulanib bo'lmadi (${(err as Error).message})`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html")) throw new SheetError(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_EXPORT_BYTES) throw new SheetError("fayl juda katta");
  return { buf, headers: res.headers };
}

async function fetchCsv(url: string): Promise<SheetRead> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    throw new SheetError(`Jadvalga ulanib bo'lmadi: ${(err as Error).message}`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (res.status === 401 || res.status === 403 || res.status === 404 || type.includes("text/html")) {
    throw new SheetError(
      "Jadvalni o'qib bo'lmadi. Jadvalda «Ulashish → Havolaga ega har kim → Ko'ruvchi» yoqilganini tekshiring " +
        "yoki .env ga service account kalitini qo'shing.",
    );
  }
  if (!res.ok) throw new SheetError(`Jadvalni yuklashda xato: HTTP ${res.status}`);
  const name = filenameFromDisposition(res.headers.get("content-disposition")).replace(/\.csv$/i, "");
  return { rows: parseCSV(await res.text()), title: "", tab: name };
}

// ---------- Service account orqali Sheets API ----------

function hasServiceAccount(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const pem = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    // drive.readonly — arxiv uchun jadvalni .xlsx va HTML ko'rinishida yuklab olish
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new SheetError(`Google'dan token olinmadi: HTTP ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function sheetsGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 403 || res.status === 404) {
    throw new SheetError(
      `Jadvalga kirish yo'q. Jadvalni ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} bilan ulashing (Ko'ruvchi).`,
    );
  }
  if (!res.ok) throw new SheetError(`Sheets API xatosi: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchViaApi(id: string, gid: string | null): Promise<SheetRead> {
  const meta = await sheetsGet<{ properties?: { title?: string }; sheets: { properties: { sheetId: number; title: string } }[] }>(
    `${id}?fields=properties.title,sheets.properties(sheetId,title)`,
  );
  const tab =
    (gid && meta.sheets.find((s) => String(s.properties.sheetId) === gid)) || meta.sheets[0];
  if (!tab) throw new SheetError("Jadvalda varaq topilmadi");
  const range = encodeURIComponent(`'${tab.properties.title.replace(/'/g, "''")}'`);
  const data = await sheetsGet<{ values?: string[][] }>(
    `${id}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
  );
  return { rows: data.values ?? [], title: meta.properties?.title ?? "", tab: tab.properties.title };
}
