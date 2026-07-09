/**
 * WP-106: Local ingest queue types.
 *
 * Types for the local ingest queue that processes file events
 * from the file watcher (WP-105) into the brain via parsing,
 * extraction, and sync.
 *
 * Queue state is persisted to localStorage for crash recovery.
 * Deduplication is handled via content-hash keys.
 */

export type IngestJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "dead_letter";

export type IngestPriority = "low" | "normal" | "high";

export interface IngestJob {
  id: string;
  /** Deduplication key (content hash or path+mtime). */
  dedupKey: string;
  /** File path that triggered the ingest. */
  filePath: string;
  /** Folder root ID from WP-104 folder authorization. */
  folderRootId: string;
  /** File size in bytes. */
  size: number;
  /** File modification time (ISO). */
  modifiedAt: string;
  /** Current job status. */
  status: IngestJobStatus;
  /** Number of processing attempts. */
  attempts: number;
  /** Maximum retry attempts before dead-lettering. */
  maxAttempts: number;
  /** Priority level. */
  priority: IngestPriority;
  /** ISO timestamp when the job was queued. */
  queuedAt: string;
  /** ISO timestamp when processing started (if any). */
  startedAt?: string;
  /** ISO timestamp when the job completed or failed. */
  finishedAt?: string;
  /** Error message from the last attempt (if failed). */
  lastError?: string;
  /** Resulting brain-page slug after successful ingest. */
  resultSlug?: string;
  /** Content hash for deduplication. */
  contentHash?: string;
}

export interface IngestQueueState {
  jobs: IngestJob[];
  processing: string | null;
  totalProcessed: number;
  totalFailed: number;
}

export type IngestEvent =
  | "IngestQueued"
  | "IngestStarted"
  | "IngestCompleted"
  | "IngestFailed";

export interface IngestEventPayload {
  job_id: string;
  file_path: string;
  attempts?: number;
  result_slug?: string;
  error?: string;
  timestamp: string;
}

export interface IngestRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: IngestRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  backoffMultiplier: 2,
};
