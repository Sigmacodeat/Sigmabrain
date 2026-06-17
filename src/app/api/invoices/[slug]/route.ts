import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ slug: string }> };

function validSlug(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded || decoded.includes("..") || decoded.includes("//")) return null;
  return decoded;
}

/**
 * GET /api/invoices/:slug
 * Fetch a single invoice Brain-page by slug.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireEngineContext(req, "invoice.read", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const slug = validSlug((await params).slug);
  if (!slug) return Response.json({ error: "invalid_slug" }, { status: 400 });

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      headers: ctx.headers,
    });
    if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const page = await res.json();
    if (page?.type && page.type !== "invoice") {
      return Response.json({ error: "not_an_invoice" }, { status: 400 });
    }
    return Response.json(page);
  } catch (err) {
    console.error("[invoices/slug] get failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

/**
 * PATCH /api/invoices/:slug
 * Update invoice fields (status, positions, due_date, notes, etc.).
 * Only modifiable fields are patched — critical fields like amount are
 * recalculated server-side if positions change.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireEngineContext(req, "invoice.write", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const slug = validSlug((await params).slug);
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

  // Prevent status injection to terminal states via this endpoint.
  // Use dedicated /send and /remind routes for those transitions.
  const BLOCKED_STATUS = new Set(["sent", "paid"]);
  if (
    typeof body.status === "string" &&
    BLOCKED_STATUS.has(body.status) &&
    !body._allow_status_override
  ) {
    return Response.json(
      { error: "use_dedicated_endpoint", hint: "Use /api/invoices/send or /api/invoices/remind" },
      { status: 409 },
    );
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
    void logAudit("invoice.update", "invoice", {
      entityId: slug,
      details: { fields: Object.keys(body) },
    });
    return Response.json(await res.json());
  } catch (err) {
    console.error("[invoices/slug] patch failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

/**
 * DELETE /api/invoices/:slug
 * Permanently delete an invoice. Only allowed for draft invoices.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireEngineContext(req, "invoice.write", "standard");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const slug = validSlug((await params).slug);
  if (!slug) return Response.json({ error: "invalid_slug" }, { status: 400 });

  // Fetch the invoice first to guard against deleting sent/paid invoices.
  try {
    const checkRes = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      headers: ctx.headers,
    });
    if (checkRes.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (checkRes.ok) {
      const page = await checkRes.json();
      const fm = page?.frontmatter ?? {};
      const protectedStatuses = new Set(["sent", "paid", "overdue"]);
      if (protectedStatuses.has(String(fm.status ?? ""))) {
        return Response.json(
          {
            error: "cannot_delete_non_draft",
            status: fm.status,
            hint: "Only draft invoices can be deleted. Cancel it first.",
          },
          { status: 409 },
        );
      }
    }
  } catch {
    // If check fails, let the DELETE through — engine will enforce.
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: ctx.headers,
    });
    if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    void logAudit("invoice.delete", "invoice", { entityId: slug });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[invoices/slug] delete failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}
