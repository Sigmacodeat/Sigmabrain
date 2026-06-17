import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";

/** Proxy: server-side Kollisionsprüfung over the tenant's legal_case pages. */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.conflict", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "name_required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/conflict-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return Response.json({ error: `Engine returned ${res.status}` }, { status: res.status });
    }
    return Response.json(await res.json());
  } catch (err) {
    console.error("[conflict-check] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
