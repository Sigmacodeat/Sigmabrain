import { NextRequest } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  ENGINE_URL,
  engineConfigurationResponse,
  requireEngineContext,
} from "@/lib/engine";

export const maxDuration = 120;

// ── Internal service auth ─────────────────────────────────────────────
// Internal callers (e.g. upload hook) must present x-internal-secret
// matching SIGMABRAIN_INTERNAL_SECRET.  NEVER accept _engine_headers
// in the request body — that was a security hole.
const INTERNAL_SECRET = process.env.SIGMABRAIN_INTERNAL_SECRET;

// ── Corpus knowledge base (mirrors statute/route.ts CORPUS_META) ─────
// Used for citation grounding: after AI extracts cited_statutes, we
// verify each one against the actual corpus files before returning.
const CORPUS_META: Record<string, { jurisdiction: "at" | "de" | "ch"; label: string; file: string }> = {
  // Austria
  abgb:    { jurisdiction: "at", label: "ABGB — Allgemeines bürgerliches Gesetzbuch (AT)", file: "at/abgb.md" },
  ahg:     { jurisdiction: "at", label: "AHG — Amtshaftungsgesetz (AT)", file: "at/ahg.md" },
  bao:     { jurisdiction: "at", label: "BAO — Bundesabgabenordnung (AT)", file: "at/bao.md" },
  eo:      { jurisdiction: "at", label: "EO — Exekutionsordnung (AT)", file: "at/eo.md" },
  stgb_at: { jurisdiction: "at", label: "StGB (AT) — Strafgesetzbuch Österreich", file: "at/stgb-at.md" },
  stpo_at: { jurisdiction: "at", label: "StPO (AT) — Strafprozessordnung Österreich", file: "at/stpo-at.md" },
  ugb:     { jurisdiction: "at", label: "UGB — Unternehmensgesetzbuch (AT)", file: "at/ugb.md" },
  zpo_at:  { jurisdiction: "at", label: "ZPO (AT) — Zivilprozessordnung Österreich", file: "at/zpo-at.md" },
  // Germany
  ao:      { jurisdiction: "de", label: "AO — Abgabenordnung (DE)", file: "de/ao.md" },
  bgb:     { jurisdiction: "de", label: "BGB — Bürgerliches Gesetzbuch (DE)", file: "de/bgb.md" },
  estg:    { jurisdiction: "de", label: "EStG — Einkommensteuergesetz (DE)", file: "de/estg.md" },
  famfg:   { jurisdiction: "de", label: "FamFG — Familienverfahrensgesetz (DE)", file: "de/famfg.md" },
  gg:      { jurisdiction: "de", label: "GG — Grundgesetz (DE)", file: "de/gg.md" },
  gmbhg:   { jurisdiction: "de", label: "GmbHG — GmbH-Gesetz (DE)", file: "de/gmbhg.md" },
  hgb:     { jurisdiction: "de", label: "HGB — Handelsgesetzbuch (DE)", file: "de/hgb.md" },
  inso:    { jurisdiction: "de", label: "InsO — Insolvenzordnung (DE)", file: "de/inso.md" },
  stgb:    { jurisdiction: "de", label: "StGB — Strafgesetzbuch (DE)", file: "de/stgb.md" },
  stpo:    { jurisdiction: "de", label: "StPO — Strafprozessordnung (DE)", file: "de/stpo.md" },
  ustg:    { jurisdiction: "de", label: "UStG — Umsatzsteuergesetz (DE)", file: "de/ustg.md" },
  uwg:     { jurisdiction: "de", label: "UWG — Gesetz gegen unlauteren Wettbewerb (DE)", file: "de/uwg.md" },
  zpo:     { jurisdiction: "de", label: "ZPO — Zivilprozessordnung (DE)", file: "de/zpo.md" },
  // Switzerland
  or:      { jurisdiction: "ch", label: "OR — Obligationenrecht (CH)", file: "ch/or.md" },
  stgb_ch: { jurisdiction: "ch", label: "StGB (CH) — Strafgesetzbuch Schweiz", file: "ch/stgb.md" },
  zgb:     { jurisdiction: "ch", label: "ZGB — Zivilgesetzbuch (CH)", file: "ch/zgb.md" },
};

