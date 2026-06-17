import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

/**
 * POST /api/legal/due-diligence
 *
 * KI-gestützte Due-Diligence-Analyse (Harvey: "Vault → Due Diligence").
 * Prüft eine Sammlung von Dokumenten (via Brain-Slugs oder Case-Slug) anhand
 * einer strukturierten Checkliste und liefert ein priorisiertes Report.
 *
 * Body:
 *   case_slug      string   optional  Brain-Slug der Akte (zieht alle Dokumente daraus)
 *   document_slugs string[] optional  Explizite Liste von Dokument-Slugs (max 50)
 *   category       string   optional  "m_and_a" | "real_estate" | "financing" | "general"
 *   jurisdiction   string   optional  "at" | "de" | "ch"
 *   checklist      string[] optional  Custom Prüfpunkte (überschreibt Standard-Checklist)
 *   language       string   optional  "de" | "en"
 *
 * Eines von case_slug oder document_slugs ist erforderlich.
 *
 * Response: {
 *   summary: string,
 *   risk_level: "low" | "medium" | "high" | "critical",
 *   findings: [{ item, status, details, severity, page_refs }],
 *   red_flags: string[],
 *   recommendations: string[]
 * }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.due_diligence", "heavy", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const caseSlug = typeof body.case_slug === "string" ? body.case_slug.trim() : "";
  const documentSlugs = Array.isArray(body.document_slugs)
    ? (body.document_slugs as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 50)
    : [];

  if (!caseSlug && documentSlugs.length === 0) {
    return Response.json(
      { error: "case_slug_or_document_slugs_required" },
      { status: 400 },
    );
  }

  const VALID_CATS = new Set(["m_and_a", "real_estate", "financing", "general"]);
  const category = typeof body.category === "string" && VALID_CATS.has(body.category)
    ? body.category
    : "general";

  const VALID_JUR = new Set(["at", "de", "ch"]);
  const jurisdiction = typeof body.jurisdiction === "string" && VALID_JUR.has(body.jurisdiction)
    ? body.jurisdiction
    : "de";

  const customChecklist = Array.isArray(body.checklist)
    ? (body.checklist as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 100)
    : [];

  const language = body.language === "en" ? "en" : "de";

  void logAudit("legal.due_diligence", "case", {
    entityId: caseSlug || documentSlugs[0],
    details: { category, jurisdiction, docCount: documentSlugs.length || "from_case" },
  });

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/legal/due-diligence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({
        case_slug: caseSlug || undefined,
        document_slugs: documentSlugs.length > 0 ? documentSlugs : undefined,
        category,
        jurisdiction,
        checklist: customChecklist.length > 0 ? customChecklist : undefined,
        language,
      }),
    });

    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => ({}));
      return Response.json(
        payload.error ? payload : { error: `Engine returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    void recordQuota(ctx, "queries");

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-AI-Generated": "true",
      },
    });
  } catch (err) {
    console.error("[due-diligence] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
