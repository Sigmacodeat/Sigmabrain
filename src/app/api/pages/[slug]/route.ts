import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";

type SlugParams = { params: Promise<{ slug: string }> };

function decodedSlug(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes("..") || decoded.includes("//")) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * GET /api/pages/:slug
 * Fetch a single Brain page by its slug.
 */
export async function GET(req: NextRequest, { params }: SlugParams) {
  const ctx = await requireEngineContext(req, "brain.read", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const slug = decodedSlug((await params).slug);
  if (!slug) return Response.json({ error: "invalid_slug" }, { status: 400 });

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      headers: ctx.headers,
    });
    if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch (err) {
    console.error("[pages/slug] get failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

/**
 * PATCH /api/pages/:slug
 * Update a Brain page (partial update — only provided fields are changed).
 * Body: { title?, content?, frontmatter?, type?, tags? }
 */
export async function PATCH(req: NextRequest, { params }: SlugParams) {
  const ctx = await requireEngineContext(req, "brain.write", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const slug = decodedSlug((await params).slug);
  if (!slug) return Response.json({ error: "invalid_slug" }, { status: 400 });

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
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({ ...body, slug }),
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
    console.error("[pages/slug] patch failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

/**
 * DELETE /api/pages/:slug
 * Permanently remove a Brain page.
 */
export async function DELETE(req: NextRequest, { params }: SlugParams) {
  const ctx = await requireEngineContext(req, "brain.delete", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const slug = decodedSlug((await params).slug);
  if (!slug) return Response.json({ error: "invalid_slug" }, { status: 400 });

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: ctx.headers,
    });
    if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[pages/slug] delete failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}
