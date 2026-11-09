"use server";

// Kassa: administrator yig'gan pulni rahbarga topshiradi; rahbar qabul qiladi (yoki rad etadi).
import { logActivity } from "@/lib/activity";
import { dataChanged } from "@/lib/after-change";
import { requireOwner, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isId } from "@/lib/ids";
import { cashierKassa, kassaState, LEGACY_ADMIN } from "@/lib/kassa";
import { Handover } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { formatMoney } from "@/lib/time";
import type { FormState } from "./types";

const both = (cash: number, card: number) =>
  [cash ? `naqd ${formatMoney(cash)}` : "", card ? `karta ${formatMoney(card)}` : ""].filter(Boolean).join(", ");

/** Administrator: kassadagi pulni rahbarga topshirish (rahbar qabul qilguncha kassada turadi). */
export async function sendHandover(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireRole(["admin"], { fresh: true });
  const cash = parseAmount(String(fd.get("cash") ?? "")) ?? 0;
  const card = parseAmount(String(fd.get("card") ?? "")) ?? 0;
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);

  const { kassa } = await cashierKassa(session.staffId);
  const fieldErrors: Record<string, string> = {};
  if (cash < 0 || cash > Math.max(0, kassa.available.cash)) fieldErrors.cash = `Kassada topshirish mumkin: ${formatMoney(Math.max(0, kassa.available.cash))}`;
  if (card < 0 || card > Math.max(0, kassa.available.card)) fieldErrors.card = `Kassada topshirish mumkin: ${formatMoney(Math.max(0, kassa.available.card))}`;
  if (!fieldErrors.cash && !fieldErrors.card && cash + card <= 0) fieldErrors.cash = "Topshiriladigan summani kiriting";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  await Handover.create({ fromStaff: session.staffId, fromName: session.name ?? "Administrator", cash, card, note });
  await logActivity(session, "kassa.send", `Rahbarga topshirildi (qabul kutilmoqda): ${both(cash, card)}`);
  await dataChanged();
  return { ok: true, message: `Rahbarga yuborildi: ${both(cash, card)}. Rahbar qabul qilgach, kassangizdan chiqadi.`, nonce: Date.now() };
}

/** Rahbar: topshiruvni qabul qilish yoki rad etish. */
export async function decideHandover(id: string, decision: "accept" | "reject"): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id) || (decision !== "accept" && decision !== "reject")) return;
  await connectDB();
  const h = await Handover.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      $set: {
        status: decision === "accept" ? "accepted" : "rejected",
        decidedAt: new Date(),
        decidedBy: session.staffId,
        decidedByName: session.name ?? "Rahbar",
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!h) return;
  await logActivity(
    session,
    decision === "accept" ? "kassa.accept" : "kassa.reject",
    `${h.fromName || "Administrator"}dan ${decision === "accept" ? "qabul qilindi" : "rad etildi"}: ${both(h.cash ?? 0, h.card ?? 0)}`,
  );
  await dataChanged();
}

/**
 * Rahbar: administrator kassasidagi pulni topshiruvsiz, qo'lda qabul qilish (pul qo'lga berilgan, lekin «Rahbarga
 * topshirish» bosilmagan bo'lsa). Masalan, eski umumiy parol bilan kiritilgan to'lovlar: administrator xodim sifatida
 * ro'yxatdan o'tgach o'sha kassaga kira olmaydi — rahbar shu yerdan yopadi. Kutilayotgan topshiruvlar hisobga olinmaydi.
 */
export async function acceptCashierBalance(key: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (key !== LEGACY_ADMIN && !isId(key)) return;
  const state = await kassaState();
  const c = state.cashiers.find((x) => x.key === key);
  if (!c) return;
  const cash = Math.max(0, c.available.cash);
  const card = Math.max(0, c.available.card);
  if (cash + card <= 0) return;
  await connectDB();
  await Handover.create({
    fromStaff: key === LEGACY_ADMIN ? null : key,
    fromName: c.name,
    cash,
    card,
    note: "Rahbar qo‘lda qabul qildi",
    status: "accepted",
    decidedAt: new Date(),
    decidedBy: session.staffId,
    decidedByName: session.name ?? "Rahbar",
  });
  await logActivity(session, "kassa.accept", `${c.name} kassasidan qo‘lda qabul qilindi: ${both(cash, card)}`);
  await dataChanged();
}
