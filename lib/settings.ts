// Ilova sozlamalari (bitta hujjat). Har so'rovda bazaga bormaslik uchun qisqa muddatli kesh bilan.
import { DEFAULT_COLUMNS, DEFAULT_COURSE_FILTER, type ColumnNames } from "./compare";
import { normalizeCourses, type Course } from "./courses";
import { connectDB } from "./db";
import { feeFor, type FeeChange, type PercentChange } from "./fees";
import { Setting } from "./models";
import { DEFAULT_OTP_TEMPLATE } from "./otp-text";
import { normalizeParentSms, type ParentSmsSettings } from "./parent-sms-rules";
import { normalizeStartDay } from "./reminders";

export const DEFAULT_FEE = 300_000;
// Eskiz'da tasdiqlangan shablon bilan harfma-harf bir xil bo'lishi kerak (oxirida nuqta yo'q).
// Oddiy apostrof: shunda 1 ta SMS 160 belgigacha sig'adi.
export const DEFAULT_SMS_TEMPLATE = "To'lov nazorati: {#oy#} uchun {#soni#} ta o'quvchi hali to'lov qilmagan";
// Avvalgi standart matnlar — saqlangan bo'lsa, yangisi bilan almashtiriladi
const LEGACY_SMS_TEMPLATES = new Set(["To'lov nazorati: {oy} uchun {soni} ta o'quvchi hali to'lov qilmagan."]);

export type Features = {
  /** To'lov formasida «To'langan sana» maydoni (o'chiq bo'lsa — sana avtomatik bugun) */
  paymentDate: { owner: boolean; admin: boolean };
};

export type AppSettings = {
  sheetUrl: string;
  /** Jadval arxivlangan, havola bo'sh — yangi oy jadvali kutilmoqda */
  sheetArchived: boolean;
  columns: ColumnNames;
  courseFilter: string;
  /** Sheets'da bor, saytda yo'q to'lovlar tekshiruvda o'zi saytga qo'shiladi */
  autoImport: boolean;
  centerName: string;
  /** Markazdagi kurslar (nomi va standart oylik narxi) */
  courses: Course[];
  /** Yoqib-o'chiriladigan imkoniyatlar */
  features: Features;
  /** Eski umumiy parol bilan kirgan rahbarning shaxsiy sozlamalari */
  legacyPrefs: { syncAlert: boolean };
  /** Standart narx (asosiy) — null bo'lsa hali belgilanmagan */
  defaultFee: number | null;
  /** Standart narxning "falon oydan" o'zgarishlari */
  feeSchedule: FeeChange[];
  feeChanges: { from: string; fee: number; count: number; at: string }[];
  shareHistory: PercentChange[];
  /** Eski ulush/oylik yozuvlari o'tkazilgan xodim (null — hali o'tkazilmagan) */
  legacyPayStaff: string | null;
  ownerPasswordHash: string | null;
  adminPasswordHash: string | null;
  /** Ota-onalarga to'lov eslatmasi (SMS) */
  parentSms: ParentSmsSettings;
  /** startDay — joriy oy qarzdorlari shu sanadan boshlab sanaladi (1 — har kuni) */
  sms: { enabled: boolean; phone: string; sender: string; template: string; startDay: number; otpTemplate: string };
};

const TTL_MS = 15_000;
const g = globalThis as unknown as { __settingsCache?: { at: number; value: AppSettings } };

type Doc = Record<string, unknown> & {
  sheetUrl?: string;
  sheetArchived?: boolean;
  columns?: Partial<Record<keyof ColumnNames, string | null>>;
  courseFilter?: string;
  autoImport?: boolean;
  centerName?: string;
  courses?: { name?: string | null; fee?: number | null; teacher?: unknown; teachers?: unknown }[] | null;
  features?: { paymentDateOwner?: boolean | null; paymentDateAdmin?: boolean | null } | null;
  legacyPrefs?: { syncAlert?: boolean | null } | null;
  defaultFee?: number;
  feeSchedule?: { from?: string; fee?: number }[];
  feeChanges?: { from?: string; fee?: number; count?: number; at?: Date }[];
  shareHistory?: { from?: string; percent?: number }[];
  legacyPayStaff?: unknown;
  ownerPasswordHash?: string | null;
  adminPasswordHash?: string | null;
  parentSms?: Partial<Record<keyof ParentSmsSettings, unknown>> | null;
  sms?: { enabled?: boolean; phone?: string; sender?: string; template?: string; startDay?: number; otpTemplate?: string };
};

