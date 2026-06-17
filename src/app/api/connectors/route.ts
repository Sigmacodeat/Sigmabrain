import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireAuthAction } from "@/lib/engine";

/** Proxy: list configured and supported ingestion connectors.
 *  Connector status is install-global (not per-tenant) — admin-only,
 *  matching the sync/toggle actions. */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("connector.read");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/connectors`, { headers: ctx.headers });
    if (!upstream.ok) {
      return Response.json({ error: `Engine returned ${upstream.status}`, connectors: [] }, { status: upstream.status });
    }
    return Response.json(await upstream.json());
  } catch (err) {
    console.error("[connectors] list failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar", connectors: [] }, { status: 503 });
  }
}
