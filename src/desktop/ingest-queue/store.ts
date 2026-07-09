import { create } from "zustand";
import { ingestQueueService } from "./ingest-queue-service";
import type { IngestItem, IngestJob, IngestJobPriority } from "@/core/ingest-types";

interface IngestStore {
  jobs: IngestJob[];
  initialized: boolean;
  init: () => void;
  enqueue: (item: IngestItem, priority?: IngestJobPriority) => IngestJob | null;
  dequeue: () => IngestJob | null;
  ack: (id: string) => boolean;
  fail: (id: string, error: string) => boolean;
  refresh: () => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

export const useIngestStore = create<IngestStore>((set, get) => ({
  jobs: [],
  initialized: false,

  init: () => {
    if (get().initialized) return;
    ingestQueueService.init();
    set({ jobs: ingestQueueService.getAllJobs(), initialized: true });
  },

  enqueue: (item, priority = "normal") => {
    const job = ingestQueueService.enqueueIngest(item, priority);
    set({ jobs: ingestQueueService.getAllJobs() });
    return job;
  },

  dequeue: () => {
    const job = ingestQueueService.dequeueIngest();
    set({ jobs: ingestQueueService.getAllJobs() });
    return job;
  },

  ack: (id) => {
    const result = ingestQueueService.ackIngest(id);
    set({ jobs: ingestQueueService.getAllJobs() });
    return result;
  },

  fail: (id, error) => {
    const result = ingestQueueService.failIngest(id, error);
    set({ jobs: ingestQueueService.getAllJobs() });
    return result;
  },

  refresh: () => {
    set({ jobs: ingestQueueService.getAllJobs() });
  },

  clearCompleted: () => {
    ingestQueueService.clearCompleted();
    set({ jobs: ingestQueueService.getAllJobs() });
  },

  clearAll: () => {
    ingestQueueService.clearAll();
    set({ jobs: [] });
  },
}));
