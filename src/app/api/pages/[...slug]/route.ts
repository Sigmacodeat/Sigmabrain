import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ slug: string[] }> };

function buildPath(slug: string[]): string | null {
  const path = slug.join("/");
  if (path.includes("..")) return null;
  return path;
}

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireEngineContext(req, "brain.read", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const path = buildPath((await params).slug);
  if (!path) return Response.json({ error: "invalid_slug" }, { status: 400 });

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(path)}`, {
      headers: ctx.headers,
    });
    if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch (err) {
    console.error("[pages/...slug] get failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireEngineContext(req, "brain.write", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const path = buildPath((await params).slug);
  if (!path) return Response.json({ error: "invalid_slug" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (Object.keys(body).length === 0) {
    return Response.json({ error: "nothing_to_update" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(path)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({ ...body, slug: path }),
    });
    if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return Response.json(
        payload.error ? payload : { error: `Engine returned ${res.status}` },
        { status: res.status },
      );
    }
    return Response.json(await res.json());
  } catch (err) {
    console.error("[pages/...slug] patch failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireEngineContext(req, "brain.delete", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const path = buildPath((await params).slug);
  if (!path) return Response.json({ error: "invalid_slug" }, { status: 400 });

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: ctx.headers,
    });
    if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    void logAudit("document.delete", "page", { entityId: path, details: { userId: ctx.user.id } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[pages/...slug] delete failed:", e instanceof Error ? e.message : String(e));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}
