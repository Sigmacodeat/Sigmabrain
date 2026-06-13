/**
 * split-statute — turn a monolithic statute markdown (one file per law, as
 * produced by scripts/ingest-law-corpus.ts) into one section per paragraph (§).
 *
 * WHY: a whole code (EStG ≈ 1.1 MB) imported as a single page is too large to
 * embed — it lands keyword-only and the subsumption skills retrieve the entire
 * code instead of the relevant §. Splitting per § makes each paragraph an
 * independently embeddable, retrievable unit, which is what
 * steuer-subsumption / legal-subsumption actually need.
 *
 * Pure + deterministic: no I/O, no engine. The importer
 * (scripts/import-statutes-split.ts) does the I/O and calls importFromContent
 * per section. Unit-tested in test/split-statute.test.ts.
 *
 * Statute markdown shape (from the official-source ingester):
 *
 *   ---
 *   title: "EStG — Einkommensteuergesetz"
 *   type: "law"
 *   jurisdiction: "de"
 *   abbreviation: "EStG"
 *   ...
 *   ---
 *
 *   ## Inhaltsübersicht
 *   ...table of contents...
 *
 *   ## § 1 — Steuerpflicht
 *   (1) ...
 *
 *   ## § 1a
 *   ...
 */

export interface StatuteMeta {
  title?: string;
  jurisdiction?: string;
  abbreviation?: string;
  version_date?: string;
  retrieved_at?: string;
  source_url?: string;
  license?: string;
}

export interface StatuteSection {
  /** Section marker, normalized: "§" (DE/AT codes) or "Art." (CH OR/ZGB, GG). */
  marker: "§" | "Art.";
  /** Raw paragraph/article reference as printed, e.g. "1", "1a", "4h", "29 und 30". */
  ref: string;
  /** Slug-safe id for the section, e.g. "p-1", "p-1a", "p-29-30", "art-1". */
  id: string;
  /** Optional heading title, e.g. "Steuerpflicht", "Vertragsfreiheit". */
  title: string;
  /** The section body text (without the heading line). */
  body: string;
}

export interface SplitStatuteResult {
  meta: StatuteMeta;
  sections: StatuteSection[];
}

/** Minimal, dependency-free YAML-frontmatter reader for the flat string maps
 *  the statute ingester emits (key: "value"). Not a general YAML parser. */
function parseFrontmatter(raw: string): { meta: StatuteMeta; bodyStart: number } {
  if (!raw.startsWith("---")) return { meta: {}, bodyStart: 0 };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, bodyStart: 0 };
  const block = raw.slice(3, end);
  const meta: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[m[1]] = v;
  }
  // bodyStart = position just after the closing "---" line.
  const afterClose = raw.indexOf("\n", end + 1);
  return { meta: meta as StatuteMeta, bodyStart: afterClose === -1 ? raw.length : afterClose + 1 };
}

/** A section heading: `## § …` (DE/AT codes) or `## Art. …` / `## Art …`
 *  (CH OR/ZGB/StGB, German Grundgesetz). Captures the marker and the rest.
 *  Handles single (§ 1a / Art. 8), and ranges/lists (§§ 29 und 30). */
const SECTION_HEADING = /^##\s+(§+|Art\.?)\s+(.+?)\s*$/;

/** Extract the bare ref + title from a heading's text after the marker.
 *  Works for "1 — Steuerpflicht" (DE em-dash), "1 Vertragsfreiheit" (CH plain),
 *  "2" (GG, no title) and "29 und 30 — (weggefallen)" (ranges). */
function parseHeading(text: string): { ref: string; title: string } {
  // NOTE: no `i` flag — section letter-suffixes (1a, 4h, 4k) are always
  // lowercase; making [a-z] case-insensitive would slurp a capitalized title
  // word into the ref ("1 Vertragsfreiheit").
  const numMatch = text.match(
    /^(\d+[a-z]*(?:\s*(?:und|bis|,)\s*\d+[a-z]*)*)\s*(.*)$/,
  );
  let ref: string;
  let title: string;
  if (numMatch) {
    ref = numMatch[1].replace(/\s+/g, " ").trim();
    title = numMatch[2].trim();
  } else {
    ref = text.trim();
    title = "";
  }
  // Strip a leading em-dash / hyphen used as "ref — Title".
  title = title.replace(/^[—–-]\s*/, "").trim();
  return { ref, title };
}

/** Turn a ref like "1a" or "29 und 30" into a slug-safe id, prefixed by kind
 *  ("p-" for §, "art-" for Art.): "p-1a", "p-29-30", "art-8". */
function refToId(ref: string, kind: "§" | "Art."): string {
  const slug = ref
    .toLowerCase()
    .replace(/§/g, "")
    .replace(/\b(und|bis|sowie)\b/g, "-")
    .replace(/[,\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const prefix = kind === "Art." ? "art-" : "p-";
  return `${prefix}${slug || "x"}`;
}

/**
 * Split a statute markdown into per-§ sections. Everything before the first
 * `## §` heading (frontmatter + Inhaltsübersicht) is dropped from sections but
 * the frontmatter is returned as `meta`. Sections with an empty body (pure
 * "(weggefallen)" repealed markers still carry their heading line as body)
 * are kept — a repealed § is a legitimate retrieval answer.
 */
export function splitStatute(markdown: string): SplitStatuteResult {
  const { meta, bodyStart } = parseFrontmatter(markdown);
  const lines = markdown.slice(bodyStart).split("\n");

  const sections: StatuteSection[] = [];
  let current: StatuteSection | null = null;
  let buf: string[] = [];
  const seenIds = new Map<string, number>();

  const flush = () => {
    if (current) {
      current.body = buf.join("\n").trim();
      sections.push(current);
    }
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(SECTION_HEADING);
    if (m) {
      flush();
      const marker: "§" | "Art." = m[1].startsWith("§") ? "§" : "Art.";
      const { ref, title } = parseHeading(m[2]);
      let id = refToId(ref, marker);
      // Disambiguate accidental id collisions deterministically.
      const n = seenIds.get(id) ?? 0;
      seenIds.set(id, n + 1);
      if (n > 0) id = `${id}-${n + 1}`;
      current = { marker, ref, id, title, body: "" };
    } else if (current) {
      buf.push(line);
    }
  }
  flush();

  return { meta, sections };
}
