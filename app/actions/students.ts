"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { requireOwner, requireRole } from "@/lib/auth";
import { courseTeacherResolver } from "@/lib/course-teacher";
import { cleanCourseName, courseTeacher, sameCourse, teacherOnCourseChange } from "@/lib/courses";
import { isId } from "@/lib/ids";
import { connectDB } from "@/lib/db";
import { applyFeeFrom, changesAfter } from "@/lib/fees";
import { feeHistoryOf, studentFee, type StudentLean } from "@/lib/ledger";
import { Payment, Staff, Student } from "@/lib/models";
import { parseAmount } from "@/lib/normalize";
import { formatUzPhone, normalizeUzPhone } from "@/lib/phone";
import { parseLessons } from "@/lib/schedule";
import { nextStudentSeq } from "@/lib/seq";
import { getSettings, standardFee } from "@/lib/settings";
import { currentMonth, formatMoney, isoToDate, isValidMonth, monthOfDate } from "@/lib/time";
import type { FormState } from "./types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** O'zbekiston raqami bo'lsa — bir xil ko'rinishda ("+998 90 123 45 67"), aks holda yozilganicha. */
function cleanPhone(raw: string): string {
  const uz = normalizeUzPhone(raw);
  return uz ? formatUzPhone(uz) : raw.slice(0, 40);
}

export async function saveStudent(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner({ fresh: true });
  if (id !== null && !isId(id)) return { error: "O‘quvchi topilmadi" };

  const fullName = str(formData, "fullName").replace(/\s+/g, " ");
  const phone = cleanPhone(str(formData, "phone"));
  const parentPhone = cleanPhone(str(formData, "parentPhone"));
  const group = cleanCourseName(str(formData, "group"));
  const feeRaw = str(formData, "monthlyFee");
  const feeFromRaw = str(formData, "feeFrom");
  const startRaw = str(formData, "startDate");
  const note = str(formData, "note").slice(0, 1000);
  const active = str(formData, "active") !== "false";
  // Jadval maydoni yo'q bo'lsa (masalan, eski ochiq sahifadan yuborilgan forma) — mavjud jadvalga tegilmaydi
  const hasSchedule = formData.has("schedule");
  // O'qituvchi: forma maydoni bo'lsa o'qiladi ("" — biriktirilmagan)
  const hasTeacher = formData.has("teacher");
  const teacherRaw = str(formData, "teacher");
  const schedule = parseLessons(str(formData, "schedule"));

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 3) fieldErrors.fullName = "Ism-familiyani to‘liq kiriting";
  if (fullName.length > 120) fieldErrors.fullName = "Juda uzun";
  for (const [key, value] of [["phone", phone], ["parentPhone", parentPhone]] as const) {
    if (value && value.replace(/\D/g, "").length < 9) fieldErrors[key] = "Telefon raqam noto‘g‘ri";
  }
  const monthlyFee = parseAmount(feeRaw);
  if (monthlyFee === null || monthlyFee < 0) fieldErrors.monthlyFee = "Oylik to‘lov summasini kiriting";
  const startDate = isoToDate(startRaw);
  if (!startDate) fieldErrors.startDate = "Boshlagan sanani tanlang";
  const feeFrom = isValidMonth(feeFromRaw) ? feeFromRaw : currentMonth();
  if ("error" in schedule) fieldErrors.schedule = schedule.error;
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const lessons = "lessons" in schedule ? schedule.lessons : [];

  await connectDB();
  let teacher: string | null = null;
  if (hasTeacher && teacherRaw) {
    if (!isId(teacherRaw) || !(await Staff.exists({ _id: teacherRaw, role: "teacher" }))) return { fieldErrors: { teacher: "O‘qituvchi topilmadi" } };
    teacher = teacherRaw;
  }
  // O'qituvchi tanlanmagan bo'lsa — kurs o'qituvchisi (Sozlamalar → Kurslar) biriktiriladi
  const setTeacher = hasTeacher || !id;
  if (setTeacher && !teacher && group) teacher = (await courseTeacherResolver())(group);
  const base = {
    fullName,
    phone,
    parentPhone,
    group,
    startDate: startDate!,
    note,
    active,
    ...(hasSchedule ? { lessons } : {}),
    ...(setTeacher ? { teacher } : {}),
  };

  let savedId: string;
  if (id) {
    const existing = await Student.findById(id, { monthlyFee: 1, feeHistory: 1 }).lean<StudentLean>();
    if (!existing) return { error: "O‘quvchi topilmadi" };
    // Narx o'zgargan bo'lsa — tanlangan oydan boshlab (o'tgan oylar hisobi o'zgarmaydi)
    let fees = { monthlyFee: existing.monthlyFee, feeHistory: feeHistoryOf(existing) };
    if (monthlyFee !== studentFee(existing, feeFrom)) {
      fees = applyFeeFrom({ ...fees, startMonth: monthOfDate(startDate!) }, feeFrom, monthlyFee!);
    }
    await Student.updateOne({ _id: id }, { $set: { ...base, ...fees } }, { runValidators: true });
    savedId = id;
    await logActivity(session, "student.edit", `O‘quvchi ma’lumotlari o‘zgartirildi: ${fullName}`);
  } else {
    // Standart narx bilan qo'shilsa — rejalashtirilgan o'zgarishlar (masalan, "dekabrdan 350 000") unga ham qo'llanadi
    const settings = await getSettings();
    const startMonth = monthOfDate(startDate!);
    const feeHistory = standardFee(settings, startMonth) === monthlyFee ? changesAfter(settings.feeSchedule, startMonth) : [];
    const created = await Student.create({ ...base, monthlyFee: monthlyFee!, feeHistory, seq: await nextStudentSeq() });
    savedId = String(created._id);
    await logActivity(session, "student.add", `Yangi o‘quvchi: ${fullName}${group ? ` (${group})` : ""}, oylik ${formatMoney(monthlyFee!)}`);
  }
  redirect(`/students/${savedId}`);
}

