// Google Sheets jadvalini qatorlar (string[][]) ko'rinishida o'qish.
//
// Ikki usul:
//  1) Service account (maxfiy jadval uchun tavsiya): GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
//     .env da bo'lsa, Sheets API orqali o'qiladi. Jadvalni shu email bilan "Ko'ruvchi" qilib ulashish kerak.
//  2) Kalitsiz: jadval "Havolaga ega har kim ko'ra oladi" bo'lsa, CSV eksport orqali o'qiladi.
import { importPKCS8, SignJWT } from "jose";
import { parseCSV } from "./csv";

type SheetSource =
  | { kind: "gsheet"; id: string; gid: string | null }
  | { kind: "csv"; url: string };

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

async function fetchCsv(url: string): Promise<string[][]> {
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
  return parseCSV(await res.text());
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
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
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

async function fetchViaApi(id: string, gid: string | null): Promise<string[][]> {
  const meta = await sheetsGet<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    `${id}?fields=sheets.properties(sheetId,title)`,
  );
  const tab =
    (gid && meta.sheets.find((s) => String(s.properties.sheetId) === gid)) || meta.sheets[0];
  if (!tab) throw new SheetError("Jadvalda varaq topilmadi");
  const range = encodeURIComponent(`'${tab.properties.title.replace(/'/g, "''")}'`);
  const data = await sheetsGet<{ values?: string[][] }>(
    `${id}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
  );
  return data.values ?? [];
}
