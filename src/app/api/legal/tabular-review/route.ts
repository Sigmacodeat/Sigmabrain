import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";

// Pro Dokument ein LLM-Call — bei vielen Dokumenten dauert das.
export const maxDuration = 300;

/** Proxy: tabellarische Massenprüfung (Grid: Dokumente × Fragen, zitiert). */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.tabular", "heavy", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return Response.json({ error: "questions_required" }, { status: 400 });
  }
  if (body.questions.length > 50) {
    return Response.json({ error: "too_many_questions", max: 50 }, { status: 400 });
  }

  void recordQuota(ctx, "queries", body.questions.length);

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/tabular-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return Response.json(payload.error ? payload : { error: `Engine returned ${res.status}` }, { status: res.status });
    }
    return Response.json(await res.json());
  } catch (err) {
    console.error("[tabular-review] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
