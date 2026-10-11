import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateAmount } from "../lib/allocate";
import { formatUzPhone, normalizeUzPhone } from "../lib/eskiz";
import { applyFeeFrom, applyPercentFrom, changesAfter, feeFor, percentFor } from "../lib/fees";
import { fingerprint, hashPassword, safeEqualText, verifyPassword } from "../lib/passwords";
import { dayLabel, daysInMonth, daysLeftInMonth, monthEndReminderActive, renderSmsText, smsCandidateMonths, templateHasCount } from "../lib/reminders";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";

test("feeFor: narx tarixi bo'yicha oylik to'lov", () => {
  const s = { monthlyFee: 300_000, feeHistory: [{ from: "2026-12", fee: 350_000 }, { from: "2027-03", fee: 400_000 }] };
  assert.equal(feeFor(s, "2026-10"), 300_000);
  assert.equal(feeFor(s, "2026-11"), 300_000);
  assert.equal(feeFor(s, "2026-12"), 350_000);
  assert.equal(feeFor(s, "2027-02"), 350_000);
  assert.equal(feeFor(s, "2027-03"), 400_000);
  assert.equal(feeFor({ monthlyFee: 250_000 }, "2030-01"), 250_000);
  // tartibsiz saqlangan tarix ham to'g'ri o'qiladi
  assert.equal(feeFor({ monthlyFee: 1, feeHistory: [{ from: "2027-03", fee: 3 }, { from: "2026-12", fee: 2 }] }, "2027-01"), 2);
});

test("applyFeeFrom: tanlangan oydan boshlab, o'tgan oylar o'zgarmaydi", () => {
  const base = { monthlyFee: 300_000, feeHistory: [], startMonth: "2026-10" };
  // boshlanish oyidan (yoki oldin) — asosiy narx almashadi
  assert.deepEqual(applyFeeFrom(base, "2026-10", 350_000), { monthlyFee: 350_000, feeHistory: [] });
  assert.deepEqual(applyFeeFrom(base, "2026-01", 350_000), { monthlyFee: 350_000, feeHistory: [] });
  // keyingi oydan — tarixga yoziladi
  const next = applyFeeFrom(base, "2026-12", 350_000);
  assert.deepEqual(next, { monthlyFee: 300_000, feeHistory: [{ from: "2026-12", fee: 350_000 }] });
  assert.equal(feeFor(next, "2026-11"), 300_000);
  assert.equal(feeFor(next, "2026-12"), 350_000);
  // undan keyingi eski o'zgarishlar bekor bo'ladi
  const later = applyFeeFrom({ ...next, startMonth: "2026-10" }, "2026-11", 320_000);
  assert.deepEqual(later.feeHistory, [{ from: "2026-11", fee: 320_000 }]);
  // narx o'zgarmasa — yozuv qo'shilmaydi
  assert.deepEqual(applyFeeFrom({ ...next, startMonth: "2026-10" }, "2027-01", 350_000).feeHistory, [{ from: "2026-12", fee: 350_000 }]);
});

test("standart narx jadvali: kelajakdagi o'zgarish va yangi o'quvchiga meros", () => {
  // Markaz standarti: hozir 300 000, dekabrdan 350 000 ("0000-01" — boshlanishi yo'q, doim tarixga yoziladi)
  const sched = applyFeeFrom({ monthlyFee: 300_000, feeHistory: [], startMonth: "0000-01" }, "2026-12", 350_000);
  assert.deepEqual(sched, { monthlyFee: 300_000, feeHistory: [{ from: "2026-12", fee: 350_000 }] });
  assert.equal(feeFor(sched, "2026-10"), 300_000);
  assert.equal(feeFor(sched, "2027-01"), 350_000);
  // Oktabrda qo'shilgan o'quvchi rejalashtirilgan o'zgarishni oladi, yanvarda qo'shilgani — yo'q (narxi allaqachon 350 000)
  assert.deepEqual(changesAfter(sched.feeHistory, "2026-10"), [{ from: "2026-12", fee: 350_000 }]);
  assert.deepEqual(changesAfter(sched.feeHistory, "2027-01"), []);
});

