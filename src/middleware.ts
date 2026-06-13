// Edge middleware: protects /dashboard and /admin.
//
// Referral capture (?ref=) is NOT done here anymore: a persistent
// attribution cookie is not "strictly necessary" under § 25 TTDSG, so it
// requires consent. The RefConsentBanner client component asks and sets
// the 90-day sb_ref cookie only after the visitor agrees.

import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Protected areas ---
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    if (pathname.startsWith("/admin") && session.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, static files and API routes.
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