const CORPUS_DIR = path.join(process.cwd(), "law-corpus");
const CORPUS_SPLIT_DIR = path.join(process.cwd(), "law-corpus-split");

// ── Citation types ────────────────────────────────────────────────────

interface RawCitation {
  code?: string;
  paragraph?: string;
  context?: string;
}

interface GroundedCitation {
  code: string;
  paragraph: string;
  context: string;
  verified: boolean;
  source_text?: string;
  source_file?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function normalizeStatuteCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
}

/**
 * Look up a statute paragraph in the split corpus directory.
 * Reads the pre-split .md file for the given statute + paragraph.
 * Returns the paragraph body text or null if not found.
 */
async function lookupSplitParagraph(
  code: string,
  paragraph: string,
): Promise<string | null> {
  const normalized = normalizeStatuteCode(code);
  // Try common variants (abgb, bgb, stgb, etc.)
  const canonicalKey = Object.keys(CORPUS_META).find(
    (k) =>
      k === normalized ||
      k === normalized.replace(/_at$/, "_at") ||
      CORPUS_META[k].label.toLowerCase().includes(code.toLowerCase()),
  );

  const abbr = canonicalKey
    ? CORPUS_META[canonicalKey].label.match(/^([A-Z][A-Za-zÄÖÜ]+)/)?.[1] || code.toUpperCase()
    : code.toUpperCase();

  const jur = canonicalKey ? CORPUS_META[canonicalKey].jurisdiction : "de";
  const paraClean = paragraph.replace(/^§\s*/, "").trim();
  const slug = `${abbr.toLowerCase()}-par-${paraClean.toLowerCase()}`;
  const splitPath = path.join(CORPUS_SPLIT_DIR, jur, `${slug}.md`);

  try {
    const content = await fs.readFile(splitPath, "utf8");
    // Strip frontmatter
    if (content.startsWith("---")) {
      const end = content.indexOf("---", 3);
      return end !== -1 ? content.slice(end + 3).trimStart() : content;
    }
    return content;
  } catch {
    return null;
  }
}

/**
 * Fallback: search the original corpus file for a paragraph.
 * Used when split corpus is not available.
 */