function toAppSettings(doc: Doc | null): AppSettings {
  const saved = doc?.columns ?? {};
  const columns = { ...DEFAULT_COLUMNS };
  for (const k of Object.keys(DEFAULT_COLUMNS) as (keyof ColumnNames)[]) {
    if (saved[k]) columns[k] = saved[k]!;
  }
  return {
    // Arxivlangach havola ataylab bo'sh — .env dagi SHEET_URL ga qaytilmaydi
    sheetUrl: doc?.sheetUrl || (doc?.sheetArchived ? "" : process.env.SHEET_URL || ""),
    sheetArchived: Boolean(doc?.sheetArchived) && !doc?.sheetUrl,
    columns,
    // Eski hujjatlarda maydon yo'q bo'lsa — standart; ataylab bo'sh qoldirilgan bo'lsa — filtrsiz
    courseFilter: typeof doc?.courseFilter === "string" ? doc.courseFilter : DEFAULT_COURSE_FILTER,
    autoImport: doc?.autoImport !== false,
    centerName: doc?.centerName || process.env.CENTER_NAME || "Asosiy markaz",
    courses: normalizeCourses(doc?.courses),
    features: {
      // Standart: rahbar sanani tanlaydi, administratorda — har doim bugun (avvalgidek)
      paymentDate: { owner: doc?.features?.paymentDateOwner ?? true, admin: doc?.features?.paymentDateAdmin ?? false },
    },
    legacyPrefs: { syncAlert: doc?.legacyPrefs?.syncAlert ?? true },
    defaultFee: typeof doc?.defaultFee === "number" ? doc.defaultFee : null,
    feeSchedule: (doc?.feeSchedule ?? [])
      .filter((h) => h.from && typeof h.fee === "number")
      .map((h) => ({ from: h.from!, fee: h.fee! })),
    feeChanges: (doc?.feeChanges ?? []).map((c) => ({
      from: c.from ?? "",
      fee: c.fee ?? 0,
      count: c.count ?? 0,
      at: c.at ? new Date(c.at).toISOString() : "",
    })),
    shareHistory: (doc?.shareHistory ?? [])
      .filter((h) => h.from && typeof h.percent === "number")
      .map((h) => ({ from: h.from!, percent: h.percent! })),
    legacyPayStaff: doc?.legacyPayStaff ? String(doc.legacyPayStaff) : null,
    ownerPasswordHash: doc?.ownerPasswordHash ?? null,
    adminPasswordHash: doc?.adminPasswordHash ?? null,
    parentSms: normalizeParentSms(doc?.parentSms),
    sms: {
      enabled: doc?.sms?.enabled ?? false,
      phone: doc?.sms?.phone || "998336263006",
      sender: doc?.sms?.sender || "4546",
      template: doc?.sms?.template && !LEGACY_SMS_TEMPLATES.has(doc.sms.template) ? doc.sms.template : DEFAULT_SMS_TEMPLATE,
      startDay: normalizeStartDay(doc?.sms?.startDay),
      otpTemplate: doc?.sms?.otpTemplate || DEFAULT_OTP_TEMPLATE,
    },
  };
}

/** Sozlamalarni o'qish (15 soniyalik kesh). O'qishda bazaga yozilmaydi — hujjat bo'lmasa bir marta yaratiladi. */
export async function getSettings(opts: { fresh?: boolean } = {}): Promise<AppSettings> {
  const cached = g.__settingsCache;
  if (!opts.fresh && cached && Date.now() - cached.at < TTL_MS) return cached.value;
  await connectDB();
  let doc = (await Setting.findById("main").lean()) as Doc | null;
  if (!doc) {
    await Setting.updateOne(
      { _id: "main" },
      {
        $setOnInsert: {
          _id: "main",
          sheetUrl: process.env.SHEET_URL ?? "",
          columns: DEFAULT_COLUMNS,
          courseFilter: DEFAULT_COURSE_FILTER,
        },
      },
      { upsert: true },
    );
    doc = (await Setting.findById("main").lean()) as Doc | null;
  }
  const value = toAppSettings(doc);
  g.__settingsCache = { at: Date.now(), value };
  return value;
}

/** Markazning shu oydagi standart narxi (yangi o'quvchi formasida) — belgilanmagan bo'lsa null. */
export function standardFee(s: Pick<AppSettings, "defaultFee" | "feeSchedule">, month: string): number | null {
  return s.defaultFee === null ? null : feeFor({ monthlyFee: s.defaultFee, feeHistory: s.feeSchedule }, month);
}

export function invalidateSettings() {
  g.__settingsCache = undefined;
}

export async function updateSettings(update: Record<string, unknown>): Promise<void> {
  await getSettings({ fresh: true }); // hujjat mavjudligini ta'minlaydi
  await Setting.updateOne({ _id: "main" }, update);
  invalidateSettings();
}
