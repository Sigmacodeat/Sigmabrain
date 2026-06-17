import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";

// The engine fetches external court databases inline — give it time.
export const maxDuration = 120;

/** Proxy: run the legal-judgements connector and import into the tenant source. */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.judgements", "heavy");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.jurisdiction && !["at", "de", "ch", "all"].includes(String(body.jurisdiction))) {
    return Response.json({ error: "invalid_jurisdiction" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/judgements-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return Response.json({ error: `Engine returned ${res.status}` }, { status: res.status });
    }
    return Response.json(await res.json());
  } catch (err) {
    console.error("[judgements-sync] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
