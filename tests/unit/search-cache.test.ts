import { describe, it, expect, beforeEach } from "bun:test";
import { LocalSearchIndex } from "../../src/desktop/search/search-service";
import type { SearchResult } from "../../src/desktop/search/types";

describe("WP-107: Local Search Cache (BM25)", () => {
  let index: LocalSearchIndex;

  beforeEach(() => {
    index = new LocalSearchIndex();
  });

  describe("indexDocument", () => {
    it("indexes a document", async () => {
      const doc = await index.indexDocument({
        slug: "test/doc-1",
        title: "Test Document",
        content: "This is a test document about legal contracts and obligations.",
        folderRootId: "root-1",
      });

      expect(doc.id).toBe("doc_test_doc_1");
      expect(doc.tokenCount).toBeGreaterThan(0);
      expect(doc.contentHash).toBeTruthy();
    });

    it("is idempotent for same content", async () => {
      const input = {
        slug: "test/doc-1",
        title: "Test",
        content: "Same content here.",
        folderRootId: "root-1",
      };

      const doc1 = await index.indexDocument(input);
      const doc2 = await index.indexDocument(input);

      expect(doc1.contentHash).toBe(doc2.contentHash);
      expect(index.stats().totalDocs).toBe(1);
    });

    it("re-indexes when content changes", async () => {
      await index.indexDocument({
        slug: "test/doc-1",
        title: "Original",
        content: "Original content.",
        folderRootId: "root-1",
      });

      await index.indexDocument({
        slug: "test/doc-1",
        title: "Updated",
        content: "Updated content with more words.",
        folderRootId: "root-1",
      });

      expect(index.stats().totalDocs).toBe(1);
      const result = index.search("updated");
      expect(result.hits[0]?.title).toBe("Updated");
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await index.indexDocument({
        slug: "docs/contract-law",
        title: "Contract Law Basics",
        content: "A contract is a legally binding agreement between parties. Contracts require offer, acceptance, and consideration.",
        folderRootId: "root-1",
      });
      await index.indexDocument({
        slug: "docs/tort-law",
        title: "Tort Law Overview",
        content: "Tort law deals with civil wrongs and damages. Negligence is a key concept in tort law.",
        folderRootId: "root-1",
      });
      await index.indexDocument({
        slug: "docs/criminal-law",
        title: "Criminal Law Introduction",
        content: "Criminal law prosecute offenses against the state. Crimes include theft, assault, and fraud.",
        folderRootId: "root-1",
      });
    });

    it("returns relevant results", () => {
      const result = index.search("contract");
      expect(result.total).toBeGreaterThan(0);
      expect(result.hits[0].slug).toBe("docs/contract-law");
    });

    it("ranks by relevance (BM25)", () => {
      const result = index.search("law");
      expect(result.hits.length).toBe(3);
      // All three docs contain "law" — results should be sorted by score
      for (let i = 1; i < result.hits.length; i++) {
        expect(result.hits[i - 1].score).toBeGreaterThanOrEqual(result.hits[i].score);
      }
    });

    it("returns empty results for no matches", () => {
      const result = index.search("quantum physics");
      expect(result.hits).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("returns empty results for empty query", () => {
      const result = index.search("");
      expect(result.hits).toEqual([]);
    });

    it("returns empty results for stop-words only", () => {
      const result = index.search("the and is");
      expect(result.hits).toEqual([]);
    });

    it("includes snippet in results", () => {
      const result = index.search("contract");
      expect(result.hits[0].snippet).toBeTruthy();
      expect(result.hits[0].snippet.length).toBeGreaterThan(0);
    });

    it("measures elapsed time", () => {
      const result = index.search("contract");
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("handles multi-term queries", () => {
      const result = index.search("contract parties agreement");
      expect(result.hits[0].slug).toBe("docs/contract-law");
    });
  });

  describe("deterministic ranking", () => {
    it("returns same ranking for same query", async () => {
      const docs = [
        { slug: "a", title: "Alpha", content: "alpha beta gamma delta epsilon", folderRootId: "r" },
        { slug: "b", title: "Beta", content: "beta beta beta gamma delta", folderRootId: "r" },
        { slug: "c", title: "Gamma", content: "gamma gamma gamma gamma gamma", folderRootId: "r" },
      ];

      for (const d of docs) {
        await index.indexDocument(d);
      }

      const result1 = index.search("gamma");
      const result2 = index.search("gamma");

      expect(result1.hits.map((h) => h.slug)).toEqual(result2.hits.map((h) => h.slug));
      expect(result1.hits[0].slug).toBe("c"); // doc with most "gamma" occurrences
    });
  });

  describe("invalidateDocument", () => {
    it("removes a document from the index", async () => {
      await index.indexDocument({
        slug: "test/doc-1",
        title: "Test",
        content: "Some searchable content here.",
        folderRootId: "root-1",
      });

      expect(index.isIndexed("test/doc-1")).toBe(true);

      const removed = index.invalidateDocument("test/doc-1");
      expect(removed).toBe(true);
      expect(index.isIndexed("test/doc-1")).toBe(false);

      const result = index.search("searchable");
      expect(result.total).toBe(0);
    });

    it("returns false for non-existent document", () => {
      expect(index.invalidateDocument("nonexistent")).toBe(false);
    });
  });

  describe("rebuildIndex", () => {
    it("rebuilds from scratch", async () => {
      await index.indexDocument({
        slug: "old-doc",
        title: "Old",
        content: "Old content.",
        folderRootId: "root-1",
      });

      const count = await index.rebuildIndex([
        { slug: "new-1", title: "New 1", content: "New content one.", folderRootId: "root-1" },
        { slug: "new-2", title: "New 2", content: "New content two.", folderRootId: "root-1" },
      ]);

      expect(count).toBe(2);
      expect(index.isIndexed("old-doc")).toBe(false);
      expect(index.isIndexed("new-1")).toBe(true);
      expect(index.isIndexed("new-2")).toBe(true);
      expect(index.stats().lastRebuiltAt).toBeTruthy();
    });
  });

  describe("stats", () => {
    it("returns correct statistics", async () => {
      await index.indexDocument({
        slug: "doc-1",
        title: "Doc 1",
        content: "alpha beta gamma",
        folderRootId: "r",
      });
      await index.indexDocument({
        slug: "doc-2",
        title: "Doc 2",
        content: "alpha beta delta",
        folderRootId: "r",
      });

      const stats = index.stats();
      expect(stats.totalDocs).toBe(2);
      // Terms: doc (from title), alpha, beta, gamma, delta = 5
      expect(stats.totalTerms).toBe(5);
      expect(stats.avgDocLength).toBeGreaterThan(0);
    });

    it("returns empty stats for clean index", () => {
      const stats = index.stats();
      expect(stats.totalDocs).toBe(0);
      expect(stats.totalTerms).toBe(0);
      expect(stats.avgDocLength).toBe(0);
    });
  });

  describe("performance target (p95 < 150ms)", () => {
    it("searches 100 documents in under 150ms", async () => {
      // Index 100 documents
      for (let i = 0; i < 100; i++) {
        await index.indexDocument({
          slug: `doc-${i}`,
          title: `Document ${i}`,
          content: `This is document number ${i} with various terms like legal contract tort criminal civil law agreement parties ${i % 10 === 0 ? "special" : "normal"}.`,
          folderRootId: "root-1",
        });
      }

      const result = index.search("legal contract");
      expect(result.elapsedMs).toBeLessThan(150);
      expect(result.hits.length).toBeGreaterThan(0);
    });
  });

  describe("German language support", () => {
    it("handles German umlauts and stopwords", async () => {
      await index.indexDocument({
        slug: "de/anwalt",
        title: "Anwaltsvertrag",
        content: "Der Anwalt schließt einen Vertrag mit dem Mandanten über die Rechtsberatung.",
        folderRootId: "root-1",
      });

      const result = index.search("Anwalt Vertrag Mandant");
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits[0].slug).toBe("de/anwalt");
    });
  });
});
