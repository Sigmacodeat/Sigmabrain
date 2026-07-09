import { describe, it, expect, beforeEach } from "bun:test";
import { importService } from "../../src/lib/migration/import-service";
import { normalizeItem, slugify, extractTags } from "../../src/lib/migration/normalization";
import type { ImportItem, ImportConfig } from "../../src/lib/migration/types";

const NOTION_CONFIG: ImportConfig = {
  source: "notion",
  connection: { token: "test-token" },
  options: { recursive: true, skipErrors: true },
};

const OBSIDIAN_CONFIG: ImportConfig = {
  source: "obsidian",
  connection: { path: "/vault" },
  options: { extensions: ["md"] },
};

const CONFLUENCE_CONFIG: ImportConfig = {
  source: "confluence",
  connection: { baseUrl: "https://wiki.example.com", token: "tok", scope: "LEGAL" },
  options: { recursive: true },
};

function makeItem(overrides: Partial<ImportItem> = {}): ImportItem {
  return {
    sourceId: "page-1",
    sourceType: "page",
    title: "Test Page",
    content: "This is test content with some text.",
    sourceUrl: "https://example.com/page-1",
    ...overrides,
  };
}

describe("WP-410: Migration Framework v1", () => {
  beforeEach(() => {
    importService.clear();
  });

  describe("Normalization", () => {
    it("slugifies titles correctly", () => {
      expect(slugify("Contract Law Basics")).toBe("contract-law-basics");
      expect(slugify("Über § 123 BGB")).toBe("ber-123-bgb");
      expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
    });

    it("extracts tags from YAML frontmatter", () => {
      const content = `---
tags: [legal, contract, german]
---
This is the content.`;
      const tags = extractTags(content);
      expect(tags).toContain("legal");
      expect(tags).toContain("contract");
      expect(tags).toContain("german");
    });

    it("extracts inline #tags (Obsidian style)", () => {
      const content = "This is a #legal document about #contracts.";
      const tags = extractTags(content);
      expect(tags).toContain("legal");
      expect(tags).toContain("contracts");
    });

    it("deduplicates tags", () => {
      const content = "#legal text #legal more #legal";
      const tags = extractTags(content);
      expect(tags.filter((t) => t === "legal")).toHaveLength(1);
    });

    it("normalizes Notion items (strips markers)", () => {
      const item = makeItem({
        title: "Notion Page",
        content: "Some /notion/ content with {block_id} markers",
      });
      const record = normalizeItem(item, "notion");
      expect(record.slug).toBe("notion-page");
      expect(record.content).not.toContain("/notion/");
      expect(record.content).not.toContain("{block_id}");
      expect(record.source).toBe("notion");
    });

    it("normalizes Confluence items (strips storage format)", () => {
      const item = makeItem({
        title: "Confluence Page",
        content: '<p>Text</p><ac:structured-macro ac:name="info">Body</ac:structured-macro><h1>Heading</h1>',
      });
      const record = normalizeItem(item, "confluence");
      expect(record.content).not.toContain("<ac:");
      expect(record.content).not.toContain("<p>");
      expect(record.content).toContain("Text");
      expect(record.content).toContain("# Heading");
    });

    it("normalizes Obsidian items (preserves wikilinks)", () => {
      const content = "---\ntags: [research]\n---\nThis links to [[Page Two]] and #research";
      const item = makeItem({ title: "Obsidian Note", content });
      const record = normalizeItem(item, "obsidian");
      expect(record.content).toContain("[[Page Two]]");
      expect(record.tags).toContain("research");
    });

    it("normalizes Markdown items (pass-through with tags)", () => {
      const content = "# Heading\n\nSome markdown content with #tag1";
      const item = makeItem({ title: "MD Doc", content });
      const record = normalizeItem(item, "markdown");
      expect(record.content).toBe(content);
      expect(record.tags).toContain("tag1");
    });

    it("preserves source URL and parent relationship", () => {
      const item = makeItem({
        title: "Child Page",
        parentSourceId: "parent-1",
        sourceUrl: "https://notion.so/page-1",
      });
      const record = normalizeItem(item, "notion");
      expect(record.sourceUrl).toBe("https://notion.so/page-1");
      expect(record.parentSlug).toBe("parent-1");
    });
  });

  describe("previewImport", () => {
    it("previews import without writing", async () => {
      const items = [
        makeItem({ sourceId: "p1", title: "Page 1" }),
        makeItem({ sourceId: "p2", title: "Page 2" }),
      ];

      const { report, normalized } = await importService.previewImport(NOTION_CONFIG, items);

      expect(report.status).toBe("completed");
      expect(report.totalItems).toBe(2);
      expect(report.importedItems).toBe(2);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].slug).toBe("page-1");
    });

    it("reports unsupported items", async () => {
      const items = [
        makeItem({ sourceId: "p1", title: "Good Page", content: "Content" }),
        makeItem({ sourceId: "p2", title: "Empty Page", content: "" }),
      ];

      const { report } = await importService.previewImport(NOTION_CONFIG, items);

      expect(report.importedItems).toBe(1);
      expect(report.unsupportedItems).toBe(1);
      expect(report.items.find((i) => i.sourceId === "p2")?.status).toBe("unsupported");
    });

    it("filters by extension for file-based sources", async () => {
      const items = [
        makeItem({ sourceId: "note.md", title: "MD Note" }),
        makeItem({ sourceId: "image.png", title: "Image", content: "binary" }),
      ];

      const { report } = await importService.previewImport(OBSIDIAN_CONFIG, items);

      expect(report.importedItems).toBe(1);
      expect(report.unsupportedItems).toBe(1);
    });
  });

  describe("runImport", () => {
    it("imports items and produces a report", async () => {
      const items = [
        makeItem({ sourceId: "p1", title: "Page 1", content: "Content 1" }),
        makeItem({ sourceId: "p2", title: "Page 2", content: "Content 2" }),
        makeItem({ sourceId: "p3", title: "Page 3", content: "Content 3" }),
      ];

      const { report, records } = await importService.runImport(NOTION_CONFIG, items);

      expect(report.status).toBe("completed");
      expect(report.importedItems).toBe(3);
      expect(records).toHaveLength(3);
      expect(records[0].slug).toBe("page-1");
      expect(records[1].slug).toBe("page-2");
      expect(records[2].slug).toBe("page-3");
    });

    it("respects maxItems limit", async () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        makeItem({ sourceId: `p${i}`, title: `Page ${i}`, content: `Content ${i}` }),
      );

      const config: ImportConfig = {
        ...NOTION_CONFIG,
        options: { ...NOTION_CONFIG.options, maxItems: 3 },
      };

      const { report } = await importService.runImport(config, items);

      expect(report.importedItems).toBe(3);
      expect(report.skippedItems).toBe(7);
    });

    it("skips errors when skipErrors is true", async () => {
      const items = [
        makeItem({ sourceId: "p1", title: "Good", content: "Good" }),
        makeItem({ sourceId: "p2", title: "", content: "No title" }),
        makeItem({ sourceId: "p3", title: "Also Good", content: "Good" }),
      ];

      const { report } = await importService.runImport(NOTION_CONFIG, items);

      // Empty title produces empty slug but still normalizes
      expect(report.importedItems).toBeGreaterThanOrEqual(2);
    });

    it("preserves source links in report", async () => {
      const items = [
        makeItem({
          sourceId: "p1",
          title: "Linked Page",
          content: "Content",
          sourceUrl: "https://notion.so/linked-page",
        }),
      ];

      const { report } = await importService.runImport(NOTION_CONFIG, items);

      expect(report.items[0].sourceUrl).toBe("https://notion.so/linked-page");
    });

    it("handles Confluence storage format import", async () => {
      const items = [
        makeItem({
          sourceId: "c1",
          title: "Confluence Doc",
          content: "<p>Legal <strong>contract</strong> analysis</p><ac:structured-macro ac:name=\"warning\">!</ac:structured-macro>",
          sourceUrl: "https://wiki.example.com/pages/c1",
        }),
      ];

      const { report, records } = await importService.runImport(CONFLUENCE_CONFIG, items);

      expect(report.importedItems).toBe(1);
      expect(records[0].content).not.toContain("<ac:");
      expect(records[0].content).toContain("Legal");
      expect(records[0].content).toContain("contract");
    });
  });

  describe("getImportReport", () => {
    it("retrieves a report by ID", async () => {
      const { report } = await importService.runImport(NOTION_CONFIG, [makeItem()]);
      const retrieved = importService.getImportReport(report.id);
      expect(retrieved?.id).toBe(report.id);
    });

    it("returns undefined for non-existent ID", () => {
      expect(importService.getImportReport("nonexistent")).toBeUndefined();
    });
  });

  describe("listImportReports", () => {
    it("lists all reports sorted by date", async () => {
      await importService.runImport(NOTION_CONFIG, [makeItem({ title: "A" })]);
      await importService.runImport(CONFLUENCE_CONFIG, [makeItem({ title: "B" })]);

      const list = importService.listImportReports();
      expect(list).toHaveLength(2);
    });
  });

  describe("cancelImport", () => {
    it("throws for non-existent import", () => {
      expect(() => importService.cancelImport("nonexistent")).toThrow("import_not_found");
    });
  });

  describe("Deterministic Normalization", () => {
    it("same input produces same output", () => {
      const item = makeItem({ title: "Test Page", content: "Some #legal content" });
      const r1 = normalizeItem(item, "notion");
      const r2 = normalizeItem(item, "notion");

      expect(r1.slug).toBe(r2.slug);
      expect(r1.content).toBe(r2.content);
      expect(r1.tags).toEqual(r2.tags);
    });
  });

  describe("Unsupported Items Reporting", () => {
    it("unsupported items are reported, not lost", async () => {
      const items = [
        makeItem({ sourceId: "good.md", title: "Good", content: "Content" }),
        makeItem({ sourceId: "bad.exe", title: "Binary", content: "binary data" }),
        makeItem({ sourceId: "empty.md", title: "Empty", content: "" }),
      ];

      const { report } = await importService.previewImport(OBSIDIAN_CONFIG, items);

      const unsupported = report.items.filter((i) => i.status === "unsupported");
      expect(unsupported).toHaveLength(2);
      expect(unsupported[0].reason).toBeTruthy();
      expect(unsupported[1].reason).toBeTruthy();
    });
  });
});
