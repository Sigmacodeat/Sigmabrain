import { NextRequest } from "next/server";
import { ENGINE_URL, requireAuthAction, engineConfigurationResponse } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-export/gdpr
 *
 * Art. 20 DSGVO — Recht auf Datenübertragbarkeit.
 * Liefert alle Brain-Pages des authentifizierten Nutzers als JSON.
 * Format: structured, commonly used, machine-readable (JSON).
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("brain.read");
  if (ctx instanceof Response) return ctx;
  const configErr = engineConfigurationResponse();
  if (configErr) return configErr;

  try {
    // Fetch all pages from the user's brain
    const types = ["legal_case", "legal_contact", "invoice", "deadline", "document_draft", "signature_request", "agent_action", "audit_log", "judgement"];
    const allPages: Array<Record<string, unknown>> = [];

    for (const type of types) {
      try {
        const res = await fetch(`${ENGINE_URL}/api/pages?type=${type}&limit=500`, {
          headers: ctx.headers,
        });
        if (res.ok) {
          const pages = (await res.json()) as Array<Record<string, unknown>>;
          allPages.push(...pages);
        }
      } catch {
        // Einzelne Typen dürfen den Export nicht abbrechen
      }
    }

    const exportData = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        user_id: ctx.user.id,
        user_email: ctx.user.email,
        format: "JSON",
        legal_basis: "GDPR Art. 20",
        description: "Structured, commonly used, machine-readable format per GDPR Art. 20",
      },
      data: allPages,
      statistics: {
        total_pages: allPages.length,
        by_type: allPages.reduce((acc: Record<string, number>, p) => {
          const t = String(p.type || "unknown");
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {}),
      },
    };

    return Response.json(exportData);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "export_failed" },
      { status: 500 }
    );
  }
}
