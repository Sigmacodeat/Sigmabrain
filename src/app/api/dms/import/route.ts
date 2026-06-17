import { NextRequest } from "next/server";
import { getConnector } from "@/lib/dms";
import { requireEngineContext, recordQuota } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/dms/import
 * Importiert ein DMS-Dokument in das Brain.
 * Body: { documentId: string }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.write", "heavy", "uploads");
  if (ctx instanceof Response) return ctx;

  const connector = await getConnector();
  if (!connector || !connector.isConfigured()) {
    return Response.json({ error: "dms_not_configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!documentId) {
    return Response.json({ error: "document_id_required" }, { status: 400 });
  }

  try {
    const doc = await connector.getDocument(documentId);
    if (!doc) {
      return Response.json({ error: "document_not_found" }, { status: 404 });
    }

    const result = await connector.importToBrain(doc, ctx.brainId, ctx.headers);
    void recordQuota(ctx, "uploads");
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dms import] error:", msg);
    return Response.json({ error: "import_failed", message: msg }, { status: 500 });
  }
}
