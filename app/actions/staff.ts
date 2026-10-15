"use server";

// Xodimlarni boshqarish (faqat rahbar): qo'shish, tahrirlash, oylik foizi, kirishni o'chirish/tiklash, oylik va avanslar.
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { requireOwner } from "@/lib/auth";
import { assignCourseStudents, clearCourseTeacher } from "@/lib/course-teacher";
import { sameCourse } from "@/lib/courses";
import { connectDB } from "@/lib/db";
import { applyAmountFrom, applyPercentFrom } from "@/lib/fees";
import { isId } from "@/lib/ids";
import { Salary, Staff, Student } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { formatUzPhone, normalizeUzPhone } from "@/lib/phone";
import { ROLES, type Role } from "@/lib/session";
import { getSettings, updateSettings } from "@/lib/settings";
import { getStaffById, salaryHistoryOf, shareHistoryOf } from "@/lib/staff";
import { defaultShareBase, parsePercent, payKindOf, ROLE_LABEL } from "@/lib/staff-rules";
import { currentMonth, formatMoney, isoToDate, isValidMonth, monthLabel, todayISO } from "@/lib/time";

const MAX_SALARY = 100_000_000;
import type { FormState } from "./types";

function str(fd: FormData, key: string, max = 200): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);

/**
 * Yangi xodim: ism, telefon, rol; oyligi — o'qituvchi va rahbarda foiz, administratorda belgilangan summa (shu oydan
 * boshlab); o'qituvchi uchun — kursi (ixtiyoriy: kurs unga biriktiriladi va shu kurs o'quvchilari unga o'tadi).
 * Xodim keyin o'zi SMS kod orqali ro'yxatdan o'tadi.
 */
export async function addStaff(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const name = str(fd, "name", 80).replace(/\s+/g, " ");
  const phone = normalizeUzPhone(str(fd, "phone", 40));
  const role = str(fd, "role");
  const fixed = isRole(role) && payKindOf(role) === "fixed";
  const percentRaw = fixed ? "" : str(fd, "percent");
  const percent = percentRaw ? parsePercent(percentRaw) : 0;
  const salaryRaw = fixed ? str(fd, "salary") : "";
  const salary = salaryRaw ? parseAmount(salaryRaw) : 0;
  const courseRaw = role === "teacher" ? str(fd, "course", 80) : "";

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Ism-familiyani kiriting";
  if (!phone) fieldErrors.phone = "Telefon raqamni to‘liq kiriting, masalan: 90 123 45 67";
  if (!isRole(role)) fieldErrors.role = "Lavozimni tanlang";
  if (percent === null) fieldErrors.percent = "0 dan 100 gacha son kiriting";
  if (salary === null || salary < 0 || salary > MAX_SALARY) fieldErrors.salary = "Oylik summasi noto‘g‘ri";
  const settings = await getSettings({ fresh: true });
  const courseIndex = courseRaw ? settings.courses.findIndex((c) => sameCourse(c.name, courseRaw)) : -1;
  if (courseRaw && courseIndex < 0) fieldErrors.course = "Kurs topilmadi — sahifani yangilang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  if (await Staff.exists({ phone })) return { fieldErrors: { phone: "Bu raqam bilan xodim allaqachon qo‘shilgan" } };
  const created = await Staff.create({
    name,
    phone: phone!,
    role: role as Role,
    status: "invited",
    shareHistory: percent ? [{ from: "0000-01", percent }] : [],
    shareBase: defaultShareBase(role as Role),
    // Belgilangan oylik — qo'shilgan oydan boshlab (avvalgi oylarga yozilmaydi; kerak bo'lsa profilida o'zgartiriladi)
    salaryHistory: salary ? [{ from: currentMonth(), amount: salary }] : [],
  });

  // Kurs o'qituvchisi: kurs unga biriktiriladi, kursdagi o'qituvchisiz (va avvalgi kurs o'qituvchisidagi) o'quvchilar unga o'tadi
  let courseNote = "";
  if (courseIndex >= 0) {
    const id = String(created._id);
    const course = settings.courses[courseIndex];
    await updateSettings({ $set: { courses: settings.courses.map((c, i) => (i === courseIndex ? { ...c, teacher: id } : c)) } });
    const assigned = await assignCourseStudents(course.name, id, course.teacher);
    courseNote = `«${course.name}» kursi${assigned ? ` va uning ${assigned} ta o‘quvchisi` : ""} unga biriktirildi`;
  }
  await logActivity(
    session,
    "staff.add",
    `Xodim qo‘shildi: ${name} (${ROLE_LABEL[role as Role]}, ${formatUzPhone(phone!)}${percent ? `, ${percent}%` : ""}${salary ? `, oylik ${formatMoney(salary)}` : ""})${courseNote ? ` · ${courseNote}` : ""}`,
  );
  refresh();
  return {
    ok: true,
    message: `${name} (${ROLE_LABEL[role as Role]}) qo‘shildi.${courseNote ? ` ${courseNote}.` : ""} Endi u kirish sahifasida ${formatUzPhone(phone!)} raqamini kiritadi — birinchi marta SMS kod keladi va o‘zi parol qo‘yadi.`,
    nonce: Date.now(),
  };
}

