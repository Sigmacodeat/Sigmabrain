import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.read", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "200";

  try {
    const res = await fetch(`${ENGINE_URL}/api/graph?limit=${limit}`, { headers: ctx.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch (err) {
    console.error("[graph] failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ nodes: [], links: [] });
  }
}
