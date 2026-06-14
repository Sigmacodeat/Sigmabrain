import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/store";
import { isConfigured } from "@/lib/docusign";

export const dynamic = "force-dynamic";

/**
 * GET /api/docusign/status
 * Prüft, ob der aktuelle User eine Docusign-Verbindung hat.
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const configured = isConfigured();
  if (!configured) {
    return Response.json({ configured: false, connected: false, reason: "not_configured" });
  }

  const user = await getStore().getById(me.id);
  const connected = Boolean(user?.docusignAccessToken && user?.docusignTokenExpiresAt);
  const expired = connected && user?.docusignTokenExpiresAt
    ? new Date(user.docusignTokenExpiresAt) < new Date()
    : false;

  return Response.json({
    configured: true,
    connected,
    expired,
    expiresAt: user?.docusignTokenExpiresAt ?? null,
  });
}
