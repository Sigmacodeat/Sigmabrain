import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";

/**
 * Proxy for agent/supervisor job operations.
 * GET: List minion_jobs from engine
 * POST: Submit a new supervisor job to engine
 */

export async function GET(req: NextRequest) {
  const ctx = await requireEngineContext(req, "agent.read", "heavy");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  try {
    const res = await fetch(`${ENGINE_URL}/api/agents`, { headers: ctx.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch (err) {
    console.error("[agents] list failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ jobs: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "agent.write", "heavy");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return Response.json({ error: "prompt_required" }, { status: 400 });
  }
  // Clamp prompt length
  if (body.prompt.length > 10_000) {
    return Response.json({ error: "prompt_too_long", max: 10_000 }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/agents/supervisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Engine returned ${upstream.status}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return Response.json(await upstream.json());
  } catch (err) {
    console.error("[agents] supervisor failed:", err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: "Engine nicht erreichbar" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