test("percentFor / applyPercentFrom", () => {
  assert.equal(percentFor([], "2026-10", 40), 40);
  const h = applyPercentFrom([], "2026-11", 35);
  assert.equal(percentFor(h, "2026-10", 40), 40);
  assert.equal(percentFor(h, "2026-11", 40), 35);
  assert.equal(percentFor(h, "2027-05", 40), 35);
  const h2 = applyPercentFrom([...h, { from: "2027-01", percent: 50 }], "2026-12", 45);
  assert.deepEqual(h2, [
    { from: "2026-11", percent: 35 },
    { from: "2026-12", percent: 45 },
  ]);
});

test("allocateAmount: oylar bo'yicha har xil narx", () => {
  const fee = (m: string) => (m >= "2026-12" ? 350_000 : 300_000);
  const paid = new Map<string, number>([["2026-11", 100_000]]);
  assert.deepEqual(allocateAmount(900_000, fee, "2026-11", paid), [
    { month: "2026-11", amount: 200_000 },
    { month: "2026-12", amount: 350_000 },
    { month: "2027-01", amount: 350_000 },
  ]);
  assert.equal(paid.get("2026-11"), 300_000);
  // eski (raqamli) narx bilan ham ishlaydi
  assert.deepEqual(allocateAmount(450_000, 300_000, "2026-10", new Map()), [
    { month: "2026-10", amount: 300_000 },
    { month: "2026-11", amount: 150_000 },
  ]);
  // sentabrda narx 0 (bepul), oktabrdan 300 000: sentabrdan boshlansa ham pul oktabrga yoziladi
  const zeroThenFee = (m: string) => (m >= "2026-10" ? 300_000 : 0);
  assert.deepEqual(allocateAmount(300_000, zeroThenFee, "2026-09", new Map()), [{ month: "2026-10", amount: 300_000 }]);
  // umuman narx bo'lmasa — hammasi birinchi oyga
  assert.deepEqual(allocateAmount(100_000, 0, "2026-09", new Map()), [{ month: "2026-09", amount: 100_000 }]);
});

test("rejalashtirilgan narx oshishini bekor qilish", () => {
  // Yanvardan 400 000 rejalashtirilgan; "noyabrdan 300 000" bilan bekor qilinadi (narx noyabrda allaqachon 300 000)
  const current = { monthlyFee: 300_000, feeHistory: [{ from: "2027-01", fee: 400_000 }] };
  const next = applyFeeFrom({ ...current, startMonth: "2026-10" }, "2026-11", 300_000);
  assert.deepEqual(next, { monthlyFee: 300_000, feeHistory: [] });
  assert.equal(feeFor(next, "2027-02"), 300_000);
});

