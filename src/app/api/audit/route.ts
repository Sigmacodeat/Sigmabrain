import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireAuthAction } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit?action=&entityType=&from=&to=&limit=
 * Returns audit log entries from the brain (type: audit_log).
 * Only admins can access this endpoint. The engine call is scoped to the
 * caller's tenant brain via engineContext headers.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("admin.*");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || undefined;
  const entityType = searchParams.get("entityType") || undefined;
  const fromDate = searchParams.get("from") || undefined;
  const toDate = searchParams.get("to") || undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages?type=audit_log&limit=${limit}`, {
      headers: ctx.headers,
    });

    if (!res.ok) {
      return Response.json({ entries: [], total: 0 });
    }

    const pages = (await res.json()) as Array<{
      slug: string;
      title: string;
      created_at: string;
      frontmatter?: Record<string, unknown>;
    }>;

    const entries = pages.map((p) => {
      const fm = p.frontmatter || {};
      // details live in the frontmatter (the list API doesn't return page
      // bodies, so logAudit stores them there).
      const details = fm.details && typeof fm.details === "object"
        ? (fm.details as Record<string, unknown>)
        : undefined;
      return {
        id: p.slug,
        action: String(fm.action || ""),
        entityType: String(fm.entity_type || ""),
        entityId: fm.entity_id ? String(fm.entity_id) : undefined,
        timestamp: String(fm.timestamp || p.created_at || ""),
        details,
      };
    });

    const filtered = entries.filter((e) => {
      if (action && !e.action.includes(action)) return false;
      if (entityType && e.entityType !== entityType) return false;
      if (fromDate && e.timestamp < fromDate) return false;
      if (toDate && e.timestamp > `${toDate}T23:59:59`) return false;
      return true;
    });

    return Response.json({ entries: filtered, total: filtered.length });
  } catch (err) {
    console.error("[audit] failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ entries: [], total: 0 });
  }
}
