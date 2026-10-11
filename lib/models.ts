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
    /** Tartib raqami (#001) — o'chirilgan o'quvchining raqami qayta berilmaydi */
    seq: { type: Number, default: null },
    /** Narx tarixi: "from" oyidan boshlab narx = fee (o'tgan oylar hisobi o'zgarmaydi) */
    feeHistory: { type: [{ from: String, fee: Number, _id: false }], default: [] },
  },
  { timestamps: true },
);
studentSchema.index({ active: 1, fullName: 1 });
studentSchema.index({ seq: 1 });
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
    /** Kim kiritgan: rahbar yoki administrator */
    createdBy: { type: String, enum: ["owner", "admin", "system"], default: "owner" },
    /** Arxivlangan to'lov hech qayerda hisoblanmaydi; faqat rahbarning arxiv ro'yxatida ko'rinadi */
    archivedAt: { type: Date, default: null },
    archivedBy: { type: String, enum: ["owner", "admin", null], default: null },
  },
  { timestamps: true },
);
paymentSchema.index({ student: 1, month: 1 });
paymentSchema.index({ archivedAt: 1, month: 1, paidAt: -1 });
paymentSchema.index({ archivedAt: 1, paidAt: 1 });

// ---------- Hisoblagich (tartib raqamlari uchun) ----------
const counterSchema = new Schema({ _id: { type: String }, value: { type: Number, default: 0 } }, { versionKey: false });

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
    /** Markaz nomi (yon menyuda) */
    centerName: { type: String },
    /** Markazning standart oylik narxi (yangi o'quvchilar uchun) va uning "falon oydan" o'zgarishlari */
    defaultFee: { type: Number },
    feeSchedule: { type: [{ from: String, fee: Number, _id: false }], default: [] },
    /** Narx o'zgarishlari jurnali (sozlamalar sahifasida ko'rsatiladi) */
    feeChanges: { type: [{ from: String, fee: Number, count: Number, at: Date, _id: false }], default: [] },
    /** Tushumdan ulush foizi tarixi: "from" oyidan boshlab foiz */
    shareHistory: { type: [{ from: String, percent: Number, _id: false }], default: [] },
    /** Parollar (scrypt). Rahbar paroli bo'lmasa — .env dagi ADMIN_PASSWORD */
    ownerPasswordHash: { type: String, default: null },
    adminPasswordHash: { type: String, default: null },
    /** Qarzdorlar haqida kunlik SMS (Eskiz) */
    sms: {
      enabled: { type: Boolean, default: false },
      phone: { type: String, default: "998336263006" },
      sender: { type: String, default: "4546" },
      template: { type: String },
    },
    /** Bir vaqtda ikkita tekshiruv ishlab ketmasligi uchun qulf */
    syncLockedUntil: { type: Date, default: null },
    /** SMS qulflari: kunlik SMS ikki marta ketmasligi va sinov SMS daqiqada bittadan oshmasligi uchun */
    smsLockUntil: { type: Date, default: null },
    smsTestLockUntil: { type: Date, default: null },
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

// ---------- Oylik va avanslar (tushum ulushidan ayiriladi) ----------
const salarySchema = new Schema(
  {
    kind: { type: String, enum: ["oylik", "avans"], required: true },
    amount: { type: Number, required: true, min: 1 },
    /** Qachon olindi */
    date: { type: Date, required: true },
    /** Qaysi oy uchun: "YYYY-MM" */
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    note: { type: String, trim: true, default: "", maxlength: 300 },
  },
  { timestamps: true },
);
salarySchema.index({ month: 1, date: -1 });

// ---------- SMS jurnali ----------
const smsLogSchema = new Schema(
  {
    /** Toshkent kuni "YYYY-MM-DD" */
    day: { type: String, required: true },
    trigger: { type: String, enum: ["cron", "auto", "test"], required: true },
    status: { type: String, enum: ["sent", "skipped", "failed"], required: true },
    months: { type: [String], default: [] },
    count: { type: Number, default: 0 },
    phone: { type: String, default: "" },
    text: { type: String, default: "" },
    error: { type: String, default: "" },
    providerId: { type: String, default: "" },
  },
  { timestamps: true },
);
smsLogSchema.index({ day: -1, createdAt: -1 });

// ---------- Noto'g'ri kirish urinishlari (parol tanlashni cheklash; 1 soatdan keyin o'zi o'chadi) ----------
const loginAttemptSchema = new Schema(
  {
    ip: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { versionKey: false },
);
loginAttemptSchema.index({ at: 1 }, { expireAfterSeconds: 3600 });
loginAttemptSchema.index({ ip: 1, at: -1 });

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
export const Counter: Model<InferSchemaType<typeof counterSchema>> =
  models.Counter || model("Counter", counterSchema);
export const SyncRun: Model<InferSchemaType<typeof syncRunSchema>> =
  models.SyncRun || model("SyncRun", syncRunSchema);
export const Salary: Model<InferSchemaType<typeof salarySchema>> =
  models.Salary || model("Salary", salarySchema);
export const SmsLog: Model<InferSchemaType<typeof smsLogSchema>> =
  models.SmsLog || model("SmsLog", smsLogSchema);
export const LoginAttempt: Model<InferSchemaType<typeof loginAttemptSchema>> =
  models.LoginAttempt || model("LoginAttempt", loginAttemptSchema);
