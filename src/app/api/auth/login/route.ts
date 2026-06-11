import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { getStore, toPublic } from "@/lib/auth/store";
import { signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { hit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  // Brute-force protection: per-IP and (below, post-parse) per-email windows.
  const ip = clientIp(req.headers);
  const ipLimit = hit(`login:ip:${ip}`, 20, 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const emailLimit = hit(`login:email:${email}`, 5, 15 * 60_000);
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } },
    );
  }

  const user = await getStore().getByEmail(email);

  // Same error for unknown email and wrong password — no account enumeration.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await signSession({ uid: user.id, email: user.email, role: user.role });
  const res = NextResponse.json({ user: toPublic(user) });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return res;
}
