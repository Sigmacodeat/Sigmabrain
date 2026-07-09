/**
 * WP-107: Local search cache types.
 *
 * Types for the offline local BM25 search index.
 * Supports incremental indexing, cache invalidation,
 * and deterministic ranking for authorized content.
 */

export interface IndexedDocument {
  id: string;
  slug: string;
  title: string;
  content: string;
  folderRootId: string;
  indexedAt: string;
  contentHash: string;
  tokenCount: number;
}

export interface SearchHit {
  docId: string;
  slug: string;
  title: string;
  score: number;
  snippet: string;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  query: string;
  elapsedMs: number;
}

export interface SearchIndexState {
  documents: Map<string, IndexedDocument>;
  termFreqs: Map<string, Map<string, number>>;
  docFreqs: Map<string, number>;
  totalDocs: number;
  avgDocLength: number;
  lastRebuiltAt?: string;
}

export type SearchEvent =
  | "document-indexed"
  | "index-rebuilt"
  | "search-cache-invalidated";

export interface SearchEventPayload {
  doc_id?: string;
  slug?: string;
  total_docs?: number;
  scope?: string;
  timestamp: string;
}

export interface SearchIndexConfig {
  bm25K1: number;
  bm25B: number;
  maxResults: number;
  snippetLength: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchIndexConfig = {
  bm25K1: 1.5,
  bm25B: 0.75,
  maxResults: 50,
  snippetLength: 200,
};