/** O'quvchini va uning barcha to'lovlarini (arxivdagilari bilan) o'chiradi. */
export async function deleteStudent(id: string, redirectTo: string | null): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!isId(id)) return;
  await connectDB();
  const removed = await Student.findByIdAndDelete(id).lean();
  const payments = await Payment.deleteMany({ student: id });
  if (removed) await logActivity(session, "student.delete", `O‘chirildi: ${removed.fullName} (${payments.deletedCount} ta to‘lovi bilan)`);
  // Faqat o'quvchilar ro'yxatiga qaytariladi (boshqa manzilga yo'naltirib bo'lmaydi)
  if (redirectTo === "/students") redirect("/students");
  refresh();
}

/** Tanlangan o'quvchilar ustida amal: faol/nofaol qilish yoki o'chirish (to'lovlari bilan). */
export async function bulkStudents(action: "activate" | "deactivate" | "delete", ids: string[]): Promise<void> {
  const session = await requireOwner({ fresh: true });
  if (!["activate", "deactivate", "delete"].includes(action) || !Array.isArray(ids)) return;
  const valid = ids.filter(isId).slice(0, 1000);
  if (!valid.length) return;
  await connectDB();
  if (action === "delete") {
    await Payment.deleteMany({ student: { $in: valid } });
    await Student.deleteMany({ _id: { $in: valid } });
  } else {
    await Student.updateMany({ _id: { $in: valid } }, { $set: { active: action === "activate" } });
  }
  const verb = action === "delete" ? "o‘chirildi (to‘lovlari bilan)" : action === "activate" ? "faol qilindi" : "nofaol qilindi";
  await logActivity(session, "student.bulk", `${valid.length} ta o‘quvchi ${verb}`);
  refresh();
}