/** Ism va lavozimni o'zgartirish. Rahbar o'z lavozimini o'zgartira olmaydi (tizimdan chiqib qolmasligi uchun). */
export async function updateStaff(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id)) return { error: "Xodim topilmadi" };
  const name = str(fd, "name", 80).replace(/\s+/g, " ");
  const role = str(fd, "role");
  const base = str(fd, "shareBase") === "center" ? "center" : "students";
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Ism-familiyani kiriting";
  if (!isRole(role)) fieldErrors.role = "Lavozimni tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (session.staffId === id && role !== "owner") return { error: "O‘zingizni rahbarlikdan olib bo‘lmaydi" };

  await connectDB();
  const res = await Staff.updateOne({ _id: id }, { $set: { name, role, shareBase: base } });
  if (!res.matchedCount) return { error: "Xodim topilmadi" };
  // O'qituvchi bo'lmay qolsa — kurslardagi «kurs o'qituvchisi» belgisi olib tashlanadi
  if (role !== "teacher") await clearCourseTeacher(id);
  await logActivity(session, "staff.edit", `Xodim ma’lumotlari: ${name} (${ROLE_LABEL[role as Role]})`);
  refresh();
  return { ok: true, message: "Saqlandi", nonce: Date.now() };
}

/** Oylik foizi: tanlangan oydan boshlab (o'tgan oylar hisobi o'zgarmaydi). */
export async function setStaffPercent(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id)) return { error: "Xodim topilmadi" };
  const percent = parsePercent(str(fd, "percent"));
  const from = str(fd, "from");
  const fieldErrors: Record<string, string> = {};
  if (percent === null) fieldErrors.percent = "0 dan 100 gacha son kiriting";
  if (!isValidMonth(from)) fieldErrors.from = "Qaysi oydan boshlab — tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  const staff = await getStaffById(id);
  if (!staff) return { error: "Xodim topilmadi" };
  await Staff.updateOne({ _id: id }, { $set: { shareHistory: applyPercentFrom(shareHistoryOf(staff), from, percent!) } });
  await logActivity(session, "staff.percent", `${staff.name}: oylik foizi ${monthLabel(from)} dan ${percent}%`);
  refresh();
  return { ok: true, message: `${monthLabel(from)} oyidan boshlab ${percent}%`, nonce: Date.now() };
}

/** Belgilangan oylik (administrator): tanlangan oydan boshlab har oy shu summa (o'tgan oylar hisobi o'zgarmaydi). */
export async function setStaffSalary(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id)) return { error: "Xodim topilmadi" };
  const raw = str(fd, "salary");
  const amount = raw ? parseAmount(raw) : null;
  const from = str(fd, "from");
  const fieldErrors: Record<string, string> = {};
  if (amount === null || amount < 0 || amount > MAX_SALARY) fieldErrors.salary = "Oylik summasini kiriting";
  if (!isValidMonth(from)) fieldErrors.from = "Qaysi oydan boshlab — tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  const staff = await getStaffById(id);
  if (!staff) return { error: "Xodim topilmadi" };
  await Staff.updateOne({ _id: id }, { $set: { salaryHistory: applyAmountFrom(salaryHistoryOf(staff), from, amount!) } });
  await logActivity(session, "staff.salary", `${staff.name}: oylik ${monthLabel(from)} dan ${formatMoney(amount!)}`);
  refresh();
  return { ok: true, message: `${monthLabel(from)} oyidan boshlab ${formatMoney(amount!)}`, nonce: Date.now() };
}

/**
 * Kirish holati: "disable" — tizimga kira olmaydi (sessiyalari darhol bekor); "enable" — qaytadan;
 * "reset" — parol o'chiriladi, xodim qayta SMS kod bilan parol yaratadi.
 */
export async function setStaffAccess(id: string, action: "disable" | "enable" | "reset"): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id) || !["disable", "enable", "reset"].includes(action)) return;
  if (session.staffId === id) return; // o'zini o'chirib qo'ymasin
  await connectDB();
  const staff = await getStaffById(id);
  if (!staff) return;
  if (action === "disable") await Staff.updateOne({ _id: id }, { $set: { status: "disabled" } });
  if (action === "enable") await Staff.updateOne({ _id: id }, { $set: { status: staff.passwordHash ? "active" : "invited" } });
  if (action === "reset") await Staff.updateOne({ _id: id }, { $set: { status: "invited", passwordHash: null } });
  const verb = action === "disable" ? "kirishi o‘chirildi" : action === "enable" ? "kirishi yoqildi" : "paroli bekor qilindi";
  await logActivity(session, "staff.access", `${staff.name}: ${verb}`);
  refresh();
}

