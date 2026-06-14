import { getConnector, isAnyDMSConfigured } from "@/lib/dms";

export const dynamic = "force-dynamic";

/**
 * GET /api/dms/status
 * Gibt zurück, ob ein DMS konfiguriert ist und welcher Provider aktiv ist.
 */
export async function GET() {
  const configured = isAnyDMSConfigured();
  if (!configured) {
    return Response.json({ configured: false });
  }

  const connector = await getConnector();
  return Response.json({
    configured: true,
    provider: connector?.name ?? "unknown",
    ready: connector?.isConfigured() ?? false,
  });
}
