import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authenticateWithCode } from "@/lib/workos";
import { getStore, buildNewUser } from "@/lib/auth/store";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sso/callback?code=...
 * Empfängt den WorkOS-Callback, authentifiziert den Nutzer
 * und erstellt eine SigmaBrain-Session.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return Response.json({ error: "sso_denied", detail: error }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: "code_required" }, { status: 400 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://sigmabrain.com"}/api/auth/sso/callback`;

  try {
    const auth = await authenticateWithCode(code, redirectUri);
    const workosUser = auth.user;

    const store = getStore();
    let user = await store.getByEmail(workosUser.email);

    if (!user) {
      // Auto-provision: create user from WorkOS profile
      const newUser = await buildNewUser({
        email: workosUser.email,
        name: `${workosUser.first_name} ${workosUser.last_name}`.trim() || workosUser.email,
        passwordHash: "", // SSO users have no local password
        locale: "de",
      });
      // Mark as SSO user — mutate after buildNewUser to avoid typing issues
      newUser.workosUserId = workosUser.id;
      newUser.ssoProvider = "workos";
      newUser.emailVerifiedAt = workosUser.email_verified ? new Date().toISOString() : null;
      user = await store.create(newUser);
    }

    // Update WorkOS link if missing
    if (!user.workosUserId) {
      await store.update(user.id, {
        workosUserId: workosUser.id,
        ssoProvider: "workos",
        emailVerifiedAt: workosUser.email_verified ? new Date().toISOString() : user.emailVerifiedAt,
      });
    }

    // Create SigmaBrain session
    const session = await createSession(user.id, user.email, user.role);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, session.token, session.cookieOptions);

    // Redirect to dashboard
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "https://sigmabrain.com"}/dashboard`, 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sso callback] error:", msg);
    return Response.json({ error: "sso_failed", message: msg }, { status: 500 });
  }
}
