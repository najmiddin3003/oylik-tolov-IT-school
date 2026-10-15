import "server-only";
// Kassa: administrator kiritgan to'lovlar uning kassasiga tushadi; kun oxirida rahbarga topshiradi.
// Rahbar «Qabul qildim» deguncha pul administrator kassasida turadi, qabul qilingach — rahbar kassasiga o'tadi.
// Naqd va karta (karta + o'tkazma) alohida hisoblanadi. Kassa yuritilishidan oldingi to'lovlar hisobga kirmaydi.
import mongoose from "mongoose";
import { connectDB } from "./db";
import { LIVE } from "./ledger";
import { Handover, Payment } from "./models";
import { listStaff } from "./staff";
import { currentMonth, isoToDate, monthOfDate, todayISO } from "./time";

export type Money = { cash: number; card: number };

const ZERO: Money = { cash: 0, card: 0 };
const add = (a: Money, b: Money): Money => ({ cash: a.cash + b.cash, card: a.card + b.card });
const sub = (a: Money, b: Money): Money => ({ cash: a.cash - b.cash, card: a.card - b.card });
export const moneyTotal = (m: Money) => m.cash + m.card;

/** To'lov usuli -> kassa bo'limi: naqd yoki karta (karta va o'tkazma birga). */
const bucket = (method: string | null | undefined): keyof Money => ((method ?? "naqd") === "naqd" ? "cash" : "card");

/** Administrator kassasi kaliti: xodim ID si yoki eski umumiy parol bilan kirilganda — "admin". */
export const LEGACY_ADMIN = "admin";
const keyOf = (staff: unknown) => (staff ? String(staff) : LEGACY_ADMIN);

export type HandoverRow = {
  id: string;
  fromKey: string;
  fromName: string;
  cash: number;
  card: number;
  note: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  decidedAt: string | null;
  decidedByName: string;
};

export type CashierKassa = {
  key: string;
  name: string;
  /** Kiritgan to'lovlari (kassa boshlanganidan beri) */
  received: Money;
  /** Rahbar qabul qilgan topshiruvlar */
  handedOver: Money;
  /** Rahbar hali qabul qilmagan topshiruvlar (pul hali shu kassada) */
  pending: Money;
  /** Kassadagi pul: kiritilgan − qabul qilingan topshiruvlar */
  balance: Money;
  /** Yana topshirish mumkin: kassadagi − kutilayotgan topshiruvlar */
  available: Money;
  /** Bugun kiritilgan to'lovlar */
  today: Money;
};

function toHandoverRow(h: {
  _id: unknown;
  fromStaff?: unknown;
  fromName?: string | null;
  cash?: number | null;
  card?: number | null;
  note?: string | null;
  status?: string | null;
  createdAt?: Date;
  decidedAt?: Date | null;
  decidedByName?: string | null;
}): HandoverRow {
  return {
    id: String(h._id),
    fromKey: keyOf(h.fromStaff),
    fromName: h.fromName || "Administrator",
    cash: h.cash ?? 0,
    card: h.card ?? 0,
    note: h.note ?? "",
    status: h.status === "accepted" || h.status === "rejected" ? h.status : "pending",
    createdAt: (h.createdAt ?? new Date()).toISOString(),
    decidedAt: h.decidedAt ? h.decidedAt.toISOString() : null,
    decidedByName: h.decidedByName ?? "",
  };
}

