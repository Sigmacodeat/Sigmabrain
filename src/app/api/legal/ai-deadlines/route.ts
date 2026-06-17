import { NextRequest } from "next/server";
import { requireEngineContext, recordQuota } from "@/lib/engine";
import { detectDeadlines, resolveRelativeDeadline } from "@/lib/ai-deadline-detect";

export const dynamic = "force-dynamic";

/**
 * POST /api/legal/ai-deadlines
 *
 * Erkennt Fristen aus Text-Eingabe (E-Mail, Brief, Notiz).
 * Body: { text: string, caseSlug?: string }
 * Response: { detected: DetectedDeadline[], created?: string[] }
 *
 * Bei caseSlug + hoher Confidence werden Deadlines direkt als Brain-Pages angelegt.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const caseSlug = typeof body.caseSlug === "string" ? body.caseSlug : undefined;
  if (!text || text.length > 50_000) {
    return Response.json({ error: "text_required_or_too_long", max: 50_000 }, { status: 400 });
  }

  const detected = detectDeadlines(text);

  // Optional: bei caseSlug und high-confidence → direkt anlegen
  const createdSlugs: string[] = [];
  if (caseSlug) {
    for (const d of detected) {
      if (d.confidence === "high" && (d.date || d.daysFromNow)) {
        try {
          const dueDate = d.date || resolveRelativeDeadline(d.daysFromNow!);
          const { ENGINE_URL } = await import("@/lib/engine");
          const slug = `legal/deadline/${Date.now()}-${createdSlugs.length}`;
          await fetch(`${ENGINE_URL}/api/pages`, {
            method: "POST",
            headers: { ...ctx.headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              slug,
              title: d.description,
              type: "deadline",
              content: `Erkannt aus Text:\n${d.sourceSnippet}\n\nKonfidenz: ${d.confidence}`,
              frontmatter: {
                type: "deadline",
                case_slug: caseSlug,
                due_date: dueDate,
                status: "pending",
                source: "ai_detected",
                matched_rule: d.matchedRule,
                ai_confidence: d.confidence,
              },
            }),
          });
          createdSlugs.push(slug);
        } catch {
          // Einzelne Fehler nicht abbrechen
        }
      }
    }
  }
  if (createdSlugs.length > 0) {
    void recordQuota(ctx, "pages", createdSlugs.length);
  }

  return Response.json({
    detected,
    created: createdSlugs.length > 0 ? createdSlugs : undefined,
  });
}
