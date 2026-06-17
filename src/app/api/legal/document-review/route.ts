import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

/**
 * POST /api/legal/document-review
 *
 * KI-Dokumentenprüfung mit Quellenangaben (Harvey: "Vault → AI Review").
 * Analysiert ein Dokument (via Brain-Slug oder Textinhalt) und gibt
 * strukturiertes Feedback mit Zitatnachweisen zurück.
 *
 * Body:
 *   document_slug  string   optional  Slug eines Brain-Dokuments
 *   text           string   optional  Direkter Dokumenttext (max 100.000 Zeichen)
 *   questions      string[] optional  Spezifische Prüffragen (max 20)
 *   focus          string   optional  "clauses" | "risks" | "compliance" | "general"
 *   jurisdiction   string   optional  "at" | "de" | "ch" | "all"
 *
 * Eines von document_slug oder text ist erforderlich.
 *
 * Response: { summary, findings: [{ question, answer, citations, risk_level }], overall_risk }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.document_review", "heavy", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const documentSlug = typeof body.document_slug === "string" ? body.document_slug.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";

  if (!documentSlug && !text.trim()) {
    return Response.json(
      { error: "document_slug_or_text_required" },
      { status: 400 },
    );
  }
  if (text.length > 100_000) {
    return Response.json({ error: "text_too_long", max: 100_000 }, { status: 413 });
  }

  const questions = Array.isArray(body.questions)
    ? (body.questions as unknown[]).filter((q): q is string => typeof q === "string").slice(0, 20)
    : [];

  const VALID_FOCUS = new Set(["clauses", "risks", "compliance", "general"]);
  const focus = typeof body.focus === "string" && VALID_FOCUS.has(body.focus)
    ? body.focus
    : "general";

  const VALID_JUR = new Set(["at", "de", "ch", "all"]);
  const jurisdiction = typeof body.jurisdiction === "string" && VALID_JUR.has(body.jurisdiction)
    ? body.jurisdiction
    : "all";

  void logAudit("legal.document_review", "document", {
    details: { focus, jurisdiction, hasText: Boolean(text), documentSlug },
  });

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/legal/document-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({ document_slug: documentSlug || undefined, text: text || undefined, questions, focus, jurisdiction }),
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
    console.error("[document-review] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
