/**
 * Bulk import split statute pages into the Brain engine.
 *
 * Reads law-corpus-split/{de,at,ch}/ and POSTs each .md as a page.
 * Requires a running engine and either:
 *   - SIGMABRAIN_WEB_API_KEY env var (service-to-service)
 *   - A valid user session (interactive, slower)
 *
 * Usage on the engine host (e.g. Hetzner prod):
 *   bun server/scripts/import-statutes.ts [--engine http://localhost:3001] [--key KEY] [--brain law] [--source law-de|law-at|law-all]
 *
 * The script is idempotent: re-running updates existing pages by slug.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ENGINE = process.argv.includes("--engine")
  ? process.argv[process.argv.indexOf("--engine") + 1]
  : (process.env.SIGMABRAIN_API_URL || process.env.GBRAIN_API_URL || "http://localhost:3001");

const API_KEY = process.argv.includes("--key")
  ? process.argv[process.argv.indexOf("--key") + 1]
  : (process.env.SIGMABRAIN_WEB_API_KEY || process.env.GBRAIN_WEB_API_KEY || "");

const BRAIN = process.argv.includes("--brain")
  ? process.argv[process.argv.indexOf("--brain") + 1]
  : (process.env.IMPORT_BRAIN_ID || "law");

const SOURCE_ARG = process.argv.includes("--source")
  ? process.argv[process.argv.indexOf("--source") + 1]
  : "law-all";

interface ImportResult { ok: boolean; slug: string; error?: string }

function parseFrontmatter(text: string): Record<string, string> {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("---", 3);
  if (end === -1) return {};
  const raw = text.slice(3, end).trim();
  const fm: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return fm;
}

async function importPage(path: string): Promise<ImportResult> {
  const text = readFileSync(path, "utf8");
  const fm = parseFrontmatter(text);
  const slug = fm.slug || join("law", fm.jurisdiction || "unknown", fm.abbreviation?.toLowerCase() || "unknown", (fm.paragraph || "").replace(/\s+/g, ""));
  const title = fm.title || slug;
  const body = text.slice(text.indexOf("---", 3) + 3).trimStart();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-sigmabrain-source": BRAIN,
  };
  if (API_KEY) headers["x-sigmabrain-api-key"] = API_KEY;

  const payload = {
    slug,
    title,
    content: body,
    type: fm.type || "law",
    jurisdiction: fm.jurisdiction,
    abbreviation: fm.abbreviation,
    paragraph: fm.paragraph,
    parent_law: fm.parent_law,
    version_date: fm.version_date,
    source_url: fm.source_url,
    license: fm.license,
    tags: ["statute", fm.jurisdiction, fm.abbreviation?.toLowerCase()].filter(Boolean),
    source: SOURCE_ARG,
  };

  try {
    const res = await fetch(`${ENGINE}/api/pages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok || res.status === 409) {
      // 409 = page already exists (idempotent)
      return { ok: true, slug };
    }
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    return { ok: false, slug, error: err };
  } catch (e) {
    return { ok: false, slug, error: e instanceof Error ? e.message : String(e) };
  }
}

async function ensureSource(): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-sigmabrain-source": BRAIN,
  };
  if (API_KEY) headers["x-sigmabrain-api-key"] = API_KEY;

  try {
    const res = await fetch(`${ENGINE}/api/sources`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: SOURCE_ARG, name: SOURCE_ARG, public: true }),
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error("ERROR: No API key. Set SIGMABRAIN_WEB_API_KEY or pass --key");
    process.exit(1);
  }

  console.log(`Engine: ${ENGINE}`);
  console.log(`Brain:  ${BRAIN}`);
  console.log(`Source: ${SOURCE_ARG}`);
  console.log("");

  // Verify engine reachable
  try {
    const health = await fetch(`${ENGINE}/api/health`, { method: "GET" });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    console.log("Engine: OK");
  } catch {
    console.error("ERROR: Engine not reachable. Start it first: gbrain serve");
    process.exit(1);
  }

  // Ensure source exists
  console.log("Ensuring source...");
  const sourceOk = await ensureSource();
  if (!sourceOk) console.warn("Warning: could not create source (may already exist)");

  // Collect files
  const dirs = ["de", "at", "ch"];
  const files: string[] = [];
  for (const d of dirs) {
    const dir = join("law-corpus-split", d);
    try {
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".md")) files.push(join(dir, f));
      }
    } catch { /* skip missing */ }
  }

  console.log(`Importing ${files.length} pages...\n`);

  let ok = 0;
  let fail = 0;
  const batch = 10;

  for (let i = 0; i < files.length; i += batch) {
    const chunk = files.slice(i, i + batch);
    const results = await Promise.all(chunk.map(importPage));
    for (const r of results) {
      if (r.ok) ok++;
      else {
        fail++;
        if (fail <= 5) console.error(`  FAIL ${r.slug}: ${r.error}`);
      }
    }
    if ((i + batch) % 100 === 0 || i + batch >= files.length) {
      console.log(`  ${Math.min(i + batch, files.length)}/${files.length} done (ok=${ok}, fail=${fail})`);
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
