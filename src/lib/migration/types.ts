/**
 * WP-410: Migration Framework v1 — Types.
 *
 * Types for importing content from Notion, Obsidian, and Confluence
 * into SigmaBrain's memory and graph records.
 *
 * Import flow: preview → run → report
 * Normalization is deterministic; unsupported items are reported, not lost.
 */

export type ImportSource = "notion" | "obsidian" | "confluence" | "markdown" | "csv";
export type ImportStatus = "pending" | "previewing" | "running" | "completed" | "failed" | "cancelled";

export interface ImportConfig {
  source: ImportSource;
  /** Source-specific connection info (API token, file path, space key, etc.) */
  connection: ImportConnection;
  /** Options for normalization and filtering. */
  options: ImportOptions;
}

export interface ImportConnection {
  /** Notion: API token. Confluence: base URL + token. Obsidian: vault path. */
  token?: string;
  /** Confluence: base URL. Notion: API URL. */
  baseUrl?: string;
  /** Confluence: space key. Notion: database ID. */
  scope?: string;
  /** Obsidian/Markdown: local folder path. */
  path?: string;
}

export interface ImportOptions {
  /** Include sub-pages / child documents. */
  recursive?: boolean;
  /** Max pages to import (0 = unlimited). */
  maxItems?: number;
  /** File extensions to include (for file-based sources). */
  extensions?: string[];
  /** Skip items that fail normalization instead of failing the whole import. */
  skipErrors?: boolean;
  /** Dry-run: normalize but don't write to brain. */
  dryRun?: boolean;
}

export interface ImportItem {
  /** Source-specific ID (Notion page ID, Obsidian file path, Confluence page ID). */
  sourceId: string;
  sourceType: string;
  title: string;
  content: string;
  sourceUrl?: string;
  parentSourceId?: string;
  metadata?: Record<string, string>;
}

export interface NormalizedRecord {
  slug: string;
  title: string;
  content: string;
  source: ImportSource;
  sourceId: string;
  sourceUrl?: string;
  parentSlug?: string;
  tags: string[];
  importedAt: string;
}

export interface ImportReport {
  id: string;
  config: ImportConfig;
  status: ImportStatus;
  startedAt: string;
  completedAt?: string;
  totalItems: number;
  importedItems: number;
  skippedItems: number;
  failedItems: number;
  unsupportedItems: number;
  items: ImportReportItem[];
  error?: string;
}

export interface ImportReportItem {
  sourceId: string;
  title: string;
  status: "imported" | "skipped" | "failed" | "unsupported";
  slug?: string;
  sourceUrl?: string;
  error?: string;
  reason?: string;
}

export type ImportEvent =
  | "import-started"
  | "import-completed"
  | "import-failed";

export interface ImportEventPayload {
  event: ImportEvent;
  import_id: string;
  source: ImportSource;
  total_items?: number;
  imported_items?: number;
  error?: string;
  timestamp: string;
}
