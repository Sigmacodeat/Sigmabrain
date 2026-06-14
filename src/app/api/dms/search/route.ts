import { NextRequest } from "next/server";
import { getConnector } from "@/lib/dms";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dms/search?q=Vertrag&limit=20
 * Sucht im konfigurierten DMS.
 */
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const connector = await getConnector();
  if (!connector || !connector.isConfigured()) {
    return Response.json({ error: "dms_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
  const folderId = searchParams.get("folderId") ?? undefined;

  try {
    const results = await connector.search(query, { limit, folderId });
    return Response.json(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dms search] error:", msg);
    return Response.json({ error: "search_failed", message: msg }, { status: 500 });
  }
}
