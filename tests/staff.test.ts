import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanOtpInput,
  DEFAULT_OTP_TEMPLATE,
  generateOtpCode,
  hashOtpCode,
  isLocalDb,
  otpMatches,
  renderOtpText,
  templateHasCode,
} from "../lib/otp-code";
import { formatUzPhone, normalizeUzPhone } from "../lib/phone";
import {
  DEFAULT_OWNER_PHONE,
  defaultPercent,
  defaultShareBase,
  fixedPayOf,
  isTeaching,
  salaryMonthOf,
  TEACHING_FILTER,
  ownerPhone,
  legacyLoginAllowed,
  parsePercent,
  payKindOf,
  payLabel,
  payHistoryMonths,
  payOf,
  payPlanOf,
  staffInitials,
  staffPercent,
  staffSalary,
  trimEmptyPayMonths,
} from "../lib/staff-rules";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";

test("rollar bo'yicha kirish huquqi", async () => {
  const { canAccess, homeFor } = await import("../lib/session");
  // rahbar — hammasi
  for (const p of ["/", "/students", "/students/new", "/staff", "/staff/6ac9dcf90698aca8bd508d6c", "/settings", "/sync", "/api/export/hisobot"]) {
    assert.equal(canAccess("owner", p), true, p);
  }
  // administrator — to'lovlar va profil
  assert.equal(canAccess("admin", "/payments"), true);
  assert.equal(canAccess("admin", "/me"), true);
  assert.equal(canAccess("admin", "/api/export/tolovlar"), true);
  // «Qarzdorlar» — hamma rol (o'qituvchiga faqat o'z o'quvchilari — ma'lumot qatlamida)
  for (const role of ["owner", "admin", "teacher"] as const) assert.equal(canAccess(role, "/qarzdorlar"), true, role);
  // Tezlik: o'lchovni hamma yuboradi, «Tezlik» sahifasi — faqat rahbar
  for (const role of ["owner", "admin", "teacher"] as const) assert.equal(canAccess(role, "/api/perf"), true, role);
  assert.equal(canAccess("owner", "/tezlik"), true);
  assert.equal(canAccess("admin", "/tezlik"), false);
  assert.equal(canAccess("teacher", "/tezlik"), false);
  for (const p of ["/", "/students", "/staff", "/settings", "/sync", "/api/export/oquvchilar"]) assert.equal(canAccess("admin", p), false, p);
  // o'qituvchi — o'z sahifasi, o'quvchilari (ko'rish va o'z o'quvchisini tahrirlash), to'lovlar, profil
  for (const p of ["/", "/students", "/students/6ac9dcf90698aca8bd508d6c", "/students/6ac9dcf90698aca8bd508d6c/edit", "/payments", "/me", "/api/export/oquvchilar", "/api/export/tolovlar"]) {
    assert.equal(canAccess("teacher", p), true, p);
  }
  for (const p of ["/students/new", "/students/abc/edit", "/students/6ac9dcf90698aca8bd508d6c/edit/x", "/staff", "/settings", "/sync", "/api/export/hisobot"]) {
    assert.equal(canAccess("teacher", p), false, p);
  }
  assert.equal(homeFor("owner"), "/");
  assert.equal(homeFor("teacher"), "/");
  assert.equal(homeFor("admin"), "/payments");
});

test("sessiya tokeni: xodim ID si bilan", async () => {
  const { createSessionToken, readSessionToken } = await import("../lib/session");
  const sid = "6ac9dcf90698aca8bd508d6c";
  assert.deepEqual(await readSessionToken(await createSessionToken("teacher", "pv-1", sid)), { role: "teacher", pv: "pv-1", sid });
  assert.deepEqual(await readSessionToken(await createSessionToken("owner", "pv-2", sid)), { role: "owner", pv: "pv-2", sid });
  // o'qituvchi faqat xodim profili bilan
  assert.equal(await readSessionToken(await createSessionToken("teacher", "pv-3")), null);
  // eski umumiy parol sessiyasi (xodim ID sisiz)
  assert.deepEqual(await readSessionToken(await createSessionToken("admin", "pv-4")), { role: "admin", pv: "pv-4" });
});

test("rahbar raqami (birinchi kirishda profil o'zi yaratiladi)", () => {
  assert.equal(DEFAULT_OWNER_PHONE, "998941761405");
  assert.equal(normalizeUzPhone("94 176 14 05"), DEFAULT_OWNER_PHONE);
  assert.equal(ownerPhone(undefined), DEFAULT_OWNER_PHONE);
  assert.equal(ownerPhone(""), DEFAULT_OWNER_PHONE);
  assert.equal(ownerPhone("+998 90 123 45 67"), "998901234567", "OWNER_PHONE bilan almashtirish");
  assert.equal(ownerPhone("123"), DEFAULT_OWNER_PHONE, "noto'g'ri qiymat — standart");
});

