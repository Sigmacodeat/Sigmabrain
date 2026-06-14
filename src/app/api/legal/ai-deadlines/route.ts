import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
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
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { text, caseSlug } = (await req.json()) as { text?: string; caseSlug?: string };
  if (!text || typeof text !== "string") {
    return Response.json({ error: "text_required" }, { status: 400 });
  }

  const detected = detectDeadlines(text);

  // Optional: bei caseSlug und high-confidence → direkt anlegen
  const createdSlugs: string[] = [];
  if (caseSlug) {
    for (const d of detected) {
      if (d.confidence === "high" && (d.date || d.daysFromNow)) {
        try {
          const dueDate = d.date || resolveRelativeDeadline(d.daysFromNow!);
          const ctx = await import("@/lib/engine").then((m) => m.engineContext());
          if (ctx) {
            const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:3001";
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
          }
        } catch {
          // Einzelne Fehler nicht abbrechen
        }
      }
    }
  }

  return Response.json({
    detected,
    created: createdSlugs.length > 0 ? createdSlugs : undefined,
  });
}
