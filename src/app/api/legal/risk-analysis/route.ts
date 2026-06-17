import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 180;

/**
 * POST /api/legal/risk-analysis
 *
 * Automatische Risikoanalyse für Verträge und Rechtsdokumente.
 * Extrahiert Klauseln, bewertet Risiken (0–100), klassifiziert nach Schweregrad
 * und gibt Handlungsempfehlungen aus.
 *
 * Body:
 *   document_slug  string   optional  Brain-Slug des Dokuments
 *   text           string   optional  Direkter Dokumenttext (max 100.000 Zeichen)
 *   contract_type  string   optional  Vertragstyp für spezifische Klausel-Regeln
 *   jurisdiction   string   optional  "at" | "de" | "ch" | "all"
 *   perspective    string   optional  "party_a" | "party_b" | "neutral" (default: "neutral")
 *
 * Response: {
 *   overall_score: number (0=kein Risiko, 100=kritisch),
 *   overall_level: "low"|"medium"|"high"|"critical",
 *   clause_risks: [{
 *     clause_type, text_excerpt, score, level, issue, recommendation, legal_basis
 *   }],
 *   summary: string,
 *   red_flags: string[],
 *   missing_clauses: string[]
 * }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.risk_analysis", "heavy", "queries");
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
    return Response.json({ error: "document_slug_or_text_required" }, { status: 400 });
  }
  if (text.length > 100_000) {
    return Response.json({ error: "text_too_long", max: 100_000 }, { status: 413 });
  }

  const VALID_JUR = new Set(["at", "de", "ch", "all"]);
  const jurisdiction = typeof body.jurisdiction === "string" && VALID_JUR.has(body.jurisdiction)
    ? body.jurisdiction
    : "all";

  const VALID_PERSP = new Set(["party_a", "party_b", "neutral"]);
  const perspective = typeof body.perspective === "string" && VALID_PERSP.has(body.perspective)
    ? body.perspective
    : "neutral";

  const contractType = typeof body.contract_type === "string" ? body.contract_type.trim() : "";

  void logAudit("legal.risk_analysis", "document", {
    details: { jurisdiction, perspective, contractType, documentSlug },
  });

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/legal/risk-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({
        document_slug: documentSlug || undefined,
        text: text || undefined,
        contract_type: contractType || undefined,
        jurisdiction,
        perspective,
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
    return Response.json(await upstream.json());
  } catch (err) {
    console.error("[risk-analysis] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