test("eski umumiy parol faqat o'tish davrida", () => {
  assert.equal(legacyLoginAllowed("owner", new Set()), true);
  assert.equal(legacyLoginAllowed("owner", new Set(["teacher", "admin"])), true);
  assert.equal(legacyLoginAllowed("owner", new Set(["owner"])), false);
  assert.equal(legacyLoginAllowed("admin", new Set(["owner"])), true);
  assert.equal(legacyLoginAllowed("admin", new Set(["admin"])), false);
  assert.equal(legacyLoginAllowed("teacher", new Set()), false);
});

test("xodim oyligi: foiz, asos va olinganlar", () => {
  assert.equal(parsePercent("40"), 40);
  assert.equal(parsePercent("37,5"), 37.5);
  assert.equal(parsePercent("0"), 0);
  assert.equal(parsePercent("100"), 100);
  assert.equal(parsePercent("101"), null);
  assert.equal(parsePercent("-5"), null);
  assert.equal(parsePercent("abc"), null);
  assert.equal(parsePercent(""), null);
  assert.equal(defaultShareBase("teacher"), "students");
  assert.equal(defaultShareBase("admin"), "center");
  assert.equal(defaultPercent("teacher"), 40);
  assert.equal(defaultPercent("admin"), 0);
  // "0000-01" — boshidan; keyin noyabrdan 45%
  const history = [{ from: "0000-01", percent: 40 }, { from: "2026-11", percent: 45 }];
  assert.equal(staffPercent(history, "2026-10"), 40);
  assert.equal(staffPercent(history, "2026-11"), 45);
  assert.equal(staffPercent([], "2026-10"), 0);
  assert.deepEqual(payOf(3_000_000, 40, 300_000), { kind: "percent", base: 3_000_000, percent: 40, share: 1_200_000, taken: 300_000, left: 900_000 });
  assert.deepEqual(payOf(0, 40, 100_000), { kind: "percent", base: 0, percent: 40, share: 0, taken: 100_000, left: -100_000 });
  // Administrator — belgilangan oylik (foiz emas)
  assert.equal(payKindOf("admin"), "fixed");
  assert.equal(payKindOf("teacher"), "percent");
  assert.equal(payKindOf("owner"), "percent");
  assert.deepEqual(fixedPayOf(3_000_000, 1_000_000), { kind: "fixed", base: 0, percent: 0, share: 3_000_000, taken: 1_000_000, left: 2_000_000 });
  assert.equal(payLabel(fixedPayOf(3_000_000, 0)), "Oylik");
  assert.equal(payLabel(payOf(1_000_000, 40, 0)), "Oylik (40%)");
  const salaries = [{ from: "2026-10", amount: 3_000_000 }, { from: "2027-01", amount: 3_500_000 }];
  assert.equal(staffSalary(salaries, "2026-09"), 0, "belgilanishidan oldingi oy — 0");
  assert.equal(staffSalary(salaries, "2026-12"), 3_000_000);
  assert.equal(staffSalary(salaries, "2027-02"), 3_500_000);
  assert.equal(staffSalary([], "2026-10"), 0);
  assert.equal(staffInitials("Najmiddin Karimov"), "NK");
  assert.equal(staffInitials("O'ktam"), "O");
});

