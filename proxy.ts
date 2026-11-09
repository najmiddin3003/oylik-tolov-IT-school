import { NextResponse, type NextRequest } from "next/server";
import { PERF_HEADER, perfRoute } from "./lib/perf-rules";
import { canAccess, homeFor, readSessionToken, SESSION_COOKIE } from "./lib/session";

// Tezkor tekshiruv: kirmagan foydalanuvchini /login ga, har bir rolni faqat o'ziga ruxsat etilgan sahifalarga yo'naltiradi.
// To'liq tekshiruv (parol almashganmi, xodim o'chirilganmi va h.k.) baribir har bir sahifa va server action ichida (lib/auth.ts).
const PUBLIC = new Set(["/login", "/register"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/logout") return NextResponse.next();

  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (PUBLIC.has(pathname)) {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : NextResponse.next();
  }
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }
  // Tezlik o'lchovi: sahifa so'roviga sahifa turini qo'yamiz (lib/perf.ts o'qiydi). Prefetch va server action
  // so'rovlari o'lchanmaydi; brauzer yuborgan shu nomli sarlavha har doim olib tashlanadi.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(PERF_HEADER);
  const route = perfRoute(pathname);
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.has("next-router-segment-prefetch");
  if (route && request.method === "GET" && !prefetch && !request.headers.has("next-action")) requestHeaders.set(PERF_HEADER, route);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // /api/cron o'z kaliti (CRON_SECRET) bilan himoyalangan; /api/ping — ochiq (serverni uyg'oq ushlab turish, ma'lumot bermaydi)
  matcher: ["/((?!api/cron|api/ping|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
