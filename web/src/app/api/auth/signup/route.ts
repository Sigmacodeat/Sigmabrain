import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { getStore, buildNewUser, toPublic } from "@/lib/auth/store";
import { signSession, SESSION_COOKIE, SESSION_TTL_SECONDS, REF_COOKIE } from "@/lib/auth/session";
import { hit, clientIp } from "@/lib/auth/rate-limit";
import { signActionToken, bindFragment, VERIFY_TOKEN_TTL_SECONDS } from "@/lib/auth/tokens";
import { sendMail, siteUrl } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Throttle automated account creation per IP.
  const ipLimit = hit(`signup:ip:${clientIp(req.headers)}`, 5, 60 * 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  let body: { email?: string; password?: string; name?: string; locale?: string; industry?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }
  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const store = getStore();
  if (await store.getByEmail(email)) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  // Referral attribution: validate the 90-day ref cookie against a real user.
  let referredBy: string | null = null;
  const refCode = req.cookies.get(REF_COOKIE)?.value;
  if (refCode) {
    const referrer = await store.getByReferralCode(refCode);
    if (referrer && referrer.email !== email) referredBy = refCode; // no self-referrals
  }

  // Industry powers dashboard personalization (vertical example prompts);
  // optional, allowlisted, silently dropped when unknown.
  const INDUSTRIES = new Set(["legal", "tax", "vc", "consulting", "recruiting", "insurance", "medical", "other"]);
  const industry = body.industry && INDUSTRIES.has(body.industry) ? body.industry : null;

  const passwordHash = await hashPassword(password);
  const user = await store.create(
    await buildNewUser({
      email,
      name,
      passwordHash,
      locale: body.locale === "de" ? "de" : "en",
      referredBy,
      industry,
    }),
  );

  // Verification mail — fire-and-forget; signup never fails on mail issues.
  // Without RESEND_API_KEY the mailer prints the link to the server console.
  void (async () => {
    try {
      const verifyToken = await signActionToken(
        { uid: user.id, purpose: "verify", bind: await bindFragment(user.email) },
        VERIFY_TOKEN_TTL_SECONDS,
      );
      const verifyUrl = `${siteUrl()}/api/auth/verify?token=${encodeURIComponent(verifyToken)}`;
      const de = user.locale === "de";
      await sendMail({
        to: user.email,
        subject: de ? "Sigmabrain — E-Mail bestätigen" : "Sigmabrain — confirm your email",
        text: de
          ? `Hallo ${user.name},\n\nwillkommen bei Sigmabrain! Bitte bestätige deine E-Mail-Adresse (Link 48 Stunden gültig):\n${verifyUrl}\n\n— Sigmabrain`
          : `Hi ${user.name},\n\nwelcome to Sigmabrain! Please confirm your email address (link valid for 48 hours):\n${verifyUrl}\n\n— Sigmabrain`,
      });
    } catch (err) {
      console.error(`[signup] verification mail failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  const token = await signSession({ uid: user.id, email: user.email, role: user.role });
  const res = NextResponse.json({ user: toPublic(user) }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  res.cookies.delete(REF_COOKIE);
  return res;
}
