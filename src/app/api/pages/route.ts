import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.read", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const key of ["limit", "offset", "source", "type", "tag"]) {
    const val = searchParams.get(key);
    if (val) params.set(key, val);
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages?${params.toString()}`, { headers: ctx.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch (err) {
    console.error("[pages] list failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.write", "standard", "pages");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  // Basic validation
  if (typeof body.slug !== "string" || !body.slug.trim()) {
    return Response.json({ error: "slug_required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return Response.json({ error: "title_required" }, { status: 400 });
  }
  // Sanitize slug: no path traversal
  if (body.slug.includes("..") || body.slug.includes("//")) {
    return Response.json({ error: "invalid_slug" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    void recordQuota(ctx, "pages");
    return Response.json(await res.json());
  } catch (e) {
    console.error("[pages] create failed:", e instanceof Error ? e.message : String(e));
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
