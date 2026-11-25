import "server-only";
// Mavjud ortiqcha to'lovlar: bir oyga oylikdan ko'p yozilgan, undan oldingi oy esa to'lanmagan — ortiqcha qism oldingi
// oyga ko'chiriladi (to'lov yozuvi oyi o'zgaradi yoki ikkiga bo'linadi: chek raqami, sana va usul saqlanadi).
import mongoose from "mongoose";
import { overpaymentMoves, type Move } from "./allocate";
import { connectDB } from "./db";
import { owesFor } from "./enrollment";
import { endIsoOf, LIVE, loadStudents, studentFee } from "./ledger";
import { Payment } from "./models";
import { compareMonths, currentMonth, monthOfDate, shiftMonth } from "./time";

export type OverpayMonth = { month: string; fee: number; paid: number; suggested: number };
export type OverpayRow = {
  studentId: string;
  name: string;
  group: string;
  moves: (Move & { fee: number; paid: number })[];
  /** Qo'lda taqsimlash uchun: ko'chirish tegadigan oylar (eng eskisidan ortiqcha to'langan oygacha) */
  months: OverpayMonth[];
};

/** Tekshiriladigan oylar: oxirgi 12 oy va oldindan to'lov uchun keyingi 12 oy */
function windowMonths(start: string): string[] {
  const from = shiftMonth(currentMonth(), -12);
  const to = shiftMonth(currentMonth(), 12);
  const out: string[] = [];
  for (let m = compareMonths(start, from) > 0 ? start : from; compareMonths(m, to) <= 0; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

export async function findOverpayments(onlyStudent?: string): Promise<OverpayRow[]> {
  await connectDB();
  const from = shiftMonth(currentMonth(), -12);
  const [students, agg] = await Promise.all([
    loadStudents(),
    Payment.aggregate<{ _id: { student: mongoose.Types.ObjectId; month: string }; total: number }>([
      { $match: { ...LIVE, month: { $gte: from }, ...(onlyStudent ? { student: new mongoose.Types.ObjectId(onlyStudent) } : {}) } },
      { $group: { _id: { student: "$student", month: "$month" }, total: { $sum: "$amount" } } },
    ]),
  ]);
  const paid = new Map<string, Map<string, number>>();
  for (const a of agg) {
    const id = String(a._id.student);
    const m = paid.get(id) ?? new Map<string, number>();
    m.set(a._id.month, a.total);
    paid.set(id, m);
  }
  const rows: OverpayRow[] = [];
  for (const s of students) {
    const id = String(s._id);
    const p = paid.get(id);
    if (!p || (onlyStudent && id !== onlyStudent)) continue;
    const startMonth = monthOfDate(s.startDate);
    const endIso = endIsoOf(s);
    const fee = (m: string) => (owesFor(m, { startMonth, active: s.active, endIso }) ? studentFee(s, m) : 0);
    const moves = overpaymentMoves(windowMonths(startMonth), fee, p);
    if (!moves.length) continue;
    const first = moves.reduce((a, x) => (x.to < a ? x.to : a), moves[0].to);
    const last = moves.reduce((a, x) => (x.from > a ? x.from : a), moves[0].from);
    const after = new Map(p);
    for (const x of moves) {
      after.set(x.from, (after.get(x.from) ?? 0) - x.amount);
      after.set(x.to, (after.get(x.to) ?? 0) + x.amount);
    }
    const months: OverpayMonth[] = [];
    for (let m = first; m <= last; m = shiftMonth(m, 1)) months.push({ month: m, fee: fee(m), paid: p.get(m) ?? 0, suggested: after.get(m) ?? 0 });
    rows.push({ studentId: id, name: s.fullName, group: s.group ?? "", moves: moves.map((x) => ({ ...x, fee: fee(x.from), paid: p.get(x.from) ?? 0 })), months });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Ko'chirishni bajarish: `from` oyining eng oxirgi kiritilgan to'lovlaridan boshlab. O'zgargan yozuvlar soni. */
export async function applyMoves(studentId: string, moves: Move[], by: "owner" | "admin"): Promise<number> {
  let changed = 0;
  for (const mv of moves) {
    let rest = mv.amount;
    const docs = await Payment.find({ ...LIVE, student: studentId, month: mv.from }).sort({ createdAt: -1 }).lean();
    for (const d of docs) {
      if (rest <= 0) break;
      if (d.amount <= rest) {
        await Payment.updateOne({ _id: d._id, ...LIVE, amount: d.amount, month: mv.from }, { $set: { month: mv.to } });
        rest -= d.amount;
      } else {
        // Ikkiga bo'linadi: qolgani o'z oyida, ko'chirilgani — oldingi oyga (bir xil chek, sana va usul)
        const res = await Payment.updateOne(
          { _id: d._id, ...LIVE, amount: d.amount },
          { $set: { amount: d.amount - rest, editedAt: new Date(), editedBy: by, originalAmount: d.originalAmount ?? d.amount } },
        );
        if (!res.modifiedCount) continue;
        const { _id, createdAt, updatedAt, ...copy } = d as typeof d & { createdAt?: Date; updatedAt?: Date };
        void _id;
        void updatedAt;
        await Payment.create({ ...copy, month: mv.to, amount: rest, createdAt });
        rest = 0;
      }
      changed++;
    }
  }
  return changed;
}

/** O'quvchining shu oylardagi hozirgi to'lovlari (arxivlanganlarsiz). */
export async function paidInMonths(studentId: string, months: string[]): Promise<Map<string, number>> {
  await connectDB();
  const agg = await Payment.aggregate<{ _id: string; total: number }>([
    { $match: { ...LIVE, student: new mongoose.Types.ObjectId(studentId), month: { $in: months } } },
    { $group: { _id: "$month", total: { $sum: "$amount" } } },
  ]);
  return new Map(agg.map((a) => [a._id, a.total]));
}
