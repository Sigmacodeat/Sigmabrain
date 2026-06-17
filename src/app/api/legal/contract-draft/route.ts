import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

/**
 * POST /api/legal/contract-draft
 *
 * KI-gestützter Vertragsentwurf (Harvey: "Assistant → Drafting").
 *
 * Body:
 *   type          string  required  Vertragstyp: z.B. "NDA", "Arbeitsvertrag", "Kaufvertrag"
 *   jurisdiction  string  required  "at" | "de" | "ch" — Rechtsordnung für anwendbares Recht
 *   parties       object  required  { a: string, b: string } — Parteienbezeichnung
 *   instructions  string  optional  Spezifische Anforderungen (max 5000 Zeichen)
 *   template_slug string  optional  Brain-Slug eines vorhandenen Vertragstemplates
 *   language      string  optional  "de" | "en" — Sprache des Entwurfs (default: "de")
 *
 * Response: SSE stream (text/event-stream) mit dem generierten Vertragstext.
 * Letztes Event: { done: true, slug: string } — der Entwurf wird als Brain-Page gespeichert.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "legal.contract_draft", "heavy", "queries");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const contractType = typeof body.type === "string" ? body.type.trim() : "";
  const jurisdiction = typeof body.jurisdiction === "string" ? body.jurisdiction.trim() : "";
  const parties = body.parties && typeof body.parties === "object" ? body.parties as Record<string, string> : null;

  if (!contractType) return Response.json({ error: "type_required" }, { status: 400 });
  if (!["at", "de", "ch"].includes(jurisdiction)) {
    return Response.json({ error: "invalid_jurisdiction", allowed: ["at", "de", "ch"] }, { status: 400 });
  }
  if (!parties?.a || !parties?.b) {
    return Response.json({ error: "parties_required", hint: "Provide parties: { a, b }" }, { status: 400 });
  }

  const instructions = typeof body.instructions === "string"
    ? body.instructions.slice(0, 5_000)
    : "";
  const language = body.language === "en" ? "en" : "de";
  const templateSlug = typeof body.template_slug === "string" ? body.template_slug : undefined;

  void logAudit("legal.contract_draft", "contract", {
    details: { contractType, jurisdiction, parties },
  });

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/legal/contract-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({
        type: contractType,
        jurisdiction,
        parties,
        instructions,
        language,
        template_slug: templateSlug,
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

    const contentType = upstream.headers.get("Content-Type") || "application/json";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-AI-Generated": "true",
      },
    });
  } catch (err) {
    console.error("[contract-draft] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
