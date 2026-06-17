import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext } from "@/lib/engine";

export const maxDuration = 120;

/**
 * POST /api/legal/analyze
 *
 * Auto-analyse triggered after document upload. Detects:
 *   - Document type (contract, judgement, letter, invoice, ...)
 *   - Relevant statutes / paragraphs
 *   - Deadlines / dates
 *   - Parties / actors
 *   - Risks / action items
 *
 * Body:
 *   document_slug  string   optional  Brain slug of uploaded doc
 *   text           string   optional  Raw text (bypass brain lookup)
 *   jurisdiction   string   optional  "at" | "de" | "ch" | "all" (default: "all")
 *   _engine_headers Record<string,string> optional  Internal auth passthrough
 *
 * Response: {
 *   document_type: string,
 *   type_confidence: number,
 *   parties: string[],
 *   deadlines: { label: string, date: string, urgency: "critical"|"normal" }[],
 *   cited_statutes: { code: string, paragraph: string, context: string }[],
 *   risks: { severity: "high"|"medium"|"low", description: string }[],
 *   action_items: string[],
 *   summary: string,
 *   language: string
 * }
 */

export async function POST(req: NextRequest) {
  // Allow internal auto-trigger without full session (uses engine headers)
  let ctx: Awaited<ReturnType<typeof requireEngineContext>> | null = null;
  let engineHeaders: Record<string, string> = {};

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  // Internal passthrough from upload hook
  const passthroughHeaders = body._engine_headers;
  if (passthroughHeaders && typeof passthroughHeaders === "object") {
    engineHeaders = passthroughHeaders as Record<string, string>;
  } else {
    ctx = await requireEngineContext(req, "legal.document_review", "heavy", "queries");
    if (ctx instanceof Response) return ctx;
    engineHeaders = ctx.headers;
  }

  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const documentSlug = typeof body.document_slug === "string" ? body.document_slug.trim() : "";
  const jurisdiction = typeof body.jurisdiction === "string" ? body.jurisdiction : "all";

  // 1. Fetch document content from engine if slug provided
  let text = "";
  if (documentSlug) {
    try {
      const pageRes = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(documentSlug)}`, {
        headers: engineHeaders,
      });
      if (pageRes.ok) {
        const page = (await pageRes.json()) as { content?: string; title?: string };
        text = `${page.title || ""}\n\n${page.content || ""}`;
      }
    } catch {
      // Best-effort: continue even if brain lookup fails
    }
  }

  // Fallback to direct text
  if (!text && typeof body.text === "string") {
    text = body.text;
  }

  if (!text.trim()) {
    return Response.json({ error: "document_not_found_or_empty" }, { status: 404 });
  }

  if (text.length > 100_000) {
    text = text.slice(0, 100_000) + "\n\n[... truncated for analysis]";
  }

  // 2. Run AI analysis via engine /api/think or direct prompt
  const analysisPrompt = buildAnalysisPrompt(text, jurisdiction);

  try {
    const thinkRes = await fetch(`${ENGINE_URL}/api/think`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...engineHeaders },
      body: JSON.stringify({
        prompt: analysisPrompt,
        mode: "json",
        max_tokens: 4000,
      }),
    });

    if (!thinkRes.ok) {
      throw new Error(`Engine think failed: ${thinkRes.status}`);
    }

    const thinkData = (await thinkRes.json()) as { answer?: string };
    const parsed = safeParseJson(thinkData.answer || "{}");

    // 3. Store analysis result as page metadata (best-effort)
    if (documentSlug && ctx && !(ctx instanceof Response)) {
      void storeAnalysisMeta(documentSlug, parsed, engineHeaders);
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("[analyze] failed:", err instanceof Error ? err.message : String(err));
    // Return partial analysis even on failure
    return Response.json({
      document_type: "unknown",
      type_confidence: 0,
      parties: [],
      deadlines: [],
      cited_statutes: [],
      risks: [],
      action_items: [],
      summary: "Analyse konnte nicht durchgeführt werden.",
      language: "de",
      _error: err instanceof Error ? err.message : "unknown",
    });
  }
}

function buildAnalysisPrompt(text: string, jurisdiction: string): string {
  const jurHint = jurisdiction === "all"
    ? "AT (Österreich), DE (Deutschland) oder CH (Schweiz)"
    : jurisdiction.toUpperCase();

  return `Analysiere das folgende Rechtsdokument systematisch. Antworte AUSSCHLIESSLICH als gültiges JSON-Objekt ohne Markdown-Codeblock.

Dokument:
---
${text}
---

Extrahiere:
1. document_type: Vertrag, Gerichtsurteil, Schriftsatz, Schreiben, Rechnung, Mahnung, Gesetzesentwurf, Korrespondenz oder "sonstiges"
2. type_confidence: 0.0–1.0
3. parties: Namen von Beteiligten (Klient, Gegner, Gericht, Behörde, ...)
4. deadlines: { label, date (ISO 8601 oder deutsches Datum), urgency ("critical"|"normal") }
5. cited_statutes: { code (z.B. ABGB, BGB, EStG), paragraph, context }
6. risks: { severity ("high"|"medium"|"low"), description }
7. action_items: konkrete nächste Schritte
8. summary: 2-3 Sätze Zusammenfassung
9. language: erkannte Sprache

Rechtsordnung: ${jurHint}

JSON-Schema:
{
  "document_type": "string",
  "type_confidence": 0.0,
  "parties": ["string"],
  "deadlines": [{"label":"string","date":"string","urgency":"critical|normal"}],
  "cited_statutes": [{"code":"string","paragraph":"string","context":"string"}],
  "risks": [{"severity":"high|medium|low","description":"string"}],
  "action_items": ["string"],
  "summary": "string",
  "language": "de|en"
}`;
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    const cleaned = text
      .replace(/^```json\s*/, "")
      .replace(/```\s*$/, "")
      .trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Fallback: try to extract JSON from markdown
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    return {};
  }
}

async function storeAnalysisMeta(
  slug: string,
  analysis: Record<string, unknown>,
  headers: Record<string, string>,
) {
  try {
    await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        meta: { auto_analysis: analysis, analyzed_at: new Date().toISOString() },
      }),
    });
  } catch {
    // Best-effort: don't fail if metadata storage fails
  }
}
