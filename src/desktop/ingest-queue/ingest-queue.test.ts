import { describe, it, expect, beforeEach } from "bun:test";
import { IngestQueueService } from "./ingest-queue-service";
import { computeDedupKey, DEFAULT_INGEST_CONFIG } from "@/core/ingest-types";
import type { IngestItem } from "@/core/ingest-types";

describe("WP-106: Local Ingest Queue — Tests", () => {
  let queue: IngestQueueService;

  beforeEach(() => {
    queue = new IngestQueueService();
    queue.setConfig({
      maxAttempts: 3,
      retryDelayMs: 100,
      maxQueueSize: 100,
      dedupWindowMs: 1000,
    });
    queue.clearAll();
  });

  function makeItem(path: string, changeType: "created" | "modified" | "removed" = "created"): IngestItem {
    return {
      path,
      canonicalPath: path,
      changeType,
      size: 1024,
      mimeType: "text/plain",
    };
  }

  describe("Enqueue/Dequeue Tests", () => {
    it("enqueues an item and returns a job", () => {
      const job = queue.enqueueIngest(makeItem("/home/user/docs/file.txt"));
      expect(job).not.toBeNull();
      expect(job!.status).toBe("queued");
      expect(job!.item.path).toBe("/home/user/docs/file.txt");
      expect(job!.attempts).toBe(0);
    });

    it("dequeue returns the first queued job", () => {
      queue.enqueueIngest(makeItem("/home/user/docs/file1.txt"));
      queue.enqueueIngest(makeItem("/home/user/docs/file2.txt"));
      const job = queue.dequeueIngest();
      expect(job).not.toBeNull();
      expect(job!.status).toBe("processing");
      expect(job!.attempts).toBe(1);
    });

    it("dequeue returns null when queue is empty", () => {
      expect(queue.dequeueIngest()).toBeNull();
    });

    it("dequeue respects priority ordering", () => {
      queue.enqueueIngest(makeItem("/low"), "low");
      queue.enqueueIngest(makeItem("/high"), "high");
      queue.enqueueIngest(makeItem("/normal"), "normal");
      const job = queue.dequeueIngest();
      expect(job!.item.path).toBe("/high");
    });

    it("dequeue respects FIFO within same priority", () => {
      queue.enqueueIngest(makeItem("/first"));
      queue.enqueueIngest(makeItem("/second"));
      const job = queue.dequeueIngest();
      expect(job!.item.path).toBe("/first");
    });
  });

  describe("Ack/Fail Tests", () => {
    it("ack completes a processing job", () => {
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      const result = queue.ackIngest(job!.id);
      expect(result).toBe(true);
      const updated = queue.getJob(job!.id);
      expect(updated!.status).toBe("completed");
      expect(updated!.completedAt).not.toBeNull();
    });

    it("ack fails for non-processing job", () => {
      const job = queue.enqueueIngest(makeItem("/file.txt"));
      expect(queue.ackIngest(job!.id)).toBe(false);
    });

    it("fail re-queues job when attempts remain", () => {
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      queue.failIngest(job!.id, "parse error");
      const updated = queue.getJob(job!.id);
      expect(updated!.status).toBe("queued");
      expect(updated!.lastError).toBe("parse error");
    });

    it("fail sends to dead_letter after max attempts", () => {
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      queue.failIngest(job!.id, "error 1");
      const requeued = queue.dequeueIngest();
      queue.failIngest(requeued!.id, "error 2");
      const requeued2 = queue.dequeueIngest();
      queue.failIngest(requeued2!.id, "error 3");
      const updated = queue.getJob(job!.id);
      expect(updated!.status).toBe("dead_letter");
      expect(updated!.attempts).toBe(3);
    });

    it("fail fails for non-processing job", () => {
      const job = queue.enqueueIngest(makeItem("/file.txt"));
      expect(queue.failIngest(job!.id, "error")).toBe(false);
    });
  });

  describe("Dedup Tests", () => {
    it("deduplicates identical items within window", () => {
      const item = makeItem("/file.txt", "created");
      queue.enqueueIngest(item);
      const second = queue.enqueueIngest(item);
      expect(second).toBeNull();
    });

    it("allows same path with different change type", () => {
      queue.enqueueIngest(makeItem("/file.txt", "created"));
      const second = queue.enqueueIngest(makeItem("/file.txt", "modified"));
      expect(second).not.toBeNull();
    });

    it("allows same path after dedup window expires", () => {
      queue.setConfig({ maxAttempts: 3, retryDelayMs: 100, maxQueueSize: 100, dedupWindowMs: 50 });

      const item = makeItem("/file.txt", "created");
      queue.enqueueIngest(item);
      const first = queue.dequeueIngest();
      queue.ackIngest(first!.id);

      // Wait for dedup window to expire
      const start = Date.now();
      while (Date.now() - start < 60) {
        // busy wait
      }

      const second = queue.enqueueIngest(item);
      expect(second).not.toBeNull();
    });

    it("does not dedup completed jobs", () => {
      const item = makeItem("/file.txt", "created");
      const job = queue.enqueueIngest(item);
      const dequeued = queue.dequeueIngest();
      queue.ackIngest(dequeued!.id);

      // Same item should be enqueued since original is completed
      const second = queue.enqueueIngest(item);
      expect(second).not.toBeNull();
    });

    it("computeDedupKey is deterministic", () => {
      const item = makeItem("/file.txt", "modified");
      const key1 = computeDedupKey(item);
      const key2 = computeDedupKey(item);
      expect(key1).toBe(key2);
    });

    it("computeDedupKey differs for different change types", () => {
      const key1 = computeDedupKey(makeItem("/file.txt", "created"));
      const key2 = computeDedupKey(makeItem("/file.txt", "modified"));
      expect(key1).not.toBe(key2);
    });
  });

  describe("Retry Bounded Tests", () => {
    it("respects maxAttempts from config", () => {
      queue.setConfig({ maxAttempts: 2, retryDelayMs: 100, maxQueueSize: 100, dedupWindowMs: 1000 });
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      expect(job!.maxAttempts).toBe(2);
    });

    it("job goes to dead_letter after exhausting retries", () => {
      queue.setConfig({ maxAttempts: 2, retryDelayMs: 100, maxQueueSize: 100, dedupWindowMs: 1000 });
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      queue.failIngest(job!.id, "err");
      const j2 = queue.dequeueIngest();
      queue.failIngest(j2!.id, "err");
      const updated = queue.getJob(job!.id);
      expect(updated!.status).toBe("dead_letter");
      expect(updated!.attempts).toBe(2);
    });
  });

  describe("Queue Management Tests", () => {
    it("getPendingJobs returns only queued jobs", () => {
      queue.enqueueIngest(makeItem("/a"));
      queue.enqueueIngest(makeItem("/b"));
      queue.dequeueIngest();
      const pending = queue.getPendingJobs();
      expect(pending.length).toBe(1);
    });

    it("getFailedJobs returns dead_letter jobs", () => {
      queue.setConfig({ maxAttempts: 1, retryDelayMs: 100, maxQueueSize: 100, dedupWindowMs: 1000 });
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      queue.failIngest(job!.id, "err");
      const failed = queue.getFailedJobs();
      expect(failed.length).toBe(1);
      expect(failed[0].status).toBe("dead_letter");
    });

    it("clearCompleted removes only completed jobs", () => {
      queue.enqueueIngest(makeItem("/a"));
      queue.enqueueIngest(makeItem("/b"));
      const j1 = queue.dequeueIngest();
      queue.ackIngest(j1!.id);
      queue.clearCompleted();
      expect(queue.getCompletedJobs().length).toBe(0);
      expect(queue.getPendingJobs().length).toBe(1);
    });

    it("clearAll removes everything", () => {
      queue.enqueueIngest(makeItem("/a"));
      queue.enqueueIngest(makeItem("/b"));
      queue.clearAll();
      expect(queue.getQueueSize()).toBe(0);
    });

    it("respects maxQueueSize", () => {
      queue.setConfig({ maxAttempts: 3, retryDelayMs: 100, maxQueueSize: 2, dedupWindowMs: 1000 });
      queue.enqueueIngest(makeItem("/a"));
      queue.enqueueIngest(makeItem("/b"));
      const rejected = queue.enqueueIngest(makeItem("/c"));
      expect(rejected).toBeNull();
    });
  });

  describe("Event Emission Tests", () => {
    it("emits ingest-queued on enqueue", () => {
      const events: string[] = [];
      queue.onEvent((e) => events.push(e.status));
      queue.enqueueIngest(makeItem("/file.txt"));
      expect(events).toContain("queued");
    });

    it("emits ingest-started on dequeue", () => {
      const events: string[] = [];
      queue.enqueueIngest(makeItem("/file.txt"));
      queue.onEvent((e) => events.push(e.status));
      queue.dequeueIngest();
      expect(events).toContain("processing");
    });

    it("emits ingest-completed on ack", () => {
      const events: string[] = [];
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      queue.onEvent((e) => events.push(e.status));
      queue.ackIngest(job!.id);
      expect(events).toContain("completed");
    });

    it("emits ingest-failed on fail", () => {
      const events: string[] = [];
      queue.enqueueIngest(makeItem("/file.txt"));
      const job = queue.dequeueIngest();
      queue.onEvent((e) => events.push(e.status));
      queue.failIngest(job!.id, "err");
      expect(events).toContain("queued");
    });
  });

  describe("Module Structure Tests", () => {
    it("ingest-queue module files exist", () => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(import.meta.dir);
      expect(fs.existsSync(path.join(dir, "ingest-queue-service.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "store.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "events.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "use-ingest-queue.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "index.ts"))).toBe(true);
    });

    it("ingest-types module exists", () => {
      const fs = require("fs");
      const path = require("path");
      const corePath = path.join(import.meta.dir, "..", "..", "core", "ingest-types.ts");
      expect(fs.existsSync(corePath)).toBe(true);
    });

    it("DEFAULT_INGEST_CONFIG has correct defaults", () => {
      expect(DEFAULT_INGEST_CONFIG.maxAttempts).toBe(3);
      expect(DEFAULT_INGEST_CONFIG.maxQueueSize).toBe(1000);
    });

    it("events module exports listeners", async () => {
      const mod = await import("./events");
      expect(typeof mod.onIngestQueued).toBe("function");
      expect(typeof mod.onIngestStarted).toBe("function");
      expect(typeof mod.onIngestCompleted).toBe("function");
      expect(typeof mod.onIngestFailed).toBe("function");
    });
  });
});
