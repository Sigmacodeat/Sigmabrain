import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineContext, unauthorized } from "@/lib/engine";

/**
 * Proxy for agent/supervisor job operations.
 * GET: List minion_jobs from engine
 * POST: Submit a new supervisor job to engine
 */

export async function GET() {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  try {
    const res = await fetch(`${ENGINE_URL}/api/agents`, { headers: ctx.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ jobs: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const body = await req.json();

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
  } catch {
    return new Response(
      JSON.stringify({ error: "Engine nicht erreichbar" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
