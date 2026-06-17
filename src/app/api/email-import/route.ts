import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { api } from "@/lib/api";
import { caseFrontmatter } from "@/lib/legal-types";

export const dynamic = "force-dynamic";

/**
 * POST /api/email-import
 *
 * Importiert eine E-Mail und versucht, sie einer Akte zuzuordnen.
 * Zuordnungs-Logik: Betreff enthält Aktenzeichen OR Absender ist bekannter Mandant.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const subject = typeof body.subject === "string" ? body.subject : "";
  const from = typeof body.from === "string" ? body.from : "";
  const bodyText = typeof body.body === "string" ? body.body : "";
  const date = typeof body.date === "string" ? body.date : undefined;
  if (!subject || !from || !bodyText) {
    return NextResponse.json({ error: "subject_from_and_body_required" }, { status: 400 });
  }

  try {
    // Load all cases
    const pages = await api.brain.listPages({ type: "legal_case", limit: 500 });
    const cases = pages.map((p) => ({ slug: p.slug, title: p.title, ...caseFrontmatter(p) }));

    // Try to match by case_number in subject
    let matchedCase = cases.find((c) => {
      const caseNum = c.case_number;
      return caseNum && subject.toLowerCase().includes(caseNum.toLowerCase());
    });

    // Fallback: match by client email/name in from field
    if (!matchedCase) {
      matchedCase = cases.find((c) => {
        const clientEmail = c.client_slug ? String(c.client_slug) : "";
        const clientName = c.client_name || "";
        const fromLower = from.toLowerCase();
        return (
          (clientEmail && fromLower.includes(clientEmail.toLowerCase())) ||
          (clientName && fromLower.includes(clientName.toLowerCase()))
        );
      });
    }

    // Fallback: match by opponent name in from field
    if (!matchedCase) {
      matchedCase = cases.find((c) => {
        const oppName = c.opponent_name || "";
        return oppName && from.toLowerCase().includes(oppName.toLowerCase());
      });
    }

    if (!matchedCase) {
      return NextResponse.json({
        success: false,
        error: "no_case_match",
        message: "Keine passende Akte gefunden. Prüfen Sie Betreff (Aktenzeichen) oder Absender.",
        suggestions: cases.slice(0, 5).map((c) => ({ slug: c.slug, caseNumber: c.case_number, title: c.title })),
      });
    }

    // Add as document entry to the matched case
    const documentEntry = {
      id: `doc-${Date.now()}`,
      name: `E-Mail: ${subject}`,
      type: "email",
      url: "#email",
      uploadedAt: date || new Date().toISOString(),
      notes: `Von: ${from}\n\n${bodyText.substring(0, 2000)}`,
    };

    const existingDocs = matchedCase.documents || [];
    await api.brain.updatePage({
      slug: matchedCase.slug,
      frontmatter: {
        documents: [...existingDocs, documentEntry],
      },
    });

    return NextResponse.json({
      success: true,
      matchedCase: {
        slug: matchedCase.slug,
        caseNumber: matchedCase.case_number,
        title: matchedCase.title,
      },
      document: documentEntry,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "import_failed" },
      { status: 500 }
    );
  }
}
