import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/store";
import { verifyTOTP } from "@/lib/totp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/2fa/verify
 * Verifiziert einen TOTP-Code gegen das server-seitig pending Secret
 * und aktiviert 2FA für den Nutzer.
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { token } = (await req.json()) as { token?: string };
  if (!token) {
    return Response.json({ error: "token_required" }, { status: 400 });
  }

  const store = getStore();
  const user = await store.getById(me.id);
  if (!user) {
    return Response.json({ error: "user_not_found" }, { status: 404 });
  }

  const pendingSecret = user.pendingTwoFactorSecret;
  const pendingExpires = user.pendingTwoFactorExpiresAt;

  if (!pendingSecret) {
    return Response.json({ error: "setup_required" }, { status: 400 });
  }

  if (pendingExpires && new Date(pendingExpires) < new Date()) {
    // Clear expired pending secret
    await store.update(me.id, { pendingTwoFactorSecret: null, pendingTwoFactorExpiresAt: null });
    return Response.json({ error: "setup_expired" }, { status: 410 });
  }

  const valid = await verifyTOTP(token, pendingSecret);
  if (!valid) {
    return Response.json({ error: "invalid_token" }, { status: 400 });
  }

  // Promote pending to active and clear pending fields
  await store.update(me.id, {
    twoFactorSecret: pendingSecret,
    twoFactorEnabled: true,
    pendingTwoFactorSecret: null,
    pendingTwoFactorExpiresAt: null,
  });

  return Response.json({ ok: true, enabled: true });
}
