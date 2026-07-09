"use client";

import { useEffect, useCallback } from "react";
import { useIngestStore } from "./store";
import type { IngestItem, IngestJobPriority } from "@/core/ingest-types";

export function useIngestQueue() {
  const jobs = useIngestStore((s) => s.jobs);
  const initialized = useIngestStore((s) => s.initialized);
  const init = useIngestStore((s) => s.init);
  const enqueue = useIngestStore((s) => s.enqueue);
  const dequeue = useIngestStore((s) => s.dequeue);
  const ack = useIngestStore((s) => s.ack);
  const fail = useIngestStore((s) => s.fail);
  const refresh = useIngestStore((s) => s.refresh);
  const clearCompleted = useIngestStore((s) => s.clearCompleted);
  const clearAll = useIngestStore((s) => s.clearAll);

  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  const enqueueItem = useCallback(
    (item: IngestItem, priority?: IngestJobPriority) => {
      return enqueue(item, priority);
    },
    [enqueue],
  );

  const dequeueNext = useCallback(() => {
    return dequeue();
  }, [dequeue]);

  const ackJob = useCallback(
    (id: string) => {
      return ack(id);
    },
    [ack],
  );

  const failJob = useCallback(
    (id: string, error: string) => {
      return fail(id, error);
    },
    [fail],
  );

  const pendingJobs = jobs.filter((j) => j.status === "queued");
  const processingJobs = jobs.filter((j) => j.status === "processing");
  const failedJobs = jobs.filter((j) => j.status === "failed" || j.status === "dead_letter");
  const completedJobs = jobs.filter((j) => j.status === "completed");

  return {
    jobs,
    pendingJobs,
    processingJobs,
    failedJobs,
    completedJobs,
    queueSize: jobs.length,
    enqueue: enqueueItem,
    dequeue: dequeueNext,
    ack: ackJob,
    fail: failJob,
    refresh,
    clearCompleted,
    clearAll,
  };
}
