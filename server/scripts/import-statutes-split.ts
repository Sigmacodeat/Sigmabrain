#!/usr/bin/env bun
/**
 * Import AT/DE/CH statutes from law-corpus/ into the brain — ONE PAGE PER §.
 *
 *   bun run server/scripts/import-statutes-split.ts [--only estg,bao] [--no-embed]
 *                                                   [--db <path>] [--dry-run]
 *
 * Unlike import-statutes.ts (one monolithic page per law — too large to embed),
 * this splits each code into per-§ pages via src/core/legal/split-statute.ts so
 * each paragraph is an independently embeddable, retrievable unit. That is what
 * steuer-subsumption / legal-subsumption need: retrieve the exact §, not the
 * whole code.
 *
 *   slug: legal/statutes/<jur>/<abbr>/<section-id>   e.g. legal/statutes/de/estg/p-15
 *   type: law   (classified by gbrain-legal / gbrain-tax packs)
 *
 * --dry-run prints the section counts without touching a DB (no engine needed).
 * --db <path> targets a throwaway brain instead of the configured ~/.gbrain.
 *
 * HONESTY SCOPE (mirrors /compare): citable statute text with a version stamp.
 * Not legal research à la beck-online (no Kommentare / Rechtsprechungsketten);
 * the brain still never computes legal conclusions — answers cite §§.
 */

import { join } from "path";
import { splitStatute } from "../src/core/legal/split-statute.ts";

const args = Bun.argv.slice(2);
const NO_EMBED = args.includes("--no-embed");
const DRY = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx !== -1 ? new Set(args[onlyIdx + 1].split(",").map((s) => s.trim().toLowerCase())) : null;
const dbIdx = args.indexOf("--db");
const DB_OVERRIDE = dbIdx !== -1 ? args[dbIdx + 1] : null;

const CORPUS = join(import.meta.dir, "..", "..", "law-corpus");

interface StatuteFile {
  file: string; // relative to law-corpus/
  abbr: string; // slug segment, lowercase
  jurisdiction: "at" | "de" | "ch";
}

const FILES: StatuteFile[] = [
  // AT
  { file: "at/abgb.md", abbr: "abgb", jurisdiction: "at" },
  { file: "at/ahg.md", abbr: "ahg", jurisdiction: "at" },
  { file: "at/bao.md", abbr: "bao", jurisdiction: "at" },
  { file: "at/eo.md", abbr: "eo", jurisdiction: "at" },
  { file: "at/stgb-at.md", abbr: "stgb", jurisdiction: "at" },
  { file: "at/stpo-at.md", abbr: "stpo", jurisdiction: "at" },
  { file: "at/ugb.md", abbr: "ugb", jurisdiction: "at" },
  { file: "at/zpo-at.md", abbr: "zpo", jurisdiction: "at" },
  // DE
  { file: "de/ao.md", abbr: "ao", jurisdiction: "de" },
  { file: "de/bgb.md", abbr: "bgb", jurisdiction: "de" },
  { file: "de/estg.md", abbr: "estg", jurisdiction: "de" },
  { file: "de/famfg.md", abbr: "famfg", jurisdiction: "de" },
  { file: "de/gg.md", abbr: "gg", jurisdiction: "de" },
  { file: "de/gmbhg.md", abbr: "gmbhg", jurisdiction: "de" },
  { file: "de/hgb.md", abbr: "hgb", jurisdiction: "de" },
  { file: "de/inso.md", abbr: "inso", jurisdiction: "de" },
  { file: "de/stgb.md", abbr: "stgb", jurisdiction: "de" },
  { file: "de/stpo.md", abbr: "stpo", jurisdiction: "de" },
  { file: "de/ustg.md", abbr: "ustg", jurisdiction: "de" },
  { file: "de/uwg.md", abbr: "uwg", jurisdiction: "de" },
  { file: "de/zpo.md", abbr: "zpo", jurisdiction: "de" },
  // CH
  { file: "ch/or.md", abbr: "or", jurisdiction: "ch" },
  { file: "ch/zgb.md", abbr: "zgb", jurisdiction: "ch" },
  { file: "ch/stgb.md", abbr: "stgb", jurisdiction: "ch" },
];

