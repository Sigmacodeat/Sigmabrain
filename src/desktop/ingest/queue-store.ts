/**
 * WP-106: Ingest queue store.
 *
 * Zustand store with localStorage persistence for crash recovery.
 * The queue survives restarts — incomplete jobs are re-queued on load.
 */

import { create } from "zustand";
import type { IngestJob, IngestJobStatus, IngestQueueState } from "./types";

const STORAGE_KEY = "sb_ingest_queue";

function loadQueue(): IngestJob[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const jobs = JSON.parse(raw) as IngestJob[];
    // On load, reset any "processing" jobs back to "queued" for recovery
    return jobs.map((j) =>
      j.status === "processing" ? { ...j, status: "queued" as IngestJobStatus, startedAt: undefined } : j,
    );
  } catch {
    return [];
  }
}

function saveQueue(jobs: IngestJob[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Storage might be unavailable
  }
}

function generateId(): string {
  return `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface IngestStore extends IngestQueueState {
  load: () => void;
  enqueue: (job: Omit<IngestJob, "id" | "status" | "attempts" | "queuedAt">) => IngestJob;
  dequeue: () => IngestJob | null;
  ack: (id: string, resultSlug?: string) => void;
  fail: (id: string, error: string) => void;
  get: (id: string) => IngestJob | undefined;
  findByDedupKey: (dedupKey: string) => IngestJob | undefined;
  listByStatus: (status: IngestJobStatus) => IngestJob[];
  clear: () => void;
  requeueStale: (maxAgeMs: number) => number;
}

export const useIngestStore = create<IngestStore>((set, get) => ({
  jobs: [],
  processing: null,
  totalProcessed: 0,
  totalFailed: 0,

  load: () => {
    const jobs = loadQueue();
    const processed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "dead_letter").length;
    set({ jobs, totalProcessed: processed, totalFailed: failed });
  },

  enqueue: (input) => {
    const job: IngestJob = {
      ...input,
      id: generateId(),
      status: "queued",
      attempts: 0,
      queuedAt: new Date().toISOString(),
    };
    const jobs = [...get().jobs, job];
    saveQueue(jobs);
    set({ jobs });
    return job;
  },

  dequeue: () => {
    const { jobs } = get();
    // Find highest priority queued job
    const queued = jobs
      .filter((j) => j.status === "queued")
      .sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    if (queued.length === 0) return null;

    const job = queued[0];
    const updatedJobs = jobs.map((j) =>
      j.id === job.id
        ? { ...j, status: "processing" as IngestJobStatus, attempts: j.attempts + 1, startedAt: new Date().toISOString() }
        : j,
    );
    saveQueue(updatedJobs);
    set({ jobs: updatedJobs, processing: job.id });
    return { ...job, status: "processing", attempts: job.attempts + 1, startedAt: new Date().toISOString() };
  },

  ack: (id, resultSlug) => {
    const jobs = get().jobs.map((j) =>
      j.id === id
        ? { ...j, status: "completed" as IngestJobStatus, finishedAt: new Date().toISOString(), resultSlug }
        : j,
    );
    saveQueue(jobs);
    set((s) => ({ jobs, processing: null, totalProcessed: s.totalProcessed + 1 }));
  },

  fail: (id, error) => {
    const jobs = get().jobs.map((j) => {
      if (j.id !== id) return j;
      const shouldDeadLetter = j.attempts >= j.maxAttempts;
      return {
        ...j,
        status: (shouldDeadLetter ? "dead_letter" : "queued") as IngestJobStatus,
        lastError: error,
        finishedAt: shouldDeadLetter ? new Date().toISOString() : undefined,
      };
    });
    saveQueue(jobs);
    set((s) => ({
      jobs,
      processing: null,
      totalFailed: jobs.filter((j) => j.status === "dead_letter").length,
    }));
  },

  get: (id) => get().jobs.find((j) => j.id === id),

  findByDedupKey: (dedupKey) =>
    get().jobs.find((j) => j.dedupKey === dedupKey && j.status !== "dead_letter"),

  listByStatus: (status) => get().jobs.filter((j) => j.status === status),

  clear: () => {
    saveQueue([]);
    set({ jobs: [], processing: null, totalProcessed: 0, totalFailed: 0 });
  },

  requeueStale: (maxAgeMs) => {
    const now = Date.now();
    let count = 0;
    const jobs = get().jobs.map((j) => {
      if (j.status === "processing" && j.startedAt) {
        const age = now - new Date(j.startedAt).getTime();
        if (age > maxAgeMs) {
          count++;
          return { ...j, status: "queued" as IngestJobStatus, startedAt: undefined };
        }
      }
      return j;
    });
    if (count > 0) {
      saveQueue(jobs);
      set({ jobs, processing: null });
    }
    return count;
  },
}));
