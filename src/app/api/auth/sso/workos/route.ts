import { NextRequest } from "next/server";
import { getAuthorizationUrl, isConfigured } from "@/lib/workos";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sso/workos?provider=MicrosoftOAuth&orgId=...
 * Startet den WorkOS SSO-Autorisierungsflow.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return Response.json({ error: "sso_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") as "MicrosoftOAuth" | "GoogleOAuth" | "SAML" | undefined;
  const organizationId = searchParams.get("orgId") || undefined;

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://sigmabrain.com"}/api/auth/sso/callback`;

  // State token to prevent CSRF (simple random string)
  const state = crypto.randomUUID();

  const authUrl = getAuthorizationUrl({
    redirectUri,
    state,
    provider,
    organizationId,
  });

  return Response.json({ authUrl, state });
}
