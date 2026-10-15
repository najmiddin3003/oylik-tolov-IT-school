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
    /** Dars jadvali: hafta kuni (1 = dushanba … 7 = yakshanba) va vaqt "HH:MM" (Toshkent). Har kunda bittadan. */
    lessons: {
      type: [{ day: { type: Number, min: 1, max: 7 }, start: String, end: String, _id: false }],
      default: [],
    },
    /** O'qituvchisi (xodim). Bo'sh — hali biriktirilmagan */
    teacher: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
  },
  { timestamps: true },
);
studentSchema.index({ active: 1, fullName: 1 });
studentSchema.index({ seq: 1 });
studentSchema.index({ group: 1 });
studentSchema.index({ teacher: 1 });

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
    /** Kiritgan xodim (xodim profili bilan kirgan bo'lsa) */
    createdByStaff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    /**
     * Pul kimning kassasiga tushdi: administrator kiritsa — o'z kassasiga (rahbarga topshirguncha), rahbar kiritsa — rahbar kassasiga.
     * Kassa yuritilishidan oldingi va Sheets'dan import qilingan to'lovlarda yo'q (kassada hisoblanmaydi).
     */
    cashierRole: { type: String, enum: ["owner", "admin", null], default: null },
    cashierStaff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    /** Arxivlangan to'lov hech qayerda hisoblanmaydi; faqat rahbarning arxiv ro'yxatida ko'rinadi */
    archivedAt: { type: Date, default: null },
    archivedBy: { type: String, enum: ["owner", "admin", null], default: null },
  },
  { timestamps: true },
);
paymentSchema.index({ student: 1, month: 1 });
paymentSchema.index({ archivedAt: 1, month: 1, paidAt: -1 });
paymentSchema.index({ archivedAt: 1, paidAt: 1 });
paymentSchema.index({ cashierRole: 1, cashierStaff: 1 });

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
    /** Sheets'da bor, saytda yo'q to'lovlarni tekshiruvda avtomatik saytga qo'shish (maydon yo'q — yoqilgan) */
    autoImport: { type: Boolean },
    /** Markaz nomi (yon menyuda) */
    centerName: { type: String },
    /**
     * Kurslar (o'quvchining «guruh» maydoni shu nom bilan): nomi, standart oylik narxi va kurs o'qituvchisi
     * (shu kurs o'quvchilari unga biriktiriladi). Maydon yo'q — standart ro'yxat
     */
    courses: {
      type: [{ name: String, fee: Number, teacher: { type: Schema.Types.ObjectId, ref: "Staff", default: null }, _id: false }],
      default: undefined,
    },
    /** Yoqib-o'chiriladigan imkoniyatlar (rahbar Sozlamalar → Funksiyalar bo'limida) */
    features: {
      /** To'lov formasida «To'langan sana» maydoni: rahbarda / administratorda (o'chiq bo'lsa — bugungi sana) */
      paymentDateOwner: { type: Boolean },
      paymentDateAdmin: { type: Boolean },
    },
    /** Eski umumiy parol bilan kirgan rahbar uchun shaxsiy sozlamalar (xodim profilida — Staff.prefs) */
    legacyPrefs: { syncAlert: { type: Boolean } },
    /** Markazning standart oylik narxi (yangi o'quvchilar uchun) va uning "falon oydan" o'zgarishlari */
    defaultFee: { type: Number },
    feeSchedule: { type: [{ from: String, fee: Number, _id: false }], default: [] },
    /** Narx o'zgarishlari jurnali (sozlamalar sahifasida ko'rsatiladi) */
    feeChanges: { type: [{ from: String, fee: Number, count: Number, at: Date, _id: false }], default: [] },
    /** Tushumdan ulush foizi tarixi: "from" oyidan boshlab foiz (eski: bitta o'qituvchi uchun; endi — har xodimda o'zi) */
    shareHistory: { type: [{ from: String, percent: Number, _id: false }], default: [] },
    /** Eski ulush va oylik/avans yozuvlari qaysi xodimga o'tkazilgan (o'tkazilgach eski bo'lim yashiriladi) */
    legacyPayStaff: { type: Schema.Types.ObjectId, default: null },
    /** Parollar (scrypt). Rahbar paroli bo'lmasa — .env dagi ADMIN_PASSWORD */
    ownerPasswordHash: { type: String, default: null },
    adminPasswordHash: { type: String, default: null },
    /** Qarzdorlar haqida kunlik SMS (Eskiz) */
    sms: {
      enabled: { type: Boolean, default: false },
      phone: { type: String, default: "998336263006" },
      sender: { type: String, default: "4546" },
      template: { type: String },
      /** Joriy oy qarzdorlari shu sanadan boshlab sanaladi (1 — har kuni) */
      startDay: { type: Number },
      /** Xodim ro'yxatdan o'tishi / parolni tiklash uchun tasdiqlash kodi SMS matni ({#kod#}) */
      otpTemplate: { type: String },
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
    /** Kurslar bo'yicha: solishtirilgan qatorlar, mos kelganlar, filtr tufayli e'tiborsiz qolganlar */
    courseStats: { type: [{ course: String, rows: Number, matched: Number, ignored: Number, _id: false }], default: [] },
    skipped: { type: [{ row: Number, reason: String, _id: false }], default: [] },
    mismatches: { type: [mismatchSchema], default: [] },
    /** Shu tekshiruvda Sheets'dan avtomatik qo'shilgan to'lov qatorlari soni */
    autoImported: { type: Number, default: 0 },
  },
  { timestamps: false },
);
syncRunSchema.index({ startedAt: -1 });

