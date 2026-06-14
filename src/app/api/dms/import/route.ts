import { NextRequest } from "next/server";
import { getConnector } from "@/lib/dms";
import { getSessionUser } from "@/lib/auth/server";
import { engineContext } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/dms/import
 * Importiert ein DMS-Dokument in das Brain.
 * Body: { documentId: string }
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const connector = await getConnector();
  if (!connector || !connector.isConfigured()) {
    return Response.json({ error: "dms_not_configured" }, { status: 503 });
  }

  const { documentId } = (await req.json()) as { documentId?: string };
  if (!documentId) {
    return Response.json({ error: "document_id_required" }, { status: 400 });
  }

  const ctx = await engineContext();
  if (!ctx) return Response.json({ error: "engine_context_failed" }, { status: 500 });

  try {
    const doc = await connector.getDocument(documentId);
    if (!doc) {
      return Response.json({ error: "document_not_found" }, { status: 404 });
    }

    const result = await connector.importToBrain(doc, ctx.brainId, ctx.headers);
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dms import] error:", msg);
    return Response.json({ error: "import_failed", message: msg }, { status: 500 });
  }
}
