import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const ctx = await requireEngineContext(req, "brain.read", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  try {
    const res = await fetch(`${ENGINE_URL}/api/stats`, { headers: ctx.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    console.error("[stats] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json(
      { total_pages: 0, total_entities: 0, total_queries: 0, total_edges: 0 },
      { status: 200 }
    );
  }
}
