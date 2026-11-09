import assert from "node:assert/strict";
import { test } from "node:test";
import { salaryCycles, SALARY_CYCLE_FROM, type CycleClose, type CyclePayment } from "../lib/salary-cycle";
import { isoToDate } from "../lib/time";

/** Toshkent vaqti bo'yicha "YYYY-MM-DD" kunining shu soati */
function at(iso: string, hour = 12): Date {
  return new Date(isoToDate(iso)!.getTime() + hour * 3600_000);
}

/** To'lov: qaysi oy uchun, summa, to'langan kun (shu kuni soat `hour` da saytga kiritilgan) */
function pay(month: string, amount: number, day: string, hour = 12): CyclePayment {
  return { month, amount, paidAt: isoToDate(day)!, createdAt: at(day, hour) };
}

/** «Oylik» yozuvi: qaysi oy uchun, olingan kun (shu kuni soat `hour` da yozilgan) */
function oylik(month: string, day: string, hour = 12): CycleClose {
  return { month, date: isoToDate(day)!, createdAt: at(day, hour) };
}

const base = (c: ReturnType<typeof salaryCycles>) => Object.fromEntries([...c.bases].sort(([a], [b]) => (a < b ? -1 : 1)));

test("oylik davri oktabr 2026 dan boshlanadi", () => {
  assert.equal(SALARY_CYCLE_FROM, "2026-10");
});

test("oktabr oyligi olinmagan: noyabrda tushgan to'lovlar ham oktabrga", () => {
  const payments = [pay("2026-10", 300_000, "2026-10-05"), pay("2026-10", 300_000, "2026-10-20"), pay("2026-11", 300_000, "2026-11-02"), pay("2026-10", 100_000, "2026-11-03")];
  const c = salaryCycles(payments, [], at("2026-11-04"));
  assert.deepEqual(base(c), { "2026-10": 1_000_000 });
  assert.equal(c.current, "2026-10", "yangi to'lov ham oktabrga");
  assert.equal(c.closedOn("2026-10"), null);
});

test("oktabr uchun «oylik» yozilgach keyingi to'lovlar noyabrga", () => {
  const payments = [
    pay("2026-10", 300_000, "2026-10-05"),
    pay("2026-11", 300_000, "2026-11-02"),
    // Oylik olingan kuni — oylik yozilishidan oldin kiritilgan
    pay("2026-11", 200_000, "2026-11-05", 10),
    // Oylik olingan kuni — oylik yozilgandan keyin
    pay("2026-11", 400_000, "2026-11-05", 18),
    pay("2026-11", 500_000, "2026-11-10"),
  ];
  const c = salaryCycles(payments, [oylik("2026-10", "2026-11-05", 15)], at("2026-11-12"));
  assert.deepEqual(base(c), { "2026-10": 800_000, "2026-11": 900_000 });
  assert.equal(c.current, "2026-11");
  assert.equal(c.closedOn("2026-10"), "2026-11-05");
  assert.equal(c.closedOn("2026-11"), null);
});

test("oylik keyinroq yozilsa ham olingan sanasi bo'yicha yopiladi", () => {
  // 3-noyabrda olingan oylik 6-noyabrda yozildi: 4-5-noyabr to'lovlari — noyabrga
  const payments = [pay("2026-10", 300_000, "2026-10-12"), pay("2026-11", 300_000, "2026-11-02"), pay("2026-11", 300_000, "2026-11-04"), pay("2026-11", 300_000, "2026-11-05")];
  const c = salaryCycles(payments, [oylik("2026-10", "2026-11-03", 0)], at("2026-11-06"));
  assert.deepEqual(base(c), { "2026-10": 600_000, "2026-11": 600_000 });
});

test("avans oyni yopmaydi; bir necha «oylik» — birinchisi yopadi", () => {
  const payments = [pay("2026-11", 300_000, "2026-11-02"), pay("2026-11", 300_000, "2026-11-08"), pay("2026-11", 300_000, "2026-11-12")];
  // Avans yozuvlari salaryCycles'ga berilmaydi (faqat «oylik»); ikkinchi «oylik» — qoldiq qismi
  const c = salaryCycles(payments, [oylik("2026-10", "2026-11-10"), oylik("2026-10", "2026-11-05")], at("2026-11-12"));
  assert.deepEqual(base(c), { "2026-10": 300_000, "2026-11": 600_000 });
  assert.equal(c.closedOn("2026-10"), "2026-11-05");
});

test("oylik oy tugamasdan berilsa — undan keyingi to'lovlar keyingi oyga", () => {
  const payments = [pay("2026-10", 300_000, "2026-10-20"), pay("2026-10", 300_000, "2026-10-30")];
  const c = salaryCycles(payments, [oylik("2026-10", "2026-10-28")], at("2026-10-31"));
  assert.deepEqual(base(c), { "2026-10": 300_000, "2026-11": 300_000 });
  assert.equal(c.current, "2026-11");
});