// ---------- Oylik va avanslar (tushum ulushidan ayiriladi) ----------
const salarySchema = new Schema(
  {
    /** Kimga berilgan (xodim). Bo'sh — eski yozuv, hali xodimga biriktirilmagan */
    staff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    kind: { type: String, enum: ["oylik", "avans"], required: true },
    amount: { type: Number, required: true, min: 1 },
    /** Qachon olindi */
    date: { type: Date, required: true },
    /** Qaysi oy uchun: "YYYY-MM" */
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    /** Kim yozgan: rahbar yoki xodimning o'zi («Olingan avans/oylik» bo'limida) */
    createdByStaff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    selfReported: { type: Boolean, default: false },
  },
  { timestamps: true },
);
salarySchema.index({ month: 1, date: -1 });
salarySchema.index({ staff: 1, month: 1 });

// ---------- Xodimlar (rahbar, administrator, o'qituvchi) ----------
export const STAFF_ROLES = ["owner", "admin", "teacher"] as const;
export const STAFF_STATUSES = ["invited", "active", "disabled"] as const;

const staffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    /** "998XXXXXXXXX" — kirish va SMS tasdiqlash shu raqam bilan */
    phone: { type: String, required: true, unique: true },
    role: { type: String, enum: STAFF_ROLES, required: true },
    /** invited — rahbar qo'shgan, hali SMS orqali ro'yxatdan o'tmagan; disabled — kirishi o'chirilgan */
    status: { type: String, enum: STAFF_STATUSES, default: "invited" },
    passwordHash: { type: String, default: null },
    /** Oylik: tushumdan foiz, "from" oyidan boshlab */
    shareHistory: { type: [{ from: String, percent: Number, _id: false }], default: [] },
    /** Foiz nimadan olinadi: o'z o'quvchilari to'lovlaridan yoki butun markaz tushumidan */
    shareBase: { type: String, enum: ["students", "center"], default: "students" },
    activatedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    /** Shaxsiy sozlamalar: Google Sheets ogohlantiruvini ko'rsatish (maydon yo'q — ko'rsatiladi) */
    prefs: { syncAlert: { type: Boolean } },
  },
  { timestamps: true },
);
staffSchema.index({ role: 1, status: 1 });

