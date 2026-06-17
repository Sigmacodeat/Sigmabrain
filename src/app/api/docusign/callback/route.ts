import { NextRequest } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/docusign/callback?code=
 * Tauscht den OAuth Authorization Code gegen ein Access Token.
 * Speichert das Token server-seitig im User-Store (encrypted-at-rest in production).
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("settings.write");
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return Response.json({ error: "oauth_denied", detail: error }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: "code_required" }, { status: 400 });
  }

  const ik = process.env.DOCUSIGN_INTEGRATION_KEY;
  const secret = process.env.DOCUSIGN_SECRET_KEY;
  if (!ik || !secret) {
    return Response.json({ error: "docusign_not_configured" }, { status: 503 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://sigmabrain.com"}/api/docusign/callback`;
  const tokenRes = await fetch("https://account-d.docusign.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: ik,
      client_secret: secret,
      redirect_uri: redirectUri,
    }),
  });
  const data = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    account_id?: string;
    base_uri?: string;
  };
  if (!tokenRes.ok) {
    return Response.json({ error: data.error || "token_exchange_failed" }, { status: 400 });
  }

  if (!data.access_token || !data.expires_in) {
    return Response.json({ error: "incomplete_token_response" }, { status: 502 });
  }

  // Persist token server-side (in production: encrypt at rest)
  const store = getStore();
  await store.update(ctx.user.id, {
    docusignAccessToken: data.access_token,
    docusignRefreshToken: data.refresh_token ?? null,
    docusignTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  });

  return Response.json({ ok: true, connected: true });
}
