import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

/**
 * POST /api/legal/contract-redline
 *
 * KI-gestütztes Redlining / Tracked Changes (Legora-Differentiator).
 * Vergleicht einen Vertragsentwurf gegen eine Gegenpartei-Version oder
 * gegen eigene Musterklauseln und schlägt konkrete Änderungen vor.
 *
 * Body:
 *   original_text  string   required  Originaler Vertragstext (max 100.000 Zeichen)
 *   counterparty_text string optional  Text der Gegenpartei für Diff-Analyse
 *   playbook_slug  string   optional  Brain-Slug des eigenen Klauselhandbuchs
 *   contract_type  string   optional  Vertragstyp für spezifische Regeln
 *   jurisdiction   string   optional  "at" | "de" | "ch" | "all"
 *   perspective    string   optional  "client" | "counterparty" | "neutral"
 *   language       string   optional  "de" | "en"
 *
 * Response: {
 *   redlines: [{
 *     original_clause: string,
 *     suggested_text: string,
 *     change_type: "add" | "remove" | "modify",
 *     reason: string,
 *     risk_level: "low"|"medium"|"high",
 *     legal_basis?: string
 *   }],
 *   summary: string,
 *   accepted_count: number,
 *   total_changes: number
 * }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.redline", "heavy", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const originalText = typeof body.original_text === "string" ? body.original_text : "";
  if (!originalText.trim()) {
    return Response.json({ error: "original_text_required" }, { status: 400 });
  }
  if (originalText.length > 100_000) {
    return Response.json({ error: "text_too_long", max: 100_000 }, { status: 413 });
  }

  const counterpartyText = typeof body.counterparty_text === "string" ? body.counterparty_text : "";
  if (counterpartyText.length > 100_000) {
    return Response.json({ error: "counterparty_text_too_long", max: 100_000 }, { status: 413 });
  }

  const playbookSlug = typeof body.playbook_slug === "string" ? body.playbook_slug.trim() : "";

  const VALID_JUR = new Set(["at", "de", "ch", "all"]);
  const jurisdiction = typeof body.jurisdiction === "string" && VALID_JUR.has(body.jurisdiction)
    ? body.jurisdiction
    : "all";

  const VALID_PERSP = new Set(["client", "counterparty", "neutral"]);
  const perspective = typeof body.perspective === "string" && VALID_PERSP.has(body.perspective)
    ? body.perspective
    : "client";

  const contractType = typeof body.contract_type === "string" ? body.contract_type.trim().slice(0, 100) : "";
  const language = body.language === "en" ? "en" : "de";

  void logAudit("legal.redline", "document", {
    details: { jurisdiction, perspective, contractType, hasCounterparty: Boolean(counterpartyText) },
  });

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/legal/contract-redline`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({
        original_text: originalText,
        counterparty_text: counterpartyText || undefined,
        playbook_slug: playbookSlug || undefined,
        contract_type: contractType || undefined,
        jurisdiction,
        perspective,
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
    console.error("[contract-redline] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
