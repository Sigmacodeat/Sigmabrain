import { ENGINE_URL, engineConfigurationResponse, engineContext, unauthorized } from "@/lib/engine";

/** Proxy: list configured and supported ingestion connectors.
 *  Connector status is install-global (not per-tenant) — admin-only,
 *  matching the sync/toggle actions. */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  if (ctx.user.role !== "admin") {
    return Response.json(
      { error: "forbidden", message: "Nur Administratoren können Konnektoren einsehen." },
      { status: 403 },
    );
  }
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