test("oldindan to'lov o'z oyi boshlanganda tushgan hisoblanadi", () => {
  const advance = pay("2026-12", 300_000, "2026-11-15");
  const payments = [pay("2026-11", 200_000, "2026-11-10"), advance];
  // Oktabr yopilgan, noyabr 1-dekabrda hali ochiq — dekabr uchun to'lov ham noyabr oyligiga
  assert.deepEqual(base(salaryCycles(payments, [oylik("2026-10", "2026-11-05")], at("2026-12-02"))), { "2026-11": 500_000 });
  // Noyabr oyligi 30-noyabrda berilgan — dekabrga
  assert.deepEqual(base(salaryCycles(payments, [oylik("2026-10", "2026-11-05"), oylik("2026-11", "2026-11-30")], at("2026-12-02"))), { "2026-11": 200_000, "2026-12": 300_000 });
  // Boshqa to'lovi bo'lmasa — o'z oyiga (noyabr kutilmaydi)
  assert.deepEqual(base(salaryCycles([advance], [oylik("2026-10", "2026-11-05")], at("2026-12-02"))), { "2026-12": 300_000 });
});

test("keyingi oy uchun «oylik» yozilsa, oldingi ochiq oy ham yopiladi", () => {
  const payments = [pay("2026-10", 300_000, "2026-10-05"), pay("2026-11", 300_000, "2026-11-10"), pay("2026-12", 300_000, "2026-12-03"), pay("2026-12", 300_000, "2026-12-08")];
  // Oktabr uchun oylik yozilmadi, 5-dekabrda noyabr uchun yozildi
  const c = salaryCycles(payments, [oylik("2026-11", "2026-12-05")], at("2026-12-10"));
  assert.deepEqual(base(c), { "2026-10": 900_000, "2026-12": 300_000 });
  assert.equal(c.closedOn("2026-10"), "2026-12-05");
  assert.equal(c.closedOn("2026-11"), "2026-12-05");
  assert.equal(c.current, "2026-12");
});

test("o'z oyida pul tushmagan oy ochiq turmaydi (yangi xodim, ta'til)", () => {
  // Xodim yanvarda ishlay boshladi: oktabr–dekabr oylari kutilmaydi
  const c = salaryCycles([pay("2027-01", 300_000, "2027-01-10"), pay("2027-02", 300_000, "2027-02-03")], [], at("2027-02-05"));
  assert.deepEqual(base(c), { "2027-01": 600_000 });
  assert.equal(c.current, "2027-01");
  // Ishlanmagan oy «yopildi» deb ko'rsatilmaydi
  const later = salaryCycles([pay("2027-01", 300_000, "2027-01-10")], [oylik("2027-01", "2027-02-03")], at("2027-02-05"));
  assert.equal(later.closedOn("2026-12"), null);
  assert.equal(later.closedOn("2027-01"), "2027-02-03");
});

test("oylik davridan oldingi oylar — eski qoida (kalendar oyi)", () => {
  const payments = [pay("2026-08", 300_000, "2026-08-10"), pay("2026-08", 300_000, "2026-09-03"), pay("2026-09", 300_000, "2026-09-10"), pay("2026-10", 300_000, "2026-10-02")];
  const c = salaryCycles(payments, [oylik("2026-09", "2026-10-05")], at("2026-10-06"));
  // Sentabr uchun oylik 5-oktabrda olingan bo'lsa ham, 2-oktabrdagi to'lov — oktabrga (sentabr kalendar bo'yicha yopilgan)
  assert.deepEqual(base(c), { "2026-08": 300_000, "2026-09": 600_000, "2026-10": 300_000 });
  assert.equal(c.closedOn("2026-09"), null);
  assert.equal(c.current, "2026-10");
});

test("yil almashishi", () => {
  const c = salaryCycles([pay("2026-12", 300_000, "2026-12-10"), pay("2027-01", 300_000, "2027-01-04")], [oylik("2026-11", "2026-12-01")], at("2027-01-05"));
  assert.deepEqual(base(c), { "2026-12": 600_000 });
  assert.equal(c.current, "2026-12");
});

test("monthOf: to'lov qaysi oy oyligiga hisoblangani — bases bilan bir xil", () => {
  const nov1 = pay("2026-11", 300_000, "2026-11-02"); // oktabr hali ochiq — oktabrga
  const nov2 = pay("2026-11", 300_000, "2026-11-10"); // oktabr yopilgach — noyabrga
  const dec = pay("2026-12", 300_000, "2026-11-20"); // oldindan to'lov — dekabr boshlanganda, noyabr hali ochiq — noyabrga
  const c = salaryCycles([pay("2026-10", 300_000, "2026-10-05"), nov1, nov2, dec], [oylik("2026-10", "2026-11-05")], at("2026-11-25"));
  assert.equal(c.monthOf(nov1), "2026-10", "noyabr uchun to'lov oktabr oyligida olingan");
  assert.equal(c.monthOf(nov2), "2026-11");
  assert.equal(c.monthOf(dec), "2026-11");
  assert.deepEqual(base(c), { "2026-10": 600_000, "2026-11": 600_000 });
});