/** Barcha kassalar: har bir administrator kassasi, rahbar kassasi va topshiruvlar tarixi. */
export async function kassaState() {
  await connectDB();
  const todayStart = isoToDate(todayISO())!;
  const [paymentsAgg, todayAgg, handovers, staff] = await Promise.all([
    Payment.aggregate<{ _id: { role: string; staff: mongoose.Types.ObjectId | null; method: string }; total: number }>([
      { $match: { ...LIVE, cashierRole: { $in: ["owner", "admin"] } } },
      { $group: { _id: { role: "$cashierRole", staff: "$cashierStaff", method: "$method" }, total: { $sum: "$amount" } } },
    ]),
    Payment.aggregate<{ _id: { role: string; staff: mongoose.Types.ObjectId | null; method: string }; total: number }>([
      { $match: { ...LIVE, cashierRole: { $in: ["owner", "admin"] }, createdAt: { $gte: todayStart } } },
      { $group: { _id: { role: "$cashierRole", staff: "$cashierStaff", method: "$method" }, total: { $sum: "$amount" } } },
    ]),
    Handover.find({}).sort({ createdAt: -1 }).limit(500).lean(),
    listStaff(),
  ]);

  const names = new Map(staff.map((s) => [String(s._id), s.name]));
  const cashiers = new Map<string, CashierKassa>();
  const cashier = (key: string): CashierKassa => {
    let c = cashiers.get(key);
    if (!c) {
      c = {
        key,
        name: key === LEGACY_ADMIN ? "Administrator (umumiy parol)" : (names.get(key) ?? "Administrator"),
        received: { ...ZERO },
        handedOver: { ...ZERO },
        pending: { ...ZERO },
        balance: { ...ZERO },
        available: { ...ZERO },
        today: { ...ZERO },
      };
      cashiers.set(key, c);
    }
    return c;
  };

  // Rahbar o'zi kiritgan to'lovlar to'g'ridan-to'g'ri rahbar kassasiga
  let ownerDirect = { ...ZERO };
  let ownerToday = { ...ZERO };
  for (const a of paymentsAgg) {
    const b = bucket(a._id.method);
    if (a._id.role === "owner") ownerDirect = { ...ownerDirect, [b]: ownerDirect[b] + a.total };
    else cashier(keyOf(a._id.staff)).received[b] += a.total;
  }
  for (const a of todayAgg) {
    const b = bucket(a._id.method);
    if (a._id.role === "owner") ownerToday = { ...ownerToday, [b]: ownerToday[b] + a.total };
    else cashier(keyOf(a._id.staff)).today[b] += a.total;
  }

  const rows = handovers.map(toHandoverRow);
  let accepted = { ...ZERO };
  let acceptedMonth = { ...ZERO };
  const month = currentMonth();
  for (const h of rows) {
    const m: Money = { cash: h.cash, card: h.card };
    if (h.status === "accepted") {
      const c = cashier(h.fromKey);
      c.handedOver = add(c.handedOver, m);
      accepted = add(accepted, m);
      if (h.decidedAt && monthOfDate(new Date(h.decidedAt)) === month) acceptedMonth = add(acceptedMonth, m);
    } else if (h.status === "pending") {
      const c = cashier(h.fromKey);
      c.pending = add(c.pending, m);
    }
  }
  for (const c of cashiers.values()) {
    c.balance = sub(c.received, c.handedOver);
    c.available = sub(c.balance, c.pending);
  }

  return {
    cashiers: [...cashiers.values()].sort((a, b) => moneyTotal(b.balance) - moneyTotal(a.balance)),
    owner: {
      /** Administratorlardan qabul qilingan */
      accepted,
      acceptedMonth,
      /** Rahbar o'zi kiritgan to'lovlar */
      direct: ownerDirect,
      today: ownerToday,
      total: add(accepted, ownerDirect),
    },
    pending: rows.filter((h) => h.status === "pending"),
    history: rows,
  };
}

/** Bitta administratorning kassasi va o'z topshiruvlari. */
export async function cashierKassa(staffId: string | null) {
  const state = await kassaState();
  const key = staffId ?? LEGACY_ADMIN;
  const mine = state.cashiers.find((c) => c.key === key) ?? {
    key,
    name: "",
    received: { ...ZERO },
    handedOver: { ...ZERO },
    pending: { ...ZERO },
    balance: { ...ZERO },
    available: { ...ZERO },
    today: { ...ZERO },
  };
  return { kassa: mine, history: state.history.filter((h) => h.fromKey === key) };
}
