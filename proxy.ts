import { NextResponse, type NextRequest } from "next/server";
import { adminCanAccess, homeFor, readSessionToken, SESSION_COOKIE } from "./lib/session";

// Tezkor tekshiruv: kirmagan foydalanuvchini /login ga, administratorni faqat to'lovlar sahifasiga yo'naltiradi.
// To'liq tekshiruv (parol almashganmi va h.k.) baribir har bir sahifa va server action ichida (lib/auth.ts).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/logout") return NextResponse.next();

  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : NextResponse.next();
  }
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.role === "admin" && !adminCanAccess(pathname)) {
    return NextResponse.redirect(new URL("/payments", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // /api/cron o'z kaliti (CRON_SECRET) bilan himoyalangan
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