test("SMS tasdiqlash kodi", () => {
  const codes = new Set(Array.from({ length: 50 }, () => generateOtpCode()));
  for (const c of codes) assert.match(c, /^\d{6}$/);
  assert.ok(codes.size > 40); // tasodifiy
  const phone = "998901234567";
  const h = hashOtpCode(phone, "482913");
  assert.notEqual(h, "482913"); // kodning o'zi saqlanmaydi
  assert.equal(otpMatches(phone, "482913", h), true);
  assert.equal(otpMatches(phone, "482914", h), false);
  assert.equal(otpMatches("998901234568", "482913", h), false); // boshqa raqam
  assert.equal(cleanOtpInput(" 482 913 "), "482913");
  assert.equal(cleanOtpInput("48-29-13-99"), "482913");
  assert.equal(cleanOtpInput(undefined), "");
  const sms = renderOtpText(DEFAULT_OTP_TEMPLATE, "482913");
  assert.equal(sms, "To'lov nazorati: xodim sifatida ro'yxatdan o'tish yoki parolni tiklash uchun tasdiqlash kodi: 482913. Kodni hech kimga bermang.");
  // bitta oddiy SMS: faqat lotin harflari va oddiy apostrof (Unicode bo'lsa — 70 belgi), 160 belgigacha
  assert.match(sms, /^[ -~]+$/);
  assert.ok(sms.length <= 160, `${sms.length} belgi`);
  assert.equal(templateHasCode(DEFAULT_OTP_TEMPLATE), true);
  assert.equal(templateHasCode("Kod: {kod}"), true);
  assert.equal(templateHasCode("Kodsiz matn"), false);
  // Eskiz'da tasdiqlangan matnni ko'chirib qo'ysa ham bo'ladi (moderator o'zgaruvchini boshqacha nomlasa ham)
  assert.equal(templateHasCode("Kod: {#var#}."), true);
  assert.equal(renderOtpText("Kod: {#var#}.", "123456"), "Kod: 123456.");
  assert.equal(templateHasCode("Kod: {##}"), false);
  // Kod ekranda faqat lokal sinov bazasida ko'rsatiladi (haqiqiy bazaga ulangan dev serverda — yo'q)
  assert.equal(isLocalDb("mongodb://127.0.0.1:27017/tolov_e2e"), true);
  assert.equal(isLocalDb("mongodb://localhost/test"), true);
  assert.equal(isLocalDb("mongodb+srv://user:pass@cluster0.example.mongodb.net/"), false);
  assert.equal(isLocalDb("mongodb://user:pass@db.example.com:27017/x"), false);
  assert.equal(isLocalDb(undefined), false);
  assert.equal(normalizeUzPhone("90 123 45 67"), "998901234567");
  assert.equal(formatUzPhone("998901234567"), "+998 90 123 45 67");
});

test("dars beradigan xodim: o'qituvchi va «dars ham beradi» belgili rahbar", () => {
  assert.equal(isTeaching({ role: "teacher" }), true);
  assert.equal(isTeaching({ role: "owner" }), false);
  assert.equal(isTeaching({ role: "owner", teaches: true }), true, "rahbar o'zi ham dars beradi");
  assert.equal(isTeaching({ role: "owner", teaches: null }), false);
  assert.equal(isTeaching({ role: "admin", teaches: true }), false, "belgi faqat rahbar uchun");
  // Bazadagi shart ham shu qoida bilan bir xil
  assert.deepEqual(TEACHING_FILTER, { $or: [{ role: "teacher" }, { role: "owner", teaches: true }] });
});

test("oylik qaysi oyga: o'tgan oy qarzi — olingan oyga, oldindan to'lov — o'z oyiga", () => {
  assert.equal(salaryMonthOf("2026-09", "2026-10"), "2026-10", "sentyabr qarzi oktabrda to'landi — oktabr oyligiga");
  assert.equal(salaryMonthOf("2026-10", "2026-10"), "2026-10");
  assert.equal(salaryMonthOf("2026-11", "2026-10"), "2026-11", "noyabr uchun oldindan — noyabr oyligiga");
  assert.equal(salaryMonthOf("2026-12", "2027-01"), "2027-01", "yil almashishi");
});

test("«Oylar bo'yicha» jadvali: qaysi oylar ko'rinadi", () => {
  const months = payHistoryMonths("2026-11", "2026-11");
  assert.equal(months.length, 12);
  assert.equal(months[0], "2026-11", "eng yangisi birinchi");
  assert.equal(months[11], "2025-12");
  // Oxirgi 12 oy ichidagi oy tanlansa — jadval joriy oygacha qoladi
  assert.deepEqual(payHistoryMonths("2026-03", "2026-11"), months);
  assert.deepEqual(payHistoryMonths("2025-12", "2026-11"), months, "oraliqning eng eski oyi");
  // Ancha eski oy — o'sha oygacha 12 oy (yil almashishi bilan)
  const old = payHistoryMonths("2025-06", "2026-11");
  assert.equal(old[0], "2025-06");
  assert.equal(old[11], "2024-07");
  // Kelgusi oy — o'sha oygacha (joriy oy ham ichida)
  const future = payHistoryMonths("2027-01", "2026-11");
  assert.equal(future[0], "2027-01");
  assert.ok(future.includes("2026-11"));
  assert.equal(payHistoryMonths("2026-11", "2026-11", 3).join(","), "2026-11,2026-10,2026-09");
});