/** Hali ro'yxatdan o'tmagan (adashib qo'shilgan) xodimni o'chirish. O'quvchilari biriktirilmagan holatga o'tadi. */
export async function deleteStaff(id: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id) || session.staffId === id) return;
  await connectDB();
  const staff = await getStaffById(id);
  if (!staff || staff.status !== "invited" || staff.activatedAt) return;
  if (await Salary.exists({ staff: id })) return; // oylik yozuvlari bor — faqat o'chirib qo'yish mumkin
  await Student.updateMany({ teacher: id }, { $set: { teacher: null } });
  await clearCourseTeacher(id);
  await Staff.deleteOne({ _id: id });
  await logActivity(session, "staff.delete", `Ro‘yxatdan o‘chirildi: ${staff.name}`);
  redirect("/staff");
}

/**
 * Eski (bitta o'qituvchi uchun yuritilgan) ulush foizi va oylik/avans yozuvlarini xodimga o'tkazish.
 * Xodimda foiz tarixi bo'lmasa — eski foiz tarixi unga ko'chadi.
 */
export async function assignLegacyPay(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  const id = str(fd, "staffId");
  if (!isId(id)) return { fieldErrors: { staffId: "Xodimni tanlang" } };
  await connectDB();
  const staff = await getStaffById(id);
  if (!staff) return { fieldErrors: { staffId: "Xodim topilmadi" } };
  const settings = await getSettings({ fresh: true });
  const moved = await Salary.updateMany({ staff: null }, { $set: { staff: id } });
  if (!shareHistoryOf(staff).length && settings.shareHistory.length) {
    await Staff.updateOne({ _id: id }, { $set: { shareHistory: settings.shareHistory } });
  }
  await updateSettings({ $set: { legacyPayStaff: id } });
  await logActivity(session, "staff.legacy", `Avvalgi oylik hisobi ${staff.name}ga o‘tkazildi (${moved.modifiedCount} ta yozuv)`);
  refresh();
  return { ok: true, message: `${staff.name}ga ${moved.modifiedCount} ta oylik/avans yozuvi va ulush foizi o‘tkazildi`, nonce: Date.now() };
}

// ---------- Oylik va avanslar ----------

export async function addSalary(staffId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  if (!isId(staffId)) return { error: "Xodim topilmadi" };
  const kind = str(fd, "kind") === "avans" ? "avans" : "oylik";
  const amount = parseAmount(str(fd, "amount"));
  const dateIso = str(fd, "date");
  const date = isoToDate(dateIso);
  const month = str(fd, "month");
  const note = str(fd, "note", 300);

  const fieldErrors: Record<string, string> = {};
  if (amount === null || amount <= 0) fieldErrors.amount = "Summani kiriting";
  else if (amount > 1_000_000_000) fieldErrors.amount = "Summa juda katta — tekshirib ko‘ring";
  if (!date) fieldErrors.date = "Sanani tanlang";
  else if (dateIso > todayISO()) fieldErrors.date = "Kelajakdagi sana tanlab bo‘lmaydi";
  if (!isValidMonth(month)) fieldErrors.month = "Qaysi oy uchun — tanlang";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  const staff = await getStaffById(staffId);
  if (!staff) return { error: "Xodim topilmadi" };
  await Salary.create({ staff: staffId, kind, amount: amount!, date: date!, month, note, createdByStaff: session.staffId });
  await logActivity(session, "salary.add", `${staff.name}ga ${kind === "oylik" ? "oylik" : "avans"} ${formatMoney(amount!)} (${monthLabel(month)} hisobidan)`);
  refresh();
  return {
    ok: true,
    message: `${kind === "oylik" ? "Oylik" : "Avans"} ${formatMoney(amount!)} — ${monthLabel(month)} hisobidan ayirildi`,
    nonce: Date.now(),
  };
}

export async function deleteSalary(id: string): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  const removed = await Salary.findByIdAndDelete(id).lean();
  if (removed) {
    const staff = removed.staff ? await getStaffById(String(removed.staff)) : null;
    await logActivity(session, "salary.delete", `O‘chirildi: ${staff?.name ?? "xodim"} — ${removed.kind === "oylik" ? "oylik" : "avans"} ${formatMoney(removed.amount)} (${monthLabel(removed.month)})`);
  }
  refresh();
}
