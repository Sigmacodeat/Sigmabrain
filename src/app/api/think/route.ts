import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { recordQuery } from "@/lib/usage";

export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "query.submit", "heavy", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  // Validate required field
  if (typeof body.query !== "string" || !body.query.trim()) {
    return Response.json({ error: "query_required" }, { status: 400 });
  }
  // Clamp mode to allowed values
  if (body.mode && !["conservative", "balanced", "tokenmax"].includes(String(body.mode))) {
    return Response.json({ error: "invalid_mode" }, { status: 400 });
  }

  void recordQuery(ctx.brainId);
  void recordQuota(ctx, "queries");

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/think`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Sigmabrain Engine returned ${upstream.status}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        // EU AI Act Art. 50: machine-readable marker that this content is AI-generated.
        "X-AI-Generated": "true",
      },
    });
  } catch (err) {
    console.error("[think] engine unreachable:", err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: "Sigmabrain Engine nicht erreichbar. Starte: gbrain serve" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