test("«Oylar bo'yicha» jadvali: oylik belgilanmagan eski oylar tushiriladi", () => {
  const row = (month: string, share: number, taken = 0) => ({ month, share, taken });
  const rows = [row("2026-11", 0), row("2026-10", 500_000, 200_000), row("2026-09", 0, 100_000), row("2026-08", 0), row("2026-07", 0)];
  assert.deepEqual(
    trimEmptyPayMonths(rows, "2026-11").map((r) => r.month),
    ["2026-11", "2026-10", "2026-09"],
    "olingan pul bor oy qoladi, undan oldingi bo'sh oylar tushadi; o'rtadagi va yangi bo'sh oylar qoladi",
  );
  assert.deepEqual(
    trimEmptyPayMonths(rows, "2026-07").map((r) => r.month),
    ["2026-11", "2026-10", "2026-09", "2026-08", "2026-07"],
    "tanlangan oy bo'sh bo'lsa ham ko'rinadi",
  );
  assert.deepEqual(trimEmptyPayMonths([row("2026-11", 0), row("2026-10", 0)], "2026-11").map((r) => r.month), ["2026-11"], "hammasi bo'sh — faqat tanlangan oy");
  assert.deepEqual(trimEmptyPayMonths([], "2026-11"), []);
});

test("bu oy rejasi: hamma to'lasa qancha oylik, amalda qancha yig'ildi", () => {
  const rows = [
    { monthlyFee: 300000, debt: 0 }, // to'liq to'lagan
    { monthlyFee: 300000, debt: 300000 }, // to'lamagan
    { monthlyFee: 300000, debt: 100000 }, // qisman: 200 ming to'lagan
    { monthlyFee: 250000, debt: 0 },
  ];
  const plan = payPlanOf(rows, 40);
  assert.equal(plan.students, 4);
  assert.equal(plan.expected, 1150000);
  assert.equal(plan.planShare, 460000, "hamma to'lasa: 1 150 000 × 40%");
  assert.equal(plan.debt, 400000);
  assert.equal(plan.collected, 750000);
  assert.equal(plan.paidCount, 2);
  assert.equal(plan.debtors, 2);
  // Bo'sh ro'yxat va 0% — hammasi nol
  assert.deepEqual(payPlanOf([], 40), {
    students: 0,
    paidCount: 0,
    debtors: 0,
    expected: 0,
    earlier: 0,
    earlierMonths: [],
    collected: 0,
    debt: 0,
    percent: 40,
    planShare: 0,
  });
  assert.equal(payPlanOf(rows, 0).planShare, 0);
  // Qarz oylik to'lovdan oshmaydi va manfiy bo'lmaydi
  assert.equal(payPlanOf([{ monthlyFee: 300000, debt: 500000 }, { monthlyFee: 300000, debt: -50000 }], 40).collected, 300000);
});

test("bu oy rejasi: oldingi oy oyligida olingan pul qayta hisoblanmaydi", () => {
  // Noyabr: 3 o'quvchi × 300 ming. 1-chisi noyabr uchun oktabr oyligi olinmasdan to'lagan (oktabr oyligiga hisoblangan),
  // 2-chisi oktabr oyligi olingach to'lagan, 3-chisi qisman: 100 ming oktabr oyligida, 100 ming — to'lamagan
  const rows = [
    { monthlyFee: 300000, debt: 0, earlier: 300000 },
    { monthlyFee: 300000, debt: 0, earlier: 0 },
    { monthlyFee: 300000, debt: 100000, earlier: 100000 },
  ];
  const plan = payPlanOf(rows, 40, ["2026-10"]);
  assert.equal(plan.expected, 900000);
  assert.equal(plan.earlier, 400000, "oktabr oyligida olingan");
  assert.equal(plan.collected, 400000, "noyabr oyligiga: 300 + 100");
  assert.equal(plan.debt, 100000);
  assert.equal(plan.expected, plan.earlier + plan.collected + plan.debt);
  assert.equal(plan.planShare, 200000, "faqat qo'lga tegmagan pul: (400 + 100) × 40%");
  assert.deepEqual(plan.earlierMonths, ["2026-10"]);
  // Oldingi oyga hisoblangan summa to'langanidan oshmaydi (ortiqcha to'lov — oylik to'lovi bilan cheklanadi)
  assert.equal(payPlanOf([{ monthlyFee: 300000, debt: 0, earlier: 700000 }], 40).earlier, 300000);
  // Oldingi oyga hech narsa yo'q — oylar ro'yxati ham bo'sh
  assert.deepEqual(payPlanOf([{ monthlyFee: 300000, debt: 0 }], 40, ["2026-10"]).earlierMonths, []);
});
