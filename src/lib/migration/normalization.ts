/**
 * WP-410: Migration Framework v1 — Normalization.
 *
 * Deterministic normalization of imported items into SigmaBrain records.
 * Each source has its own normalization rules:
 *   - Notion: strip Notion-specific markers, extract blocks to markdown
 *   - Obsidian: preserve wikilinks, convert frontmatter to tags
 *   - Confluence: convert storage format to markdown, preserve page hierarchy
 *   - Markdown: pass-through with frontmatter extraction
 *   - CSV: each row becomes a separate record
 */

import type { ImportItem, NormalizedRecord, ImportSource } from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  // YAML frontmatter tags
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const tagLine = fmMatch[1].match(/tags?:\s*\[(.*?)\]/i);
    if (tagLine) {
      tags.push(...tagLine[1].split(",").map((t) => t.trim().replace(/['"]/g, "")));
    }
  }
  // Inline #tags (Obsidian style)
  const inlineTags = content.match(/(?:^|\s)#([a-zA-Z][a-zA-Z0-9-]*)/g);
  if (inlineTags) {
    tags.push(...inlineTags.map((t) => t.trim().replace(/^#/, "")));
  }
  return [...new Set(tags)].filter(Boolean);
}

function stripNotionMarkers(content: string): string {
  return content
    .replace(/\/notion\//g, "")
    .replace(/\{.*?\}/g, "")
    .replace(/type:\s*\w+/g, "")
    .trim();
}

function stripConfluenceStorage(content: string): string {
  return content
    .replace(/<ac:structured-macro[^>]*>[\s\S]*?<\/ac:structured-macro>/gi, "")
    .replace(/<ac:parameter[^>]*>[\s\S]*?<\/ac:parameter>/gi, "")
    .replace(/<ri:attachment[^>]*\/>/gi, "")
    .replace(/<ri:user[^>]*\/>/gi, "")
    .replace(/<\/?(ac|ri):[^>]*>/gi, "")
    .replace(/<p>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<h([1-6])>/g, (_, level) => `\n${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]>/g, "\n")
    .replace(/<li>/g, "- ")
    .replace(/<\/li>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForSource(item: ImportItem, source: ImportSource): NormalizedRecord {
  const slug = slugify(item.title);
  let normalizedContent = item.content;
  let tags: string[] = [];

  switch (source) {
    case "notion":
      normalizedContent = stripNotionMarkers(item.content);
      tags = extractTags(normalizedContent);
      break;
    case "obsidian":
      // Preserve wikilinks, extract tags
      tags = extractTags(item.content);
      // Don't strip frontmatter — keep it as metadata
      break;
    case "confluence":
      normalizedContent = stripConfluenceStorage(item.content);
      tags = extractTags(normalizedContent);
      break;
    case "markdown":
      tags = extractTags(item.content);
      break;
    case "csv":
      // CSV content is already plain text
      normalizedContent = item.content;
      break;
  }

  return {
    slug,
    title: item.title.trim(),
    content: normalizedContent,
    source,
    sourceId: item.sourceId,
    sourceUrl: item.sourceUrl,
    parentSlug: item.parentSourceId ? slugify(item.parentSourceId) : undefined,
    tags,
    importedAt: new Date().toISOString(),
  };
}

export function normalizeItem(item: ImportItem, source: ImportSource): NormalizedRecord {
  return normalizeForSource(item, source);
}

export function normalizeBatch(items: ImportItem[], source: ImportSource): NormalizedRecord[] {
  return items.map((item) => normalizeItem(item, source));
}

export { slugify, extractTags };