// ---------- SMS tasdiqlash kodlari (ro'yxatdan o'tish / parolni tiklash) ----------
const otpSchema = new Schema(
  {
    phone: { type: String, required: true },
    purpose: { type: String, enum: ["activate", "reset"], required: true },
    /** Kodning o'zi saqlanmaydi — faqat HMAC izi */
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    /** Kod shu vaqtgacha yaroqli; ishlatilgach — usedAt */
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);
// Yozuvlar bir kun saqlanadi (kunlik SMS chegarasi uchun), keyin o'zi o'chadi
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 3600 });
otpSchema.index({ phone: 1, createdAt: -1 });

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

// ---------- Rahbardan topshiriq (masalan, administratorga: «to'lovlarni yig'ing») ----------
const taskSchema = new Schema(
  {
    kind: { type: String, enum: ["collect"], default: "collect" },
    /** Kimga: rol bo'yicha (shu roldagi har bir xodim ko'radi) */
    toRole: { type: String, enum: STAFF_ROLES, default: "admin" },
    fromStaff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    fromName: { type: String, default: "" },
    /** Qaysi oy to'lovlari */
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    /** Yuborilgan paytdagi holat: nechta o'quvchi va jami qarz */
    count: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "done"], default: "open" },
    doneAt: { type: Date, default: null },
    doneBy: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    doneByName: { type: String, default: "" },
  },
  { timestamps: true },
);
taskSchema.index({ toRole: 1, status: 1, createdAt: -1 });
taskSchema.index({ month: 1, status: 1 });

// ---------- Kassa: administrator yig'gan pulni rahbarga topshirishi ----------
const handoverSchema = new Schema(
  {
    fromStaff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    fromName: { type: String, default: "" },
    /** Naqd va karta (karta + o'tkazma) alohida */
    cash: { type: Number, default: 0, min: 0 },
    card: { type: Number, default: 0, min: 0 },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    /** pending — rahbar hali qabul qilmagan (pul administrator kassasida turadi) */
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    decidedByName: { type: String, default: "" },
  },
  { timestamps: true },
);
handoverSchema.index({ status: 1, createdAt: -1 });
handoverSchema.index({ fromStaff: 1, createdAt: -1 });

// ---------- Faoliyat jurnali: har bir xodimning amallari (faqat o'ziga ko'rinadi) ----------
const activitySchema = new Schema(
  {
    /** Xodim profili (eski umumiy parol bilan kirilganda — null, rol bo'yicha) */
    staff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    role: { type: String, enum: STAFF_ROLES, required: true },
    /** Amal turi, masalan: "login", "payment.add" */
    action: { type: String, required: true },
    text: { type: String, default: "", maxlength: 500 },
    ip: { type: String, default: "" },
    device: { type: String, default: "" },
    at: { type: Date, required: true },
  },
  { versionKey: false },
);
activitySchema.index({ staff: 1, at: -1 });
activitySchema.index({ role: 1, staff: 1, at: -1 });
// Jurnal ~13 oy saqlanadi
activitySchema.index({ at: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });

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
export type StaffDoc = InferSchemaType<typeof staffSchema> & { _id: mongoose.Types.ObjectId };

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
export const Staff: Model<InferSchemaType<typeof staffSchema>> = models.Staff || model("Staff", staffSchema);
export const Otp: Model<InferSchemaType<typeof otpSchema>> = models.Otp || model("Otp", otpSchema);
export const Task: Model<InferSchemaType<typeof taskSchema>> = models.Task || model("Task", taskSchema);
export const Handover: Model<InferSchemaType<typeof handoverSchema>> = models.Handover || model("Handover", handoverSchema);
export const Activity: Model<InferSchemaType<typeof activitySchema>> = models.Activity || model("Activity", activitySchema);
