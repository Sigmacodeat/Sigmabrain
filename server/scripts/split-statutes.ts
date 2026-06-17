/**
 * Statute splitter for law corpus.
 *
 * DE: splits at `## § N — Title` headings -> one .md file per paragraph
 * AT/CH: keeps whole (one file = one page) until fetcher produces clean markdown
 *
 *   bun server/scripts/split-statutes.ts [--out law-corpus-split]
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "law-corpus-split";

interface LawFrontmatter {
  title: string;
  type: string;
  jurisdiction: string;
  abbreviation: string;
  version_date: string;
  retrieved_at: string;
  source_url: string;
  license: string;
}

function parseFrontmatter(text: string): { fm: LawFrontmatter; body: string } {
  if (!text.startsWith("---")) {
    throw new Error("Missing frontmatter");
  }
  const end = text.indexOf("---", 3);
  if (end === -1) throw new Error("Unclosed frontmatter");
  const raw = text.slice(3, end).trim();
  const fm: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  const body = text.slice(end + 3).trimStart();
  return { fm: fm as unknown as LawFrontmatter, body };
}

function slugifyPara(num: string): string {
  return num.replace(/\s+/g, "").toLowerCase();
}

function splitDeLaw(filePath: string, outDir: string): { count: number } {
  const text = readFileSync(filePath, "utf8");
  const { fm, body } = parseFrontmatter(text);
  const abbr = fm.abbreviation;

  // Find all `## § N[optional] — Title` headings
  const headingRe = /^##\s+\u00A7\s*(\d+[a-z]?)\s*(?:[\u2014\u2013-]\s*(.+))?$/gm;
  const matches = [...body.matchAll(headingRe)];

  if (matches.length === 0) {
    // Fallback: write whole file
    const slug = basename(filePath, ".md");
    writeFileSync(join(outDir, `${slug}.md`), text);
    return { count: 1 };
  }

  let written = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const paraNum = m[1];
    const paraTitle = (m[2] || "").trim();
    const start = m.index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const paraBody = body.slice(start, end).trim();

    const slug = `${abbr.toLowerCase()}-par-${slugifyPara(paraNum)}`;
    const title = `${abbr} \u00A7 ${paraNum}${paraTitle ? ` — ${paraTitle}` : ""}`;
    const pageFm = [
      "---",
      `title: "${title}"`,
      `type: law`,
      `jurisdiction: ${fm.jurisdiction}`,
      `abbreviation: ${abbr}`,
      `parent_law: ${fm.title}`,
      `paragraph: "${paraNum}"`,
      `version_date: ${fm.version_date}`,
      `retrieved_at: ${fm.retrieved_at}`,
      `source_url: ${fm.source_url}`,
      `license: ${fm.license}`,
      "---",
      "",
      paraBody,
    ].join("\n");

    writeFileSync(join(outDir, `${slug}.md`), pageFm);
    written++;
  }

  return { count: written };
}

function copyWholeLaw(filePath: string, outDir: string): { count: number } {
  const text = readFileSync(filePath, "utf8");
  const slug = basename(filePath, ".md");
  writeFileSync(join(outDir, `${slug}.md`), text);
  return { count: 1 };
}

// ── Main ──────────────────────────────────────────────────────────────

const jurisdictions = ["de", "at", "ch"];
let total = 0;
let splitCount = 0;
let wholeCount = 0;

for (const j of jurisdictions) {
  const dir = join("law-corpus", j);
  const outDir = join(OUT, j);
  mkdirSync(outDir, { recursive: true });

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const path = join(dir, file);

    if (j === "de") {
      const { count } = splitDeLaw(path, outDir);
      total += count;
      splitCount += count;
      console.log(`  ${j}/${file} -> ${count} paragraph pages`);
    } else {
      const { count } = copyWholeLaw(path, outDir);
      total += count;
      wholeCount += count;
      console.log(`  ${j}/${file} -> 1 whole page`);
    }
  }
}

console.log(`\nDone: ${total} pages (${splitCount} split paragraphs, ${wholeCount} whole)`);
console.log(`Output: ${OUT}/`);
