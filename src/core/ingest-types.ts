export type IngestJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "dead_letter";

export type IngestJobPriority = "low" | "normal" | "high";

export interface IngestItem {
  path: string;
  canonicalPath: string;
  changeType: "created" | "modified" | "removed";
  size: number | null;
  mimeType: string | null;
}

export interface IngestJob {
  id: string;
  item: IngestItem;
  status: IngestJobStatus;
  priority: IngestJobPriority;
  dedupKey: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

export interface IngestQueueConfig {
  maxAttempts: number;
  retryDelayMs: number;
  maxQueueSize: number;
  dedupWindowMs: number;
}

export type IngestEventName =
  | "ingest-queued"
  | "ingest-started"
  | "ingest-completed"
  | "ingest-failed";

export interface IngestEventPayload {
  jobId: string;
  path: string;
  status: IngestJobStatus;
  attempts: number;
  timestamp: string;
  error?: string;
}

export const DEFAULT_INGEST_CONFIG: IngestQueueConfig = {
  maxAttempts: 3,
  retryDelayMs: 5000,
  maxQueueSize: 1000,
  dedupWindowMs: 60_000,
};

export function computeDedupKey(item: IngestItem): string {
  return `${item.canonicalPath}:${item.changeType}:${item.size ?? 0}`;
}
