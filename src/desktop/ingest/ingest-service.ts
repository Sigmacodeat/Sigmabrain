/**
 * WP-106: Ingest queue service.
 *
 * Orchestrates the ingest lifecycle:
 *   1. enqueueIngest(item) — add file to queue with dedup
 *   2. dequeueIngest() — get next job (priority-ordered)
 *   3. ackIngest(id) — mark successful
 *   4. failIngest(id) — mark failed (retry or dead-letter)
 *
 * Includes retry with exponential backoff and crash recovery.
 */

import { useIngestStore } from "./queue-store";
import { DEFAULT_RETRY_POLICY } from "./types";
import type { IngestJob, IngestPriority, IngestRetryPolicy } from "./types";
import { logAudit } from "@/lib/audit";

async function computeFileHash(filePath: string, size: number, modifiedAt: string): Promise<string> {
  // Simple deterministic hash from path + size + mtime for dedup
  // (real implementation would use crypto.subtle on file content)
  const input = `${filePath}:${size}:${modifiedAt}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface EnqueueParams {
  filePath: string;
  folderRootId: string;
  size: number;
  modifiedAt: string;
  priority?: IngestPriority;
  contentHash?: string;
  retryPolicy?: Partial<IngestRetryPolicy>;
}

export const ingestService = {
  /**
   * Enqueue a file for ingest. Deduplicates by content hash.
   * Returns the existing job if a dedup match is found.
   */
  async enqueue(params: EnqueueParams): Promise<IngestJob> {
    const dedupKey = params.contentHash ?? await computeFileHash(params.filePath, params.size, params.modifiedAt);
    const policy = { ...DEFAULT_RETRY_POLICY, ...params.retryPolicy };

    // Check for existing job with same dedup key
    const existing = useIngestStore.getState().findByDedupKey(dedupKey);
    if (existing) return existing;

    const job = useIngestStore.getState().enqueue({
      dedupKey,
      filePath: params.filePath,
      folderRootId: params.folderRootId,
      size: params.size,
      modifiedAt: params.modifiedAt,
      priority: params.priority ?? "normal",
      maxAttempts: policy.maxAttempts,
      contentHash: dedupKey,
    });

    void logAudit("document.upload", "ingest_queue", {
      entityId: job.id,
      details: { file_path: params.filePath, dedup_key: dedupKey, priority: params.priority ?? "normal" },
    });

    return job;
  },

  /**
   * Dequeue the next job for processing (highest priority first).
   */
  dequeue(): IngestJob | null {
    return useIngestStore.getState().dequeue();
  },

  /**
   * Acknowledge successful ingest.
   */
  ack(jobId: string, resultSlug?: string): void {
    useIngestStore.getState().ack(jobId, resultSlug);
  },

  /**
   * Mark ingest as failed. Will retry if attempts remain,
   * otherwise moves to dead-letter queue.
   */
  fail(jobId: string, error: string): void {
    const job = useIngestStore.getState().get(jobId);
    useIngestStore.getState().fail(jobId, error);

    if (job && job.attempts >= job.maxAttempts) {
      void logAudit("document.delete", "ingest_queue", {
        entityId: jobId,
        details: { error, attempts: job.attempts, dead_lettered: true },
      });
    }
  },

  /**
   * Get a single job by ID.
   */
  get(jobId: string): IngestJob | undefined {
    return useIngestStore.getState().get(jobId);
  },

  /**
   * List jobs by status.
   */
  listByStatus(status: IngestJob["status"]): IngestJob[] {
    return useIngestStore.getState().listByStatus(status);
  },

  /**
   * Get queue statistics.
   */
  stats(): {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    totalProcessed: number;
    totalFailed: number;
  } {
    const state = useIngestStore.getState();
    return {
      queued: state.listByStatus("queued").length,
      processing: state.listByStatus("processing").length,
      completed: state.listByStatus("completed").length,
      failed: state.listByStatus("failed").length,
      deadLetter: state.listByStatus("dead_letter").length,
      totalProcessed: state.totalProcessed,
      totalFailed: state.totalFailed,
    };
  },

  /**
   * Requeue stale processing jobs (crash recovery).
   * Returns the number of jobs requeued.
   */
  requeueStale(maxAgeMs: number = 5 * 60 * 1000): number {
    return useIngestStore.getState().requeueStale(maxAgeMs);
  },

  /**
   * Calculate the retry delay for a job based on attempt count.
   */
  getRetryDelay(attempts: number, policy: IngestRetryPolicy = DEFAULT_RETRY_POLICY): number {
    const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempts - 1);
    return Math.min(delay, policy.maxDelayMs);
  },

  /**
   * Initialize the queue from persisted state.
   */
  init(): void {
    useIngestStore.getState().load();
    // Requeue any stale processing jobs from a crash
    this.requeueStale();
  },

  /**
   * Clear all queue state (for testing/reset).
   */
  clear(): void {
    useIngestStore.getState().clear();
  },
};
