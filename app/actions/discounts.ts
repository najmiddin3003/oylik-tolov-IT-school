"use server";

// Chegirmalar: turlari (faqat rahbar) va o'quvchiga yoqish/o'chirish (rahbar va administrator) — tanlangan oydan.
import { randomUUID } from "node:crypto";
import { logActivity } from "@/lib/activity";
import { dataChanged } from "@/lib/after-change";
import { requireOwner, requireRole } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { discountLabel, discountValueError, isDiscountKind, MAX_DISCOUNT_TYPES, setDiscountFrom, type DiscountType } from "@/lib/discounts";
import { isId } from "@/lib/ids";
import { discountHistoryOf } from "@/lib/ledger";
import { Student } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { getSettings, updateSettings } from "@/lib/settings";
import { currentMonth, isValidMonth, monthLabel } from "@/lib/time";
import type { FormState } from "./types";

function readType(fd: FormData): { value: Omit<DiscountType, "id"> } | { fieldErrors: Record<string, string> } {
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const kind = String(fd.get("kind") ?? "");
  const raw = String(fd.get("value") ?? "").trim();
  const value = kind === "percent" ? Number(raw.replace(",", ".")) : (parseAmount(raw) ?? NaN);
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Nomini kiriting";
  if (!isDiscountKind(kind)) fieldErrors.kind = "Turini tanlang";
  else {
    const e = discountValueError(kind, value);
    if (e) fieldErrors.value = e;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  return { value: { name, kind: kind as DiscountType["kind"], value } };
}

/** Yangi chegirma turi (masalan, «Aka-uka» — 10%). */
export async function addDiscountType(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const r = readType(fd);
  if ("fieldErrors" in r) return r;
  const { types } = (await getSettings({ fresh: true })).discounts;
  if (types.length >= MAX_DISCOUNT_TYPES) return { error: `Ko‘pi bilan ${MAX_DISCOUNT_TYPES} ta chegirma turi` };
  if (types.some((t) => t.name.toLowerCase() === r.value.name.toLowerCase())) return { fieldErrors: { name: "Bunday nomli chegirma bor" } };
  const t: DiscountType = { id: randomUUID().slice(0, 8), ...r.value };
  await updateSettings({ $set: { "discounts.types": [...types, t] } });
  await logActivity(session, "settings.discount", `Chegirma turi qo‘shildi: ${t.name} — ${discountLabel(t)}`);
  await dataChanged();
  return { ok: true, message: `«${t.name}» qo‘shildi`, nonce: Date.now() };
}

/**
 * Chegirma turini tahrirlash. Shu chegirmasi bor o'quvchilarda yangi qiymat joriy oydan qo'llanadi
 * (o'tgan oylar hisobi o'zgarmaydi).
 */
export async function updateDiscountType(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const r = readType(fd);
  if ("fieldErrors" in r) return r;
  const { types } = (await getSettings({ fresh: true })).discounts;
  const old = types.find((t) => t.id === id);
  if (!old) return { error: "Chegirma turi topilmadi" };
  if (types.some((t) => t.id !== id && t.name.toLowerCase() === r.value.name.toLowerCase())) return { fieldErrors: { name: "Bunday nomli chegirma bor" } };
  const next: DiscountType = { id, ...r.value };
  await updateSettings({ $set: { "discounts.types": types.map((t) => (t.id === id ? next : t)) } });
  const moved = await reapplyType(id, { typeId: id, name: next.name, kind: next.kind, value: next.value });
  await logActivity(
    session,
    "settings.discount",
    `Chegirma turi tahrirlandi: ${old.name} ${discountLabel(old)} → ${next.name} ${discountLabel(next)}${moved ? ` (${moved} ta o‘quvchida ${monthLabel(currentMonth())} dan)` : ""}`,
  );
  await dataChanged();
  return { ok: true, message: `Saqlandi${moved ? ` — ${moved} ta o‘quvchida ${monthLabel(currentMonth())} dan yangi qiymat` : ""}`, nonce: Date.now() };
}

/** Chegirma turini o'chirish: shu chegirmasi bor o'quvchilarda joriy oydan chegirma tugaydi (o'tgan oylar o'zgarmaydi). */
export async function deleteDiscountType(id: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  const { types } = (await getSettings({ fresh: true })).discounts;
  const old = types.find((t) => t.id === id);
  if (!old) return;
  await updateSettings({ $set: { "discounts.types": types.filter((t) => t.id !== id) } });
  const moved = await reapplyType(id, null);
  await logActivity(session, "settings.discount", `Chegirma turi o‘chirildi: ${old.name}${moved ? ` (${moved} ta o‘quvchida ${monthLabel(currentMonth())} dan chegirma tugadi)` : ""}`);
  await dataChanged();
}

/** Hozir shu turdagi chegirmasi bor o'quvchilarga joriy oydan yangi qiymat (null — chegirma tugaydi). */
async function reapplyType(typeId: string, change: Parameters<typeof setDiscountFrom>[2]): Promise<number> {
  await connectDB();
  const month = currentMonth();
  const students = await Student.find({ "discountHistory.typeId": typeId }, { discountHistory: 1 }).lean();
  let n = 0;
  for (const s of students) {
    const history = discountHistoryOf(s);
    const cur = [...history].filter((h) => h.from <= month).at(-1);
    const later = history.some((h) => h.from > month && h.typeId === typeId);
    if (cur?.typeId !== typeId && !later) continue;
    await Student.updateOne({ _id: s._id }, { $set: { discountHistory: setDiscountFrom(history, month, change) } });
    n++;
  }
  return n;
}

/**
 * O'quvchiga chegirmani yoqish (tur tanlanadi) yoki o'chirish — tanlangan oydan. O'tgan oylar hisobi o'zgarmaydi,
 * tanlangan oydan keyingi eski o'zgarishlar bekor bo'ladi.
 */
export async function setStudentDiscount(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireRole(["owner", "admin"], { fresh: true });
  const studentId = String(fd.get("studentId") ?? "");
  const typeId = String(fd.get("typeId") ?? "");
  const from = String(fd.get("from") ?? "");
  const on = fd.get("on") === "1";
  if (!isId(studentId)) return { error: "O‘quvchi topilmadi" };
  if (!isValidMonth(from)) return { fieldErrors: { from: "Qaysi oydan — tanlang" } };
  const settings = await getSettings({ fresh: true });
  if (!settings.discounts.enabled) return { error: "Chegirmalar o‘chirilgan (Sozlamalar → Chegirmalar)" };
  const type = on ? settings.discounts.types.find((t) => t.id === typeId) : null;
  if (on && !type) return { fieldErrors: { typeId: "Chegirma turini tanlang" } };
  await connectDB();
  const s = await Student.findById(studentId, { fullName: 1, discountHistory: 1 }).lean();
  if (!s) return { error: "O‘quvchi topilmadi" };
  const history = setDiscountFrom(discountHistoryOf(s), from, type ? { typeId: type.id, name: type.name, kind: type.kind, value: type.value } : null);
  await Student.updateOne({ _id: studentId }, { $set: { discountHistory: history } });
  const what = type ? `${type.name} (${discountLabel(type)})` : "chegirma o‘chirildi";
  await logActivity(session, "student.discount", `${s.fullName}: ${what} — ${monthLabel(from)} dan`);
  await dataChanged();
  return { ok: true, message: type ? `${type.name} ${discountLabel(type)} — ${monthLabel(from)} dan` : `Chegirma ${monthLabel(from)} dan o‘chirildi`, nonce: Date.now() };
}
