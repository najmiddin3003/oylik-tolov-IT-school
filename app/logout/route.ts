import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor, SESSION_COOKIE } from "@/lib/session";

// Faqat eskirgan sessiyani (masalan, parol almashgandan keyin) tozalaydi. Amaldagi sessiya bu yerda
// o'chirilmaydi — aks holda boshqa saytdagi havola orqali chiqarib yuborish mumkin bo'lardi.
// Oddiy "Chiqish" — menyudagi tugma (POST server action).
export async function GET() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