async function lookupCorpusParagraph(
  codeKey: string,
  paragraph: string,
): Promise<string | null> {
  const meta = CORPUS_META[codeKey];
  if (!meta) return null;

  try {
    const text = await fs.readFile(path.join(CORPUS_DIR, meta.file), "utf8");
    const paraNum = paragraph.replace(/^§\s*/, "").trim();

    // DE: search for `## § N` heading
    const deMatch = text.match(
      new RegExp(`## § ${paraNum}[^\\n]*\\n([\\s\\S]{0,1500}?)(?=\\n## §|$)`),
    );
    if (deMatch) return deMatch[1].trim();

    // AT: search for inline `§ N.`
    const atIdx = text.search(new RegExp(`§\\s*${paraNum}\\.`));
    if (atIdx !== -1) {
      const nextAt = text.search(new RegExp(`§\\s*${String(Number(paraNum) + 1)}\\.`));
      const end = nextAt !== -1 ? nextAt : atIdx + 1000;
      return text.slice(atIdx, end).slice(0, 800).trim();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Ground AI-extracted citations against the actual corpus.
 * Returns citations with verified=true only when the paragraph
 * actually exists in our corpus.  Unverified citations are still
 * returned but marked verified=false so the UI can flag them.
 */
async function groundCitations(
  rawCitations: RawCitation[],
): Promise<GroundedCitation[]> {
  const results: GroundedCitation[] = [];

  for (const cite of rawCitations.slice(0, 20)) {
    if (!cite.code || !cite.paragraph) continue;

    const code = String(cite.code).trim();
    const paragraph = String(cite.paragraph).trim();
    const context = String(cite.context || "").trim();

    // 1. Try split corpus (fast, exact)
    let sourceText = await lookupSplitParagraph(code, paragraph);

    // 2. Fallback: original corpus file (slower, regex-based)
    if (!sourceText) {
      const normalized = normalizeStatuteCode(code);
      const codeKey = Object.keys(CORPUS_META).find(
        (k) =>
          k === normalized ||
          CORPUS_META[k].label.toUpperCase().startsWith(code.toUpperCase()),
      );
      if (codeKey) {
        sourceText = await lookupCorpusParagraph(codeKey, paragraph);
      }
    }

    results.push({
      code,
      paragraph,
      context,
      verified: sourceText !== null,
      ...(sourceText ? { source_text: sourceText.slice(0, 600) } : {}),
    });
  }

  return results;
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    return {};
  }
}

function buildEmptyResult(reason: string): Record<string, unknown> {
  return {
    document_type: "unknown",
    type_confidence: 0,
    parties: [],
    deadlines: [],
    cited_statutes: [],
    risks: [],
    action_items: [],
    summary: reason,
    language: "de",
  };
}

function buildAnalysisPrompt(text: string, jurisdiction: string): string {
  const jurHint =
    jurisdiction === "all"
      ? "AT (Österreich), DE (Deutschland) oder CH (Schweiz)"
      : jurisdiction.toUpperCase();

  return `Du bist ein österreichischer/deutscher Rechtsexperte. Analysiere das folgende Rechtsdokument.

KRITISCHE REGEL: Du darfst KEINE Gesetzesnormen erfinden oder raten. Nenne AUSSCHLIESSLICH §-Paragraphen, die EXPLIZIT im Dokument genannt werden oder sich zwingend logisch aus dem Dokumenttyp ergeben (Kaufvertrag → § 433 BGB, Gewährleistung → § 922 ABGB, etc.).

Antworte AUSSCHLIESSLICH als gültiges JSON ohne Markdown-Codeblock, keine anderen Zeichen außerhalb des JSON.

Dokument:
---
${text}
---

Rechtsordnung: ${jurHint}

Extrahiere:
1. document_type: Kaufvertrag | Mietvertrag | Arbeitsvertrag | Gerichtsurteil | Schriftsatz | Mahnschreiben | Anwaltsschreiben | Rechnung | Gesetzesentwurf | Korrespondenz | sonstiges
2. type_confidence: 0.0–1.0 (wie sicher bist du beim document_type)
3. parties: Vollständige Namen der Beteiligten (Klient, Gegner, Gericht, Behörde)
4. deadlines: Fristen und Daten aus dem Dokument
5. cited_statutes: Nur §§ die im Dokument stehen ODER zwingend anwendbar sind
6. risks: Konkrete rechtliche Risiken mit Schweregrad
7. action_items: Nächste konkrete Schritte für den Anwalt
8. summary: 2-3 präzise Sätze
9. language: de | en | other

Antworte JETZT mit reinem JSON:
{
  "document_type": "string",
  "type_confidence": 0.0,
  "parties": [{"name":"string","role":"Klient|Gegner|Gericht|Behörde|Zeuge|sonstige"}],
  "deadlines": [{"label":"string","date":"string","urgency":"critical|normal","source":"exact quote from document"}],
  "cited_statutes": [{"code":"string","paragraph":"string","context":"why this statute applies"}],
  "risks": [{"severity":"high|medium|low","description":"string","mitigation":"string"}],
  "action_items": ["string"],
  "summary": "string",
  "language": "string"
}`;
}

// ── Route handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Determine auth: internal service call vs. authenticated user session
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal =
    Boolean(INTERNAL_SECRET) &&
    internalSecret === INTERNAL_SECRET;

  let engineHeaders: Record<string, string> = {};

  if (!isInternal) {
    const ctx = await requireEngineContext(req, "legal.document_review", "heavy", "queries");
    if (ctx instanceof Response) return ctx;
    engineHeaders = ctx.headers;
  } else {
    // Internal: build engine headers from environment
    const apiKey =
      process.env.SIGMABRAIN_WEB_API_KEY || process.env.GBRAIN_WEB_API_KEY || "";
    engineHeaders = apiKey ? { "x-sigmabrain-api-key": apiKey } : {};
  }

  const configError = engineConfigurationResponse();
  if (configError) return configError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const documentSlug =
    typeof body.document_slug === "string" ? body.document_slug.trim() : "";
  const jurisdiction =
    typeof body.jurisdiction === "string" ? body.jurisdiction.toLowerCase() : "all";
  const brainId =
    typeof body.brain_id === "string" ? body.brain_id : "";

  if (brainId) {
    engineHeaders = { ...engineHeaders, "x-sigmabrain-source": brainId };
  }

  // 1. Fetch document text from Brain engine
  let text = "";
  if (documentSlug) {
    try {
      const pageRes = await fetch(
        `${ENGINE_URL}/api/pages/${encodeURIComponent(documentSlug)}`,
        { headers: engineHeaders },
      );
      if (pageRes.ok) {
        const page = (await pageRes.json()) as { content?: string; title?: string };
        text = [page.title, page.content].filter(Boolean).join("\n\n");
      }
    } catch { /* best-effort */ }
  }

  if (!text && typeof body.text === "string") {
    text = body.text;
  }

  if (!text.trim()) {
    return Response.json({ error: "document_not_found_or_empty" }, { status: 404 });
  }

  // 2. Truncate to ~80k chars (≈ 20-25k tokens, safe for gpt-4)
  const MAX_CHARS = 80_000;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n\n[... document truncated for analysis]";
  }

  // 3. AI analysis via engine /api/think
  let parsed: Record<string, unknown>;
  try {
    const thinkRes = await fetch(`${ENGINE_URL}/api/think`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...engineHeaders },
      body: JSON.stringify({
        prompt: buildAnalysisPrompt(text, jurisdiction),
        mode: "json",
        max_tokens: 4000,
      }),
    });

    if (!thinkRes.ok) {
      throw new Error(`Engine think ${thinkRes.status}`);
    }

    const thinkData = (await thinkRes.json()) as { answer?: string };
    parsed = safeParseJson(thinkData.answer || "{}");
  } catch (err) {
    console.error("[analyze] AI step failed:", err instanceof Error ? err.message : String(err));
    return Response.json(buildEmptyResult("Analyse fehlgeschlagen — Engine nicht verfügbar."));
  }

  // 4. Ground cited_statutes against actual corpus (anti-hallucination)
  const rawCitations = Array.isArray(parsed.cited_statutes)
    ? (parsed.cited_statutes as RawCitation[])
    : [];

  const groundedCitations = await groundCitations(rawCitations);
  parsed.cited_statutes = groundedCitations;

  // Add grounding summary for transparency
  const verified = groundedCitations.filter((c) => c.verified).length;
  const unverified = groundedCitations.filter((c) => !c.verified).length;
  parsed._grounding = {
    citations_verified: verified,
    citations_unverified: unverified,
    corpus_checked: true,
    analyzed_at: new Date().toISOString(),
  };

  // 5. Store analysis as page metadata (best-effort, non-blocking)
  if (documentSlug) {
    void (async () => {
      try {
        await fetch(
          `${ENGINE_URL}/api/pages/${encodeURIComponent(documentSlug)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...engineHeaders },
            body: JSON.stringify({
              meta: {
                auto_analysis: parsed,
                analyzed_at: new Date().toISOString(),
              },
            }),
          },
        );
      } catch { /* best-effort */ }
    })();
  }

  return Response.json(parsed);
}
