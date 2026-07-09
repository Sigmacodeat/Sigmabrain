import type {
  IngestItem,
  IngestJob,
  IngestQueueConfig,
  IngestJobPriority,
  IngestEventName,
  IngestEventPayload,
} from "@/core/ingest-types";
import { DEFAULT_INGEST_CONFIG, computeDedupKey } from "@/core/ingest-types";
import { emit } from "@tauri-apps/api/event";
import { isTauriEnvironment } from "../runtime";

const STORAGE_KEY = "sb_ingest_queue";

interface PersistedState {
  jobs: IngestJob[];
  dedupKeys: Record<string, number>;
}

function loadState(): PersistedState {
  if (typeof localStorage === "undefined") return { jobs: [], dedupKeys: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { jobs: [], dedupKeys: {} };
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      jobs: parsed.jobs ?? [],
      dedupKeys: parsed.dedupKeys ?? {},
    };
  } catch {
    return { jobs: [], dedupKeys: {} };
  }
}

function saveState(state: PersistedState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage might be unavailable
  }
}

function generateId(): string {
  return `ing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

type IngestEventCallback = (payload: {
  jobId: string;
  path: string;
  status: string;
  attempts: number;
  timestamp: string;
  error?: string;
}) => void;

export class IngestQueueService {
  private config: IngestQueueConfig = DEFAULT_INGEST_CONFIG;
  private jobs: Map<string, IngestJob> = new Map();
  private dedupKeys: Map<string, number> = new Map();
  private listeners: Set<IngestEventCallback> = new Set();
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    const state = loadState();
    for (const job of state.jobs) {
      this.jobs.set(job.id, job);
    }
    const dedupEntries = Object.entries(state.dedupKeys);
    for (const [key, ts] of dedupEntries) {
      this.dedupKeys.set(key, ts);
    }
    this.cleanupExpiredDedup();
    this.initialized = true;
  }

  persist(): void {
    saveState({
      jobs: Array.from(this.jobs.values()),
      dedupKeys: Object.fromEntries(this.dedupKeys),
    });
  }

  setConfig(config: Partial<IngestQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  enqueueIngest(item: IngestItem, priority: IngestJobPriority = "normal"): IngestJob | null {
    this.init();

    if (this.jobs.size >= this.config.maxQueueSize) {
      return null;
    }

    const dedupKey = computeDedupKey(item);
    const now = Date.now();

    const lastDedup = this.dedupKeys.get(dedupKey);
    if (lastDedup && now - lastDedup < this.config.dedupWindowMs) {
      return null;
    }

    for (const existing of this.jobs.values()) {
      if (existing.dedupKey === dedupKey && (existing.status === "queued" || existing.status === "processing")) {
        return null;
      }
    }

    this.dedupKeys.set(dedupKey, now);

    const job: IngestJob = {
      id: generateId(),
      item,
      status: "queued",
      priority,
      dedupKey,
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: null,
      completedAt: null,
      lastError: null,
    };

    this.jobs.set(job.id, job);
    this.persist();
    this.emit("ingest-queued", job);

    return job;
  }

  dequeueIngest(): IngestJob | null {
    this.init();

    const queued = Array.from(this.jobs.values())
      .filter((j) => j.status === "queued")
      .sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return a.createdAt.localeCompare(b.createdAt);
      });

    if (queued.length === 0) return null;

    const job = queued[0];
    job.status = "processing";
    job.attempts += 1;
    job.startedAt = nowIso();
    job.updatedAt = nowIso();
    this.persist();
    this.emit("ingest-started", job);

    return job;
  }

  ackIngest(id: string): boolean {
    this.init();

    const job = this.jobs.get(id);
    if (!job || job.status !== "processing") return false;

    job.status = "completed";
    job.completedAt = nowIso();
    job.updatedAt = nowIso();
    this.dedupKeys.delete(job.dedupKey);
    this.persist();
    this.emit("ingest-completed", job);

    return true;
  }

  failIngest(id: string, error: string): boolean {
    this.init();

    const job = this.jobs.get(id);
    if (!job || job.status !== "processing") return false;

    job.lastError = error;
    job.updatedAt = nowIso();

    if (job.attempts >= job.maxAttempts) {
      job.status = "dead_letter";
      this.persist();
      this.emit("ingest-failed", job);
    } else {
      job.status = "queued";
      this.persist();
      this.emit("ingest-failed", job);
    }

    return true;
  }

  getJob(id: string): IngestJob | null {
    return this.jobs.get(id) ?? null;
  }

  getPendingJobs(): IngestJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.status === "queued");
  }

  getProcessingJobs(): IngestJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.status === "processing");
  }

  getFailedJobs(): IngestJob[] {
    return Array.from(this.jobs.values()).filter(
      (j) => j.status === "failed" || j.status === "dead_letter",
    );
  }

  getCompletedJobs(): IngestJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.status === "completed");
  }

  getAllJobs(): IngestJob[] {
    return Array.from(this.jobs.values());
  }

  getQueueSize(): number {
    return this.jobs.size;
  }

  clearCompleted(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === "completed") {
        this.jobs.delete(id);
      }
    }
    this.persist();
  }

  clearAll(): void {
    this.jobs.clear();
    this.dedupKeys.clear();
    this.persist();
  }

  onEvent(callback: IngestEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: IngestEventName, job: IngestJob): void {
    const payload: IngestEventPayload = {
      jobId: job.id,
      path: job.item.path,
      status: job.status,
      attempts: job.attempts,
      timestamp: nowIso(),
      error: job.lastError ?? undefined,
    };
    for (const listener of this.listeners) {
      listener(payload);
    }
    if (isTauriEnvironment()) {
      emit(event, payload).catch(() => {
        // Tauri event emission is best-effort; must never break queue flow.
      });
    }
  }

  private cleanupExpiredDedup(): void {
    const now = Date.now();
    for (const [key, ts] of this.dedupKeys) {
      if (now - ts > this.config.dedupWindowMs) {
        this.dedupKeys.delete(key);
      }
    }
  }
}

export const ingestQueueService = new IngestQueueService();
