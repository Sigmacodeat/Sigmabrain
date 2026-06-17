import { NextRequest } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import path from "node:path";
import { promises as fs } from "node:fs";

export const dynamic = "force-dynamic";

/** All statutes available in the bundled law-corpus. */
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

/** Read and search a statute file for paragraph matches. */
async function searchStatute(
  fileKey: string,
  query: string,
  paragraph?: string,
): Promise<{ excerpt: string; paragraphHit?: string }[]> {
  const meta = CORPUS_META[fileKey];
  if (!meta) return [];

  const fullPath = path.join(CORPUS_DIR, meta.file);
  let text: string;
  try {
    text = await fs.readFile(fullPath, "utf8");
  } catch {
    return [];
  }

  const lines = text.split("\n");
  const results: { excerpt: string; paragraphHit?: string }[] = [];
  const queryLower = query.toLowerCase();

  // Find paragraph sections (e.g., ## § 42, ## Art. 15, ## § 433 BGB)
  const SECTION_RE = /^#{1,4}\s*(?:§|Art\.?|Artikel)\s*(\d+[a-z]?)/i;
  let currentSection = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (currentLines.length === 0) return;
    const block = currentLines.join("\n");
    const matches =
      (paragraph && currentSection.includes(paragraph)) ||
      (!paragraph && block.toLowerCase().includes(queryLower));
    if (matches) {
      results.push({
        excerpt: block.slice(0, 1200).trim(),
        paragraphHit: currentSection || undefined,
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const secMatch = line.match(SECTION_RE);
    if (secMatch) {
      flush();
      currentSection = secMatch[0].replace(/^#+\s*/, "").trim();
    }
    currentLines.push(line);
    if (results.length >= 10) break;
  }
  flush();

  return results.slice(0, 10);
}

/**
 * GET /api/legal/statute?code=bgb&paragraph=433&q=Kaufvertrag
 * Search for a specific statute paragraph or keyword in the bundled law corpus.
 *
 * Params:
 *   code        string   required  Statute key: bgb, abgb, zpo, hgb, etc.
 *   paragraph   string   optional  Paragraph number: "433", "1295", "Art. 15"
 *   q           string   optional  Free text search within the statute
 *   jurisdiction string  optional  Filter by "at" | "de" | "ch" (returns all matching statutes)
 *
 * GET /api/legal/statute — without code: returns list of all available statutes.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("legal.judgements");
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.toLowerCase() || "";
  const paragraph = searchParams.get("paragraph") || searchParams.get("para") || "";
  const query = searchParams.get("q") || searchParams.get("query") || "";
  const jurisdictionFilter = searchParams.get("jurisdiction") || "";

  // No code → list available statutes
  if (!code) {
    const list = Object.entries(CORPUS_META)
      .filter(([, m]) => !jurisdictionFilter || m.jurisdiction === jurisdictionFilter)
      .map(([key, m]) => ({ code: key, label: m.label, jurisdiction: m.jurisdiction }));
    return Response.json({ statutes: list, total: list.length });
  }

  if (!CORPUS_META[code]) {
    const available = Object.keys(CORPUS_META);
    return Response.json({ error: "unknown_statute", code, available }, { status: 400 });
  }
  if (!paragraph && !query) {
    return Response.json(
      { error: "paragraph_or_q_required", hint: "?code=bgb&paragraph=433 or ?code=bgb&q=Kaufvertrag" },
      { status: 400 },
    );
  }

  const hits = await searchStatute(code, query || paragraph, paragraph || undefined);
  if (hits.length === 0) {
    return Response.json({ results: [], total: 0, statute: CORPUS_META[code].label });
  }

  return Response.json({
    statute: CORPUS_META[code].label,
    jurisdiction: CORPUS_META[code].jurisdiction,
    query: query || undefined,
    paragraph: paragraph || undefined,
    results: hits,
    total: hits.length,
  });
}
