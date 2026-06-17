import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 120;

/**
 * POST /api/legal/summarize
 *
 * KI-gestützte Zusammenfassung von Rechtsdokumenten, Akten oder Urteilen.
 * Harvey & Legora Kernfeature: sofortige Executive Summary + strukturierte
 * Kernpunkte mit Quellenangaben aus dem Dokument.
 *
 * Body:
 *   document_slug  string   optional  Brain-Slug des Dokuments/der Akte
 *   text           string   optional  Direkter Dokumenttext (max 100.000 Zeichen)
 *   type           string   optional  "document" | "case" | "judgement" | "contract" | "general"
 *   depth          string   optional  "brief" (3 Sätze) | "standard" (1 Seite) | "detailed" (3+ Seiten)
 *   focus          string   optional  Freier Text: z.B. "Haftungsklauseln", "Fristen"
 *   language       string   optional  "de" | "en" (default: "de")
 *
 * Eines von document_slug oder text ist erforderlich.
 *
 * Response: {
 *   executive_summary: string,
 *   key_points: string[],
 *   parties?: string[],
 *   dates?: { label: string, date: string }[],
 *   obligations?: string[],
 *   risks?: string[],
 *   word_count: number,
 *   reading_time_minutes: number
 * }
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
    return Response.json({ error: "document_slug_or_text_required" }, { status: 400 });
  }
  if (text.length > 100_000) {
    return Response.json({ error: "text_too_long", max: 100_000 }, { status: 413 });
  }

  const VALID_TYPES = new Set(["document", "case", "judgement", "contract", "general"]);
  const docType = typeof body.type === "string" && VALID_TYPES.has(body.type) ? body.type : "general";

  const VALID_DEPTH = new Set(["brief", "standard", "detailed"]);
  const depth = typeof body.depth === "string" && VALID_DEPTH.has(body.depth) ? body.depth : "standard";

  const focus = typeof body.focus === "string" ? body.focus.trim().slice(0, 200) : "";
  const language = body.language === "en" ? "en" : "de";

  void logAudit("legal.document_review", "document", {
    details: { action: "summarize", docType, depth, hasSlug: Boolean(documentSlug) },
  });

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/legal/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify({
        document_slug: documentSlug || undefined,
        text: text || undefined,
        type: docType,
        depth,
        focus: focus || undefined,
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
    console.error("[summarize] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