/** Tanlangan o'quvchilarga bir xil dars jadvali qo'yish (bo'sh jadval — tozalash). */
export async function setLessonsBulk(ids: string[], schedule: string): Promise<{ error?: string; count?: number }> {
  const session = await requireOwner({ fresh: true });
  if (!Array.isArray(ids) || typeof schedule !== "string") return { error: "Noto‘g‘ri so‘rov" };
  const valid = ids.filter(isId).slice(0, 1000);
  if (!valid.length) return { error: "O‘quvchi tanlanmagan" };
  const parsed = parseLessons(schedule);
  if ("error" in parsed) return { error: parsed.error };
  await connectDB();
  const res = await Student.updateMany({ _id: { $in: valid } }, { $set: { lessons: parsed.lessons } }, { runValidators: true });
  await logActivity(session, "student.lessons", `${res.matchedCount} ta o‘quvchiga dars jadvali ${parsed.lessons.length ? "qo‘yildi" : "tozalandi"}`);
  refresh();
  return { count: res.matchedCount };
}

/** Tanlangan o'quvchilarga o'qituvchi biriktirish ("" — biriktirilmagan holatga qaytarish). */
export async function setTeacherBulk(ids: string[], teacherId: string): Promise<{ error?: string; count?: number }> {
  const session = await requireOwner({ fresh: true });
  if (!Array.isArray(ids) || typeof teacherId !== "string") return { error: "Noto‘g‘ri so‘rov" };
  const valid = ids.filter(isId).slice(0, 1000);
  if (!valid.length) return { error: "O‘quvchi tanlanmagan" };
  await connectDB();
  if (teacherId && (!isId(teacherId) || !(await Staff.exists({ _id: teacherId, role: "teacher" })))) return { error: "O‘qituvchi topilmadi" };
  const res = await Student.updateMany({ _id: { $in: valid } }, { $set: { teacher: teacherId || null } });
  const teacher = teacherId ? await Staff.findById(teacherId, { name: 1 }).lean() : null;
  await logActivity(session, "student.teacher", `${res.matchedCount} ta o‘quvchi ${teacher ? `${teacher.name}ga biriktirildi` : "o‘qituvchisiz qoldirildi"}`);
  refresh();
  return { count: res.matchedCount };
}

/**
 * Tanlangan o'quvchilarga kurs belgilash ("" — kurssiz). Kursning o'qituvchisi bo'lsa, o'qituvchisi yo'q (yoki avvalgi
 * kursining o'qituvchisidagi) o'quvchilar unga biriktiriladi; boshqa o'qituvchiga biriktirilganlar o'zgarmaydi.
 */
export async function setCourseBulk(ids: string[], course: string): Promise<{ error?: string; count?: number; assigned?: number }> {
  const session = await requireOwner({ fresh: true });
  if (!Array.isArray(ids) || typeof course !== "string") return { error: "Noto‘g‘ri so‘rov" };
  const valid = ids.filter(isId).slice(0, 1000);
  if (!valid.length) return { error: "O‘quvchi tanlanmagan" };
  await connectDB();
  const settings = await getSettings({ fresh: true });
  // Faqat ro'yxatdagi kurslar: yangi kurs Sozlamalar → Kurslar bo'limida qo'shiladi
  const listed = course ? settings.courses.find((c) => sameCourse(c.name, course)) : undefined;
  if (course && !listed) return { error: "Kurs topilmadi — Sozlamalar → Kurslar bo‘limida qo‘shing" };
  const group = listed?.name ?? "";
  const newTeacher = (await courseTeacherResolver())(group);

  const students = await Student.find({ _id: { $in: valid } }, { group: 1, teacher: 1 }).lean<{ _id: unknown; group?: string | null; teacher?: unknown }[]>();
  let assigned = 0;
  const ops = students.map((s) => {
    const current = s.teacher ? String(s.teacher) : null;
    const teacher = teacherOnCourseChange(current, courseTeacher(settings.courses, s.group), newTeacher);
    if (teacher && teacher !== current) assigned++;
    return { updateOne: { filter: { _id: s._id }, update: { $set: { group, teacher } } } };
  });
  if (ops.length) await Student.bulkWrite(ops as Parameters<typeof Student.bulkWrite>[0]);
  const teacherName = newTeacher && assigned ? ((await Staff.findById(newTeacher, { name: 1 }).lean())?.name ?? "") : "";
  await logActivity(
    session,
    "student.course",
    `${ops.length} ta o‘quvchi ${group ? `«${group}» kursiga o‘tkazildi` : "kurssiz qoldirildi"}${assigned ? `, ${assigned} tasi ${teacherName || "kurs o‘qituvchisi"}ga biriktirildi` : ""}`,
  );
  refresh();
  return { count: ops.length, assigned };
}

