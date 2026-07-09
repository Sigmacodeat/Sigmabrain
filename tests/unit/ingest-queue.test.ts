import { describe, it, expect, beforeEach } from "bun:test";
import { ingestService } from "../../src/desktop/ingest/ingest-service";
import { useIngestStore } from "../../src/desktop/ingest/queue-store";
import { DEFAULT_RETRY_POLICY } from "../../src/desktop/ingest/types";

describe("WP-106: Local Ingest Queue", () => {
  beforeEach(() => {
    useIngestStore.getState().clear();
  });

  describe("enqueue / dedup", () => {
    it("enqueues a new file", async () => {
      const job = await ingestService.enqueue({
        filePath: "/authorized/docs/test.pdf",
        folderRootId: "root-1",
        size: 1024,
        modifiedAt: "2024-01-01T10:00:00Z",
      });

      expect(job.status).toBe("queued");
      expect(job.attempts).toBe(0);
      expect(job.filePath).toBe("/authorized/docs/test.pdf");
      expect(job.dedupKey).toBeTruthy();
    });

    it("deduplicates by content hash", async () => {
      const job1 = await ingestService.enqueue({
        filePath: "/docs/a.pdf",
        folderRootId: "root-1",
        size: 100,
        modifiedAt: "2024-01-01T10:00:00Z",
        contentHash: "abc123",
      });

      const job2 = await ingestService.enqueue({
        filePath: "/docs/b.pdf",
        folderRootId: "root-1",
        size: 100,
        modifiedAt: "2024-01-01T10:00:00Z",
        contentHash: "abc123",
      });

      expect(job2.id).toBe(job1.id);
    });

    it("does not deduplicate against dead-lettered jobs", async () => {
      const job1 = await ingestService.enqueue({
        filePath: "/docs/a.pdf",
        folderRootId: "root-1",
        size: 100,
        modifiedAt: "2024-01-01T10:00:00Z",
        contentHash: "abc123",
        retryPolicy: { maxAttempts: 1 },
      });

      // Process and fail to dead-letter it
      const dequeued = ingestService.dequeue();
      expect(dequeued).not.toBeNull();
      ingestService.fail(job1.id, "parse_error");

      expect(ingestService.get(job1.id)?.status).toBe("dead_letter");

      // New enqueue with same hash should create a new job
      const job2 = await ingestService.enqueue({
        filePath: "/docs/a.pdf",
        folderRootId: "root-1",
        size: 100,
        modifiedAt: "2024-01-01T10:00:00Z",
        contentHash: "abc123",
      });

      expect(job2.id).not.toBe(job1.id);
    });
  });

  describe("dequeue", () => {
    it("returns null when queue is empty", () => {
      expect(ingestService.dequeue()).toBeNull();
    });

    it("returns the highest priority job first", async () => {
      await ingestService.enqueue({
        filePath: "/docs/low.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
        priority: "low",
      });
      await ingestService.enqueue({
        filePath: "/docs/high.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
        priority: "high",
      });
      await ingestService.enqueue({
        filePath: "/docs/normal.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
        priority: "normal",
      });

      const first = ingestService.dequeue();
      expect(first?.filePath).toBe("/docs/high.pdf");

      const second = ingestService.dequeue();
      expect(second?.filePath).toBe("/docs/normal.pdf");

      const third = ingestService.dequeue();
      expect(third?.filePath).toBe("/docs/low.pdf");
    });

    it("increments attempt count on dequeue", async () => {
      const job = await ingestService.enqueue({
        filePath: "/docs/test.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });

      const dequeued = ingestService.dequeue();
      expect(dequeued?.attempts).toBe(1);
    });

    it("sets status to processing", async () => {
      await ingestService.enqueue({
        filePath: "/docs/test.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });

      const dequeued = ingestService.dequeue();
      expect(dequeued?.status).toBe("processing");
    });
  });

  describe("ack", () => {
    it("marks job as completed", async () => {
      const job = await ingestService.enqueue({
        filePath: "/docs/test.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });

      ingestService.dequeue();
      ingestService.ack(job.id, "brain/page/test");

      const completed = ingestService.get(job.id);
      expect(completed?.status).toBe("completed");
      expect(completed?.resultSlug).toBe("brain/page/test");
    });
  });

  describe("fail / retry", () => {
    it("requeues on failure when attempts remain", async () => {
      const job = await ingestService.enqueue({
        filePath: "/docs/test.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
        retryPolicy: { maxAttempts: 3 },
      });

      ingestService.dequeue();
      ingestService.fail(job.id, "network_error");

      const failed = ingestService.get(job.id);
      expect(failed?.status).toBe("queued");
      expect(failed?.lastError).toBe("network_error");
    });

    it("dead-letters after max attempts", async () => {
      const job = await ingestService.enqueue({
        filePath: "/docs/test.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
        retryPolicy: { maxAttempts: 2 },
      });

      // First attempt
      ingestService.dequeue();
      ingestService.fail(job.id, "error_1");
      expect(ingestService.get(job.id)?.status).toBe("queued");

      // Second attempt (exceeds maxAttempts=2)
      ingestService.dequeue();
      ingestService.fail(job.id, "error_2");
      expect(ingestService.get(job.id)?.status).toBe("dead_letter");
      expect(ingestService.get(job.id)?.attempts).toBe(2);
    });
  });

  describe("retry delay (exponential backoff)", () => {
    it("calculates exponential backoff delay", () => {
      const policy = DEFAULT_RETRY_POLICY;
      const delay1 = ingestService.getRetryDelay(1, policy);
      const delay2 = ingestService.getRetryDelay(2, policy);
      const delay3 = ingestService.getRetryDelay(3, policy);

      expect(delay1).toBe(policy.baseDelayMs);
      expect(delay2).toBe(policy.baseDelayMs * policy.backoffMultiplier);
      expect(delay3).toBe(policy.baseDelayMs * policy.backoffMultiplier * policy.backoffMultiplier);
    });

    it("caps delay at maxDelayMs", () => {
      const delay = ingestService.getRetryDelay(20, DEFAULT_RETRY_POLICY);
      expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxDelayMs);
    });
  });

  describe("crash recovery", () => {
    it("requeues stale processing jobs", async () => {
      const job = await ingestService.enqueue({
        filePath: "/docs/test.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });

      // Simulate processing (job gets stuck in "processing")
      useIngestStore.getState().dequeue();

      // Manually set startedAt to old time to simulate stale
      const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
      useIngestStore.setState((s) => ({
        jobs: s.jobs.map((j) => j.id === job.id ? { ...j, startedAt: oldTime } : j),
      }));

      const requeued = ingestService.requeueStale(5 * 60 * 1000); // 5 min threshold
      expect(requeued).toBe(1);
      expect(ingestService.get(job.id)?.status).toBe("queued");
    });

    it("does not requeue recently started jobs", async () => {
      const job = await ingestService.enqueue({
        filePath: "/docs/test.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });

      ingestService.dequeue();
      const requeued = ingestService.requeueStale(5 * 60 * 1000);
      expect(requeued).toBe(0);
    });
  });

  describe("stats", () => {
    it("returns correct queue statistics", async () => {
      await ingestService.enqueue({
        filePath: "/docs/a.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });
      await ingestService.enqueue({
        filePath: "/docs/b.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });

      const job1 = ingestService.dequeue();
      ingestService.ack(job1!.id, "slug-1");

      const stats = ingestService.stats();
      expect(stats.queued).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.totalProcessed).toBe(1);
    });
  });

  describe("listByStatus", () => {
    it("filters jobs by status", async () => {
      await ingestService.enqueue({
        filePath: "/docs/a.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });
      await ingestService.enqueue({
        filePath: "/docs/b.pdf",
        folderRootId: "r",
        size: 10,
        modifiedAt: "2024-01-01",
      });

      const queued = ingestService.listByStatus("queued");
      expect(queued).toHaveLength(2);

      const job = ingestService.dequeue();
      ingestService.ack(job!.id);

      const completed = ingestService.listByStatus("completed");
      expect(completed).toHaveLength(1);

      const stillQueued = ingestService.listByStatus("queued");
      expect(stillQueued).toHaveLength(1);
    });
  });
});