test("oy oxiri eslatmasi va SMS oynasi", () => {
  assert.equal(daysInMonth("2026-10"), 31);
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(daysInMonth("2028-02"), 29);
  assert.equal(daysLeftInMonth("2026-10-21"), 10);
  assert.equal(daysLeftInMonth("2026-10-31"), 0);
  assert.equal(monthEndReminderActive("2026-10-20"), false);
  assert.equal(monthEndReminderActive("2026-10-21"), true);
  assert.equal(monthEndReminderActive("2026-11-20"), true); // noyabr — 30 kun
  assert.deepEqual(smsCandidateMonths("2026-10-24"), ["2026-08", "2026-09"]);
  assert.deepEqual(smsCandidateMonths("2026-10-25"), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(smsCandidateMonths("2027-01-03"), ["2026-11", "2026-12"]);
});

test("SMS matni va kun nomi", () => {
  const name = (m: string) => ({ "2026-09": "Sentabr", "2026-10": "Oktabr" })[m] ?? m;
  const t = "To'lov nazorati: {oy} uchun {soni} ta o'quvchi to'lov qilmagan.";
  assert.equal(renderSmsText(t, ["2026-10"], 7, name), "To'lov nazorati: Oktabr uchun 7 ta o'quvchi to'lov qilmagan.");
  // bir nechta oy — bitta so'z (Eskiz o'zgaruvchisiga mos)
  assert.equal(renderSmsText(t, ["2026-10", "2026-09"], 12, name), "To'lov nazorati: Sentabr-Oktabr uchun 12 ta o'quvchi to'lov qilmagan.");
  // Eskiz ko'rinishidagi o'zgaruvchilar: kabinetdagi shablon bilan aynan bir xil matn
  const eskiz = "To'lov nazorati: {#oy#} uchun {#soni#} ta o'quvchi hali to'lov qilmagan";
  assert.equal(renderSmsText(eskiz, ["2026-10"], 10, name), "To'lov nazorati: Oktabr uchun 10 ta o'quvchi hali to'lov qilmagan");
  assert.equal(templateHasCount(eskiz), true);
  assert.equal(templateHasCount("{soni}"), true);
  assert.equal(templateHasCount("soni yo'q"), false);
  assert.equal(dayLabel("2026-10-10"), "10-oktabr, shanba");
  assert.equal(dayLabel("2026-10-09"), "9-oktabr, juma");
  assert.equal(dayLabel("2026-10-11"), "11-oktabr, yakshanba");
});

test("parollar: scrypt, taqqoslash, barmoq izi", async () => {
  const h = await hashPassword("opa-parol-2026");
  assert.match(h, /^scrypt\$[\w-]+\$[\w-]+$/);
  assert.notEqual(await hashPassword("opa-parol-2026"), h); // har safar yangi tuz
  assert.equal(await verifyPassword("opa-parol-2026", h), true);
  assert.equal(await verifyPassword("opa-parol-2025", h), false);
  assert.equal(await verifyPassword("x", null), false);
  assert.equal(await verifyPassword("x", "buzilgan"), false);
  assert.equal(safeEqualText("abc", "abc"), true);
  assert.equal(safeEqualText("abc", "abd"), false);
  assert.equal(fingerprint("a"), fingerprint("a"));
  assert.notEqual(fingerprint("a"), fingerprint("b"));
});

test("server action argumentlari: faqat to'g'ri ObjectId", async () => {
  const { isId } = await import("../lib/ids");
  assert.equal(isId("6ac9dcf90698aca8bd508d6c"), true);
  assert.equal(isId("6AC9DCF90698ACA8BD508D6C"), true);
  assert.equal(isId("abcdefghijkl"), false); // 12 belgili ixtiyoriy qator
  assert.equal(isId(123), false);
  assert.equal(isId({ $ne: null }), false);
  assert.equal(isId(undefined), false);
});

test("telefon raqam (Eskiz)", () => {
  assert.equal(normalizeUzPhone("33 626 30 06"), "998336263006");
  assert.equal(normalizeUzPhone("+998 (33) 626-30-06"), "998336263006");
  assert.equal(normalizeUzPhone("998336263006"), "998336263006");
  assert.equal(normalizeUzPhone("12345"), null);
  assert.equal(formatUzPhone("998336263006"), "+998 33 626 30 06");
});

test("sessiya tokeni: rol va parol izi", async () => {
  const { adminCanAccess, createSessionToken, homeFor, readSessionToken } = await import("../lib/session");
  const owner = await createSessionToken("owner", "pv-1");
  assert.deepEqual(await readSessionToken(owner), { role: "owner", pv: "pv-1" });
  const admin = await createSessionToken("admin", "pv-2");
  assert.deepEqual(await readSessionToken(admin), { role: "admin", pv: "pv-2" });
  assert.equal(await readSessionToken(`${owner}x`), null);
  assert.equal(await readSessionToken(undefined), null);
  assert.equal(homeFor("owner"), "/");
  assert.equal(homeFor("admin"), "/payments");
  assert.equal(adminCanAccess("/payments"), true);
  assert.equal(adminCanAccess("/api/export/tolovlar"), true);
  assert.equal(adminCanAccess("/"), false);
  assert.equal(adminCanAccess("/students"), false);
  assert.equal(adminCanAccess("/settings"), false);
  assert.equal(adminCanAccess("/api/export/hisobot"), false);
});
