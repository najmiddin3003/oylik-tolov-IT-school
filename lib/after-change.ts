import "server-only";
// Ma'lumot o'zgargach (server action oxirida) chaqiriladi. Ochilgan sahifalar brauzerda 30 soniya saqlanadi
// (next.config.ts → staleTimes.dynamic) — o'zgarish boshqa sahifalarda ham darhol ko'rinishi uchun brauzer keshi tozalanadi.
// Next: server action ichida cookies.set brauzer keshini bekor qiladi; serverdagi keshga (sahifa qobiqlari) tegmaydi.
import { refresh } from "next/cache";
import { cookies } from "next/headers";

/** Brauzer keshini bekor qilish uchun cookie (qiymati ahamiyatsiz, faqat o'rnatilishi kerak) */
const CHANGED_COOKIE = "tt_changed";

/** Joriy sahifani yangilaydi va brauzerdagi boshqa (oldin ochilgan) sahifalar keshini tozalaydi. */
export async function dataChanged(): Promise<void> {
  refresh();
  (await cookies()).set(CHANGED_COOKIE, String(Date.now()), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60,
  });
}
