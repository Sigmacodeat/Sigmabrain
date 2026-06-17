import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { recordQuery } from "@/lib/usage";

export async function GET(req: NextRequest) {
  const ctx = await requireEngineContext(req, "query.submit", "search", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = searchParams.get("limit") || "10";

  if (q.trim()) {
    void recordQuery(ctx.brainId);
    void recordQuota(ctx, "queries");
  }

  try {
    const res = await fetch(
      `${ENGINE_URL}/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: ctx.headers },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    console.error("[search] engine search failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}
