// O'qishni tugatish (sof funksiyalar — server, brauzer va testlarda).
//
// «O'qishni tugatgan sana» — shu kundan boshlab o'quvchi o'qimaydi:
//  - davomat shu kundan boshlab olinmaydi;
//  - to'lov shu kun tushgan oydan keyin hisoblanmaydi. Oy boshida (1-sanada) tugatsa — o'sha oy ham hisoblanmaydi:
//    20-noyabrda tugatsa — noyabr oxirgi to'lanadigan oy, 1-dekabrda tugatsa ham — noyabr;
//  - undan oldingi to'lanmagan oylar qarz bo'lib qoladi.
// Sana kelgach o'quvchi «Arxiv» holatiga o'tadi (oldindan, kelgusi sana bilan ham kiritsa bo'ladi).

export type StudentStatus = "active" | "inactive" | "archived";

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Faol",
  inactive: "Nofaol",
  archived: "Arxiv",
};

/** Oxirgi to'lanadigan oy: tugatish sanasidan oldingi kun tushgan oy. "2026-11-20" -> "2026-11", "2026-12-01" -> "2026-11". */
export function lastBilledMonth(endIso: string): string {
  const [y, m, d] = endIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 7);
}

/** Shu oy uchun to'lov hisoblanadimi (tugatish sanasi bo'yicha; boshlanishi alohida tekshiriladi). */
export function billedUntil(month: string, endIso: string | null | undefined): boolean {
  return !endIso || month <= lastBilledMonth(endIso);
}

/** Tugatgan (arxivda): tugatish sanasi kelgan yoki o'tgan. */
export function isArchived(endIso: string | null | undefined, today: string): boolean {
  return Boolean(endIso) && endIso! <= today;
}

/** Shu kuni o'qiydimi (davomat uchun): boshlagan va hali tugatmagan. */
export function studiesOn(date: string, startIso: string, endIso: string | null | undefined): boolean {
  return startIso <= date && (!endIso || date < endIso);
}

/** Holat: tugatish sanasi kelgan bo'lsa — «Arxiv», aks holda «Faol» yoki «Nofaol» (qo'lda belgilangan). */
export function studentStatus(active: boolean | null | undefined, endIso: string | null | undefined, today: string): StudentStatus {
  if (isArchived(endIso, today)) return "archived";
  return active === false ? "inactive" : "active";
}

/** Hozir o'qiyotgan o'quvchi (ro'yxatlar, hisoblagichlar, to'lov formasi): nofaol ham, arxivda ham emas. */
export function isCurrentStudent(s: { active?: boolean | null }, endIso: string | null | undefined, today: string): boolean {
  return studentStatus(s.active, endIso, today) === "active";
}

/**
 * Shu oy uchun to'lashi kerakmi: o'qishni boshlagan va tugatish sanasigacha. Tugatish sanasi bo'lmasa — faqat faol
 * o'quvchi (eski «Nofaol» belgisi hisobni to'xtatadi). Tugatish sanasi bor bo'lsa — «Nofaol»dan qat'i nazar o'sha
 * sanagacha hisoblanadi (to'lanmagan oylar qarz bo'lib qoladi).
 */
export function owesFor(month: string, v: { startMonth: string; active?: boolean | null; endIso: string | null | undefined }): boolean {
  if (month < v.startMonth) return false;
  if (v.endIso) return billedUntil(month, v.endIso);
  return v.active !== false;
}

/** "2026-11-20" + kun */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Tugatish sanasi tekshiruvi: boshlagan kundan keyin va bir yildan uzoq bo'lmagan kelajak. Xato matni yoki null. */
export function endDateError(endIso: string, startIso: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endIso)) return "Sanani tanlang";
  if (endIso <= startIso) return "O‘qishni boshlagan kundan keyingi sana bo‘lishi kerak";
  if (endIso > addDays(today, 366)) return "Bir yildan uzoq sana — tekshirib ko‘ring";
  return null;
}
