import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";

export const maxDuration = 60;

/** Proxy: § 203 StGB Anonymisierung eines Textes (regex + optional LLM-Namen). */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.anonymize", "heavy");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "text_required" }, { status: 400 });
  }
  if (body.text.length > 100_000) {
    return Response.json({ error: "text_too_long", max: 100_000 }, { status: 413 });
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/anonymize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return Response.json({ error: `Engine returned ${res.status}` }, { status: res.status });
    }
    return Response.json(await res.json());
  } catch (err) {
    console.error("[anonymize] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
