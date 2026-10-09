import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "./lib/session";

// Tezkor tekshiruv: kirmagan foydalanuvchini /login ga yo'naltiradi.
// Asosiy tekshiruv baribir har bir sahifa va server action ichida (lib/auth.ts) qilinadi.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = await isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return loggedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // /api/cron o'z kaliti (CRON_SECRET) bilan himoyalangan
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