function yamlEscape(v: string): string {
  return JSON.stringify(v);
}

/** Build the per-§ page markdown (frontmatter + heading + body). */
function sectionPage(
  sf: StatuteFile,
  meta: { abbreviation?: string; title?: string; version_date?: string; source_url?: string; license?: string },
  section: { marker: "§" | "Art."; ref: string; title: string; body: string },
): string {
  const abbr = meta.abbreviation || sf.abbr.toUpperCase();
  const head = `${section.marker} ${section.ref} ${abbr}`;
  const heading = section.title ? `${head} — ${section.title}` : head;
  const fm: Record<string, string> = {
    title: heading,
    type: "law",
    jurisdiction: sf.jurisdiction,
    abbreviation: abbr,
    paragraph: section.ref,
    statute: meta.title || abbr,
  };
  if (meta.version_date) fm.version_date = meta.version_date;
  if (meta.source_url) fm.source_url = meta.source_url;
  if (meta.license) fm.license = meta.license;
  const front = `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`).join("\n")}\n---\n`;
  return `${front}\n# ${heading}\n\n${section.body}\n`;
}

async function main() {
  const selected = FILES.filter((f) => !ONLY || ONLY.has(f.abbr) || ONLY.has(f.file.replace("/", ":")));

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SigmaBrain — Gesetze-Import (pro § / per-paragraph)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Mode: ${DRY ? "DRY-RUN (kein DB-Write)" : NO_EMBED ? "import, no-embed" : "import + embed"}`);
  console.log("");

  // Lazy-load the engine only when actually importing — keeps --dry-run dependency-free.
  let engine: any = null;
  if (!DRY) {
    const { PGLiteEngine } = await import("../src/core/pglite-engine.ts");
    const { loadConfig } = await import("../src/core/config.ts");
    const { importFromContent } = await import("../src/core/import-file.ts");
    engine = new PGLiteEngine();
    const dbPath = DB_OVERRIDE ?? loadConfig()?.database_path;
    await engine.connect({ database_path: dbPath });
    await engine.initSchema();
    // expose for the loop
    (globalThis as any).__importFromContent = importFromContent;
  }

  let totalSections = 0;
  let totalErrors = 0;

  for (const sf of selected) {
    const path = join(CORPUS, sf.file);
    let raw: string;
    try {
      raw = await Bun.file(path).text();
    } catch {
      console.error(`  ❌ ${sf.file}: not found`);
      totalErrors++;
      continue;
    }
    const { meta, sections } = splitStatute(raw);
    if (sections.length === 0) {
      console.error(`  ⚠️  ${sf.file}: 0 sections parsed (unexpected format?)`);
      continue;
    }

    if (DRY) {
      console.log(`  ${sf.jurisdiction}/${sf.abbr}: ${sections.length} §-sections`);
      totalSections += sections.length;
      continue;
    }

    const importFromContent = (globalThis as any).__importFromContent;
    let okForLaw = 0;
    for (const section of sections) {
      const slug = `legal/statutes/${sf.jurisdiction}/${sf.abbr}/${section.id}`;
      try {
        await importFromContent(engine, slug, sectionPage(sf, meta, section), { noEmbed: NO_EMBED });
        okForLaw++;
      } catch (e) {
        totalErrors++;
        console.error(`  ❌ ${slug}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    totalSections += okForLaw;
    console.log(`  ✅ ${sf.jurisdiction}/${sf.abbr}: ${okForLaw}/${sections.length} §-pages`);
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  GESAMT: ${totalSections} §-Seiten${DRY ? " (dry-run)" : " importiert"}, ${totalErrors} Fehler`);
  console.log("═══════════════════════════════════════════════════════════");
  if (!DRY && NO_EMBED) {
    console.log("⚠️  Embedding übersprungen. Nachholen: bun run server/scripts/auto-embed-pending.ts");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
