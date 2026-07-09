/**
 * WP-107: Local BM25 search service.
 *
 * Implements an in-memory BM25 search index for offline search
 * over authorized local content. Supports:
 *   - indexDocument(doc) — incremental indexing
 *   - searchLocal(query) — BM25-ranked search
 *   - rebuildIndex(scope?) — full rebuild
 *   - invalidateDocument(slug) — remove from index
 *
 * The index is kept in memory and can be persisted to localStorage.
 * BM25 parameters (k1, b) are configurable.
 */

import type {
  IndexedDocument,
  SearchHit,
  SearchResult,
  SearchIndexConfig,
  SearchEvent,
  SearchEventPayload,
} from "./types";
import { DEFAULT_SEARCH_CONFIG } from "./types";
import { emit } from "@tauri-apps/api/event";
import { isTauriEnvironment } from "../runtime";

function emitSearchEvent(event: SearchEvent, payload: Omit<SearchEventPayload, "timestamp">): void {
  if (!isTauriEnvironment()) return;
  const fullPayload: SearchEventPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  };
  emit(event, fullPayload).catch(() => {
    // Event emission is best-effort; must never break search flow.
  });
}

const STOP_WORDS = new Set([
  "der", "die", "das", "ein", "eine", "und", "oder", "aber", "ist", "war",
  "im", "in", "an", "auf", "mit", "zu", "von", "für", "über", "unter",
  "the", "a", "an", "and", "or", "but", "is", "was", "in", "on", "at",
  "to", "for", "of", "with", "by", "from", "it", "this", "that",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function generateDocId(slug: string): string {
  return `doc_${slug.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

async function hashContent(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeSnippet(content: string, queryTokens: string[], length: number): string {
  const lowerContent = content.toLowerCase();
  let bestPos = 0;
  let bestScore = 0;

  for (const token of queryTokens) {
    const pos = lowerContent.indexOf(token);
    if (pos >= 0) {
      const score = queryTokens.filter((t) => lowerContent.slice(pos, pos + length).includes(t)).length;
      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }
  }

  const start = Math.max(0, bestPos - Math.floor(length / 2));
  const snippet = content.slice(start, start + length).trim();
  return snippet.length === content.length ? snippet : `...${snippet}...`;
}

class LocalSearchIndex {
  private documents: Map<string, IndexedDocument> = new Map();
  private termFreqs: Map<string, Map<string, number>> = new Map();
  private docFreqs: Map<string, number> = new Map();
  private totalDocs = 0;
  private totalDocLength = 0;
  private config: SearchIndexConfig;
  private lastRebuiltAt?: string;

  constructor(config: Partial<SearchIndexConfig> = {}) {
    this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
  }

  /**
   * Index a document incrementally.
   * If the document already exists with the same content hash, it's a no-op.
   */
  async indexDocument(doc: {
    slug: string;
    title: string;
    content: string;
    folderRootId: string;
  }): Promise<IndexedDocument> {
    const docId = generateDocId(doc.slug);
    const contentHash = await hashContent(doc.content);

    // Check if already indexed with same hash
    const existing = this.documents.get(docId);
    if (existing && existing.contentHash === contentHash) {
      return existing;
    }

    // Remove existing document from index if present
    if (existing) {
      this.removeFromIndex(docId);
    }

    const tokens = tokenize(`${doc.title} ${doc.content}`);
    const tokenCount = tokens.length;

    const indexed: IndexedDocument = {
      id: docId,
      slug: doc.slug,
      title: doc.title,
      content: doc.content,
      folderRootId: doc.folderRootId,
      indexedAt: new Date().toISOString(),
      contentHash,
      tokenCount,
    };

    // Build term frequency map for this document
    const tfMap: Map<string, number> = new Map();
    for (const token of tokens) {
      tfMap.set(token, (tfMap.get(token) ?? 0) + 1);
    }

    // Update global index
    this.documents.set(docId, indexed);
    this.termFreqs.set(docId, tfMap);
    this.totalDocs++;
    this.totalDocLength += tokenCount;

    // Update document frequencies
    for (const term of tfMap.keys()) {
      this.docFreqs.set(term, (this.docFreqs.get(term) ?? 0) + 1);
    }

    emitSearchEvent("document-indexed", {
      doc_id: indexed.id,
      slug: indexed.slug,
    });

    return indexed;
  }

  /**
   * Search the local index using BM25 ranking.
   */
  search(query: string): SearchResult {
    const start = performance.now();
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0 || this.totalDocs === 0) {
      return { hits: [], total: 0, query, elapsedMs: 0 };
    }

    const avgDocLength = this.totalDocLength / this.totalDocs;
    const hits: SearchHit[] = [];

    for (const [docId, doc] of this.documents) {
      const tfMap = this.termFreqs.get(docId);
      if (!tfMap) continue;

      let score = 0;
      for (const term of queryTokens) {
        const tf = tfMap.get(term);
        if (!tf) continue;

        const df = this.docFreqs.get(term) ?? 0;
        if (df === 0) continue;

        // BM25 score
        const idf = Math.log(1 + (this.totalDocs - df + 0.5) / (df + 0.5));
        const tfNorm = (tf * (this.config.bm25K1 + 1)) /
          (tf + this.config.bm25K1 * (1 - this.config.bm25B + this.config.bm25B * (doc.tokenCount / avgDocLength)));
        score += idf * tfNorm;
      }

      if (score > 0) {
        hits.push({
          docId,
          slug: doc.slug,
          title: doc.title,
          score,
          snippet: makeSnippet(doc.content, queryTokens, this.config.snippetLength),
        });
      }
    }

    hits.sort((a, b) => b.score - a.score);
    const limited = hits.slice(0, this.config.maxResults);
    const elapsedMs = performance.now() - start;

    return {
      hits: limited,
      total: hits.length,
      query,
      elapsedMs,
    };
  }

  /**
   * Remove a document from the index.
   */
  invalidateDocument(slug: string): boolean {
    const docId = generateDocId(slug);
    return this.removeFromIndex(docId);
  }

  private removeFromIndex(docId: string): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    const tfMap = this.termFreqs.get(docId);
    if (tfMap) {
      for (const term of tfMap.keys()) {
        const df = this.docFreqs.get(term);
        if (df !== undefined) {
          if (df <= 1) {
            this.docFreqs.delete(term);
          } else {
            this.docFreqs.set(term, df - 1);
          }
        }
      }
    }

    this.documents.delete(docId);
    this.termFreqs.delete(docId);
    this.totalDocs--;
    this.totalDocLength -= doc.tokenCount;

    emitSearchEvent("search-cache-invalidated", {
      doc_id: doc.id,
      slug: doc.slug,
    });

    return true;
  }

  /**
   * Rebuild the entire index from a set of documents.
   */
  async rebuildIndex(documents: Array<{
    slug: string;
    title: string;
    content: string;
    folderRootId: string;
  }>): Promise<number> {
    this.clear();
    for (const doc of documents) {
      await this.indexDocument(doc);
    }
    this.lastRebuiltAt = new Date().toISOString();

    emitSearchEvent("index-rebuilt", {
      total_docs: this.totalDocs,
    });

    return this.totalDocs;
  }

  /**
   * Clear the entire index.
   */
  clear(): void {
    this.documents.clear();
    this.termFreqs.clear();
    this.docFreqs.clear();
    this.totalDocs = 0;
    this.totalDocLength = 0;
    this.lastRebuiltAt = undefined;
  }

  /**
   * Get index statistics.
   */
  stats(): {
    totalDocs: number;
    totalTerms: number;
    avgDocLength: number;
    lastRebuiltAt?: string;
  } {
    return {
      totalDocs: this.totalDocs,
      totalTerms: this.docFreqs.size,
      avgDocLength: this.totalDocs > 0 ? this.totalDocLength / this.totalDocs : 0,
      lastRebuiltAt: this.lastRebuiltAt,
    };
  }

  /**
   * Check if a document is indexed.
   */
  isIndexed(slug: string): boolean {
    return this.documents.has(generateDocId(slug));
  }
}

export const localSearchIndex = new LocalSearchIndex();
export { LocalSearchIndex };
