import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { ENGINE_URL, engineContext, engineConfigurationResponse } from "@/lib/engine";
import { runEval } from "@/lib/rag-eval";

export const dynamic = "force-dynamic";

/**
 * POST /api/rag-eval
 * Führt einen RAG-Eval-Lauf durch: bekannte Fragen an den Brain,
 * bewertet die Retrieval-Qualität (Precision, Recall, MRR).
 *
 * Nur Admin und Entwickler dürfen Evals ausführen.
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const ctx = await engineContext();
  if (!ctx) return Response.json({ error: "engine_unavailable" }, { status: 503 });
  const configErr = engineConfigurationResponse();
  if (configErr) return configErr;

  try {
    const summary = await runEval(async (query) => {
      // Brain search: use the engine's search endpoint
      try {
        const res = await fetch(`${ENGINE_URL}/api/search?q=${encodeURIComponent(query)}&limit=10`, {
          headers: ctx.headers,
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { results?: Array<{ slug: string }> };
        return (data.results || []).map((r) => r.slug);
      } catch {
        return [];
      }
    });

    return Response.json(summary);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "eval_failed" },
      { status: 500 }
    );
  }
}
