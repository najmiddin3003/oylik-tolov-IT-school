import mongoose, { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// ---------- O'quvchi ----------
const studentSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, default: "", maxlength: 40 },
    parentPhone: { type: String, trim: true, default: "", maxlength: 40 },
    group: { type: String, trim: true, default: "", maxlength: 80 },
    monthlyFee: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    note: { type: String, trim: true, default: "", maxlength: 1000 },
  },
  { timestamps: true },
);
studentSchema.index({ active: 1, fullName: 1 });
studentSchema.index({ group: 1 });

// ---------- To'lov ----------
export const PAYMENT_METHODS = ["naqd", "karta", "otkazma"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const paymentSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    /** Qaysi oy uchun to'lov: "YYYY-MM" */
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    amount: { type: Number, required: true, min: 1 },
    paidAt: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS, default: "naqd" },
    note: { type: String, trim: true, default: "", maxlength: 500 },
    /** Qayerdan kiritilgan: saytda qo'lda yoki Sheets farqidan import */
    source: { type: String, enum: ["site", "sheets"], default: "site" },
  },
  { timestamps: true },
);
paymentSchema.index({ student: 1, month: 1 });
paymentSchema.index({ month: 1, paidAt: -1 });
paymentSchema.index({ paidAt: 1 });

// ---------- Sozlamalar (bitta hujjat, _id = "main") ----------
// Ustun nomlarining standart qiymatlari lib/compare.ts dagi DEFAULT_COLUMNS da.
const settingSchema = new Schema(
  {
    _id: { type: String, default: "main" },
    sheetUrl: { type: String, default: "" },
    columns: {
      name: String,
      phone: String,
      month: String,
      amount: String,
      date: String,
      cash: String,
      card: String,
      fee: String,
      course: String,
    },
    /** Faqat shu kurs(lar) qatorlari solishtiriladi; bo'sh — hammasi */
    courseFilter: { type: String },
    /** Bir vaqtda ikkita tekshiruv ishlab ketmasligi uchun qulf */
    syncLockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

// ---------- Sheets bilan solishtirish natijasi ----------
export const MISMATCH_KINDS = [
  "missing_on_site",
  "missing_in_sheet",
  "amount_diff",
  "unknown_student",
] as const;
export type MismatchKind = (typeof MISMATCH_KINDS)[number];

const sheetPartSchema = new Schema(
  {
    row: { type: Number, default: 0 },
    date: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    cash: { type: Number, default: 0 },
    card: { type: Number, default: 0 },
  },
  { _id: false },
);

const mismatchSchema = new Schema(
  {
    kind: { type: String, enum: MISMATCH_KINDS, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    studentName: { type: String, default: "" },
    phone: { type: String, default: "" },
    /** Sheets'dagi kurs nomi (yangi o'quvchi import qilinsa — guruhi) */
    group: { type: String, default: "" },
    month: { type: String, required: true },
    siteAmount: { type: Number, default: 0 },
    sheetAmount: { type: Number, default: 0 },
    sheetRows: { type: [Number], default: [] },
    sheetDate: { type: String, default: "" },
    /** Sheets'dagi kurs narxi (oylik) */
    fee: { type: Number, default: 0 },
    /** Sheets'dagi alohida to'lov qatorlari (sana, naqd/plastik) */
    parts: { type: [sheetPartSchema], default: [] },
    note: { type: String, default: "" },
    resolved: { type: Boolean, default: false },
  },
  { _id: true },
);

const syncRunSchema = new Schema(
  {
    trigger: { type: String, enum: ["auto", "cron", "manual"], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    ok: { type: Boolean, default: false },
    error: { type: String, default: "" },
    sheetRowCount: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    /** "date" — to'lov sanasi bo'yicha, "month" — oy ustuni bo'yicha solishtirilgan */
    basis: { type: String, enum: ["month", "date"], default: "month" },
    monthFrom: { type: String, default: "" },
    monthTo: { type: String, default: "" },
    dateFrom: { type: String, default: "" },
    dateTo: { type: String, default: "" },
    courseFilter: { type: String, default: "" },
    filteredOut: { type: Number, default: 0 },
    skipped: { type: [{ row: Number, reason: String, _id: false }], default: [] },
    mismatches: { type: [mismatchSchema], default: [] },
  },
  { timestamps: false },
);
syncRunSchema.index({ startedAt: -1 });

export type StudentDoc = InferSchemaType<typeof studentSchema> & { _id: mongoose.Types.ObjectId };
export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: mongoose.Types.ObjectId };
export type SettingDoc = InferSchemaType<typeof settingSchema>;
export type SyncRunDoc = InferSchemaType<typeof syncRunSchema> & { _id: mongoose.Types.ObjectId };

export const Student: Model<InferSchemaType<typeof studentSchema>> =
  models.Student || model("Student", studentSchema);
export const Payment: Model<InferSchemaType<typeof paymentSchema>> =
  models.Payment || model("Payment", paymentSchema);
export const Setting: Model<InferSchemaType<typeof settingSchema>> =
  models.Setting || model("Setting", settingSchema);
export const SyncRun: Model<InferSchemaType<typeof syncRunSchema>> =
  models.SyncRun || model("SyncRun", syncRunSchema);