/**
 * Tezkor qo'shish oynasi (administrator va rahbar, «To'lovlar» sahifasida): ism, telefon, kurs, oylik to'lov,
 * boshlagan sana, kerak bo'lsa o'qituvchi va dars jadvali. Saqlangach oyna yopiladi (sahifadan chiqilmaydi).
 */
export async function addStudentQuick(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["owner", "admin"], { fresh: true });
  const fullName = str(formData, "fullName").replace(/\s+/g, " ");
  const phone = cleanPhone(str(formData, "phone"));
  const group = cleanCourseName(str(formData, "group"));
  const monthlyFee = parseAmount(str(formData, "monthlyFee"));
  const startDate = isoToDate(str(formData, "startDate"));
  const teacherRaw = str(formData, "teacher");
  const schedule = parseLessons(str(formData, "schedule"));

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 3) fieldErrors.fullName = "Ism-familiyani to‘liq kiriting";
  else if (fullName.length > 120) fieldErrors.fullName = "Juda uzun";
  if (phone && phone.replace(/\D/g, "").length < 9) fieldErrors.phone = "Telefon raqam noto‘g‘ri";
  if (!group) fieldErrors.group = "Kursni tanlang";
  if (monthlyFee === null || monthlyFee <= 0) fieldErrors.monthlyFee = "Oylik to‘lov summasini kiriting";
  else if (monthlyFee > 100_000_000) fieldErrors.monthlyFee = "Summa juda katta — tekshirib ko‘ring";
  if (!startDate) fieldErrors.startDate = "Boshlagan sanani tanlang";
  if ("error" in schedule) fieldErrors.schedule = schedule.error;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await connectDB();
  let teacher: string | null = null;
  if (teacherRaw) {
    if (!isId(teacherRaw) || !(await Staff.exists({ _id: teacherRaw, role: "teacher", status: { $ne: "disabled" } }))) {
      return { fieldErrors: { teacher: "O‘qituvchi topilmadi" } };
    }
    teacher = teacherRaw;
  }
  // O'qituvchi tanlanmagan bo'lsa — kurs o'qituvchisi biriktiriladi
  if (!teacher) teacher = (await courseTeacherResolver())(group);
  // Bir xil ismli faol o'quvchi bo'lsa — ogohlantirish (ikki marta qo'shilmasin)
  const dup = await Student.exists({ fullName: new RegExp(`^${fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), active: true });
  if (dup && str(formData, "confirmDuplicate") !== "1") {
    return { error: `«${fullName}» ismli faol o‘quvchi allaqachon bor. Baribir qo‘shish uchun yana bir marta «Saqlash»ni bosing.`, fieldErrors: { confirmDuplicate: "1" } };
  }
  const settings = await getSettings();
  const startMonth = monthOfDate(startDate!);
  const feeHistory = standardFee(settings, startMonth) === monthlyFee ? changesAfter(settings.feeSchedule, startMonth) : [];
  await Student.create({
    fullName,
    phone,
    parentPhone: "",
    group,
    monthlyFee: monthlyFee!,
    feeHistory,
    startDate: startDate!,
    active: true,
    note: "",
    lessons: "lessons" in schedule ? schedule.lessons : [],
    teacher,
    seq: await nextStudentSeq(),
  });
  await logActivity(session, "student.add", `Yangi o‘quvchi: ${fullName} (${group}), oylik ${formatMoney(monthlyFee!)}`);
  refresh();
  return { ok: true, message: `${fullName} qo‘shildi (${group}, oylik ${formatMoney(monthlyFee!)})`, nonce: Date.now() };
}
