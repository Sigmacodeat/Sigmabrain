import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

/**
 * POST /api/legal/memo
 *
 * KI-generiertes Rechtsgutachten / Legal Memo (Harvey: "Assistant → Memos").
 * Erstellt ein strukturiertes Gutachten mit Sachverhalt, rechtlicher Würdigung,
 * Subsumtion und Ergebnis — inklusive Quellenangaben aus Brain + Judikatur.
 *
 * Body:
 *   question       string   required  Die Rechtsfrage (max 2000 Zeichen)
 *   facts          string   required  Sachverhaltsdarstellung (max 10.000 Zeichen)
 *   jurisdiction   string   required  "at" | "de" | "ch"
 *   legal_area     string   optional  Rechtsgebiet (z.B. "Arbeitsrecht", "Vertragsrecht")
 *   case_slug      string   optional  Brain-Slug der zugehörigen Akte (für Kontext)
 *   language       string   optional  "de" | "en" (default: "de")
 *   depth          string   optional  "brief" | "standard" | "comprehensive" (default: "standard")
 *
 * Response: SSE stream (text/event-stream) mit dem Gutachten.
 * Speichert das fertige Memo als Brain-Page type: "document_draft".
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.memo", "heavy", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const facts = typeof body.facts === "string" ? body.facts.trim() : "";

  if (!question || question.length > 2_000) {
    return Response.json({ error: "question_required_or_too_long", max: 2_000 }, { status: 400 });
  }
  if (!facts || facts.length > 10_000) {
    return Response.json({ error: "facts_required_or_too_long", max: 10_000 }, { status: 400 });
  }

  const VALID_JUR = new Set(["at", "de", "ch"]);
  const jurisdiction = typeof body.jurisdiction === "string" && VALID_JUR.has(body.jurisdiction)
    ? body.jurisdiction
    : null;
  if (!jurisdiction) {
    return Response.json({ error: "invalid_jurisdiction", allowed: ["at", "de", "ch"] }, { status: 400 });
  }

  const VALID_DEPTH = new Set(["brief", "standard", "comprehensive"]);
  const depth = typeof body.depth === "string" && VALID_DEPTH.has(body.depth)
    ? body.depth
    : "standard";

  const legalArea = typeof body.legal_area === "string" ? body.legal_area.trim().slice(0, 100) : "";
  const caseSlug = typeof body.case_slug === "string" ? body.case_slug.trim() : "";
  const language = body.language === "en" ? "en" : "de";

  void logAudit("legal.memo", "document", {
    details: { jurisdiction, legalArea, depth, hasCaseSlug: Boolean(caseSlug) },
  });

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/legal/memo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({
        question,
        facts,
        jurisdiction,
        legal_area: legalArea || undefined,
        case_slug: caseSlug || undefined,
        language,
        depth,
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
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-AI-Generated": "true",
      },
    });
  } catch (err) {
    console.error("[memo] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
