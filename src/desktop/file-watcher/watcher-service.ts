import { canonicalizePath, detectPathTraversal, isSymlinkPath, isPathWithinDirectory } from "@/core/path-utils";
import { isTauriEnvironment } from "../runtime";
import { folderAuthService } from "../folder-auth/folder-auth-service";
import type { FileChangeEvent, FileChangeType, WatcherConfig, WatcherEventPayload } from "@/core/watch-types";
import { DEFAULT_WATCHER_CONFIG } from "@/core/watch-types";
import { emit } from "@tauri-apps/api/event";

type FileEventCallback = (event: FileChangeEvent) => void;

function emitWatcherEvent(
  event: "file-observed" | "file-changed" | "file-removed" | "file-ignored",
  payload: WatcherEventPayload,
) {
  if (!isTauriEnvironment()) return;
  emit(event, payload).catch(() => {
    // Event emission is best-effort; must never break watcher flow.
  });
}

interface PendingChange {
  path: string;
  canonicalPath: string;
  changeType: FileChangeType;
  firstSeen: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export class FileWatcherService {
  private config: WatcherConfig = DEFAULT_WATCHER_CONFIG;
  private watchedPaths: Set<string> = new Set();
  private pending: Map<string, PendingChange> = new Map();
  private processed: Set<string> = new Set();
  private status: "idle" | "watching" | "stopped" | "error" = "idle";
  private listeners: Set<FileEventCallback> = new Set();
  private processedHistory: Map<string, number> = new Map();

  startWatcher(paths: string[]): void {
    const authorizedPaths: string[] = [];

    for (const rawPath of paths) {
      if (!rawPath || typeof rawPath !== "string") continue;
      if (isSymlinkPath(rawPath)) continue;
      if (detectPathTraversal(rawPath)) continue;

      let canonical: string;
      try {
        canonical = canonicalizePath(rawPath);
      } catch {
        continue;
      }

      if (!folderAuthService.isAuthorized(canonical)) {
        continue;
      }

      authorizedPaths.push(canonical);
    }

    if (authorizedPaths.length === 0) {
      this.status = "error";
      return;
    }

    this.watchedPaths = new Set(authorizedPaths);
    this.status = "watching";
  }

  stopWatcher(): void {
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
    }
    this.pending.clear();
    this.watchedPaths.clear();
    this.status = "stopped";
  }

  isWatching(): boolean {
    return this.status === "watching";
  }

  getStatus(): "idle" | "watching" | "stopped" | "error" {
    return this.status;
  }

  getWatchedPaths(): string[] {
    return Array.from(this.watchedPaths);
  }

  onFileEvent(callback: FileEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  setConfig(config: Partial<WatcherConfig>): void {
    this.config = { ...this.config, ...config };
  }

  shouldIgnore(path: string): boolean {
    if (this.config.ignoreDotFiles) {
      const parts = path.split(/[\/\\]/);
      for (const part of parts) {
        if (part.startsWith(".") && part !== "." && part !== "..") {
          return true;
        }
      }
    }

    for (const pattern of this.config.ignorePatterns) {
      if (path.includes(pattern)) return true;
    }

    return false;
  }

  isPathWatched(path: string): boolean {
    if (isSymlinkPath(path)) return false;

    let canonical: string;
    try {
      canonical = canonicalizePath(path);
    } catch {
      return false;
    }

    if (detectPathTraversal(path)) return false;

    for (const watched of this.watchedPaths) {
      if (
        canonical === watched ||
        isPathWithinDirectory(canonical, watched)
      ) {
        return true;
      }
    }
    return false;
  }

  private ignoreReason(path: string): string | null {
    if (this.config.ignoreDotFiles) {
      const parts = path.split(/[\/\\]/);
      for (const part of parts) {
        if (part.startsWith(".") && part !== "." && part !== "..") {
          return "dotfile";
        }
      }
    }
    for (const pattern of this.config.ignorePatterns) {
      if (path.includes(pattern)) return `ignore pattern: ${pattern}`;
    }
    return null;
  }

  emitChange(path: string, changeType: FileChangeType, size: number | null = null): void {
    if (this.status !== "watching") return;
    if (isSymlinkPath(path)) return;
    if (!this.isPathWatched(path)) return;

    let canonical: string;
    try {
      canonical = canonicalizePath(path);
    } catch {
      return;
    }

    const ignoreReason = this.ignoreReason(path);
    if (ignoreReason) {
      emitWatcherEvent("file-ignored", {
        path,
        canonicalPath: canonical,
        changeType,
        timestamp: new Date().toISOString(),
        reason: ignoreReason,
      });
      return;
    }

    if (
      this.config.maxFileSize !== null &&
      size !== null &&
      size > this.config.maxFileSize
    ) {
      emitWatcherEvent("file-ignored", {
        path,
        canonicalPath: canonical,
        changeType,
        timestamp: new Date().toISOString(),
        reason: `maxFileSize exceeded: ${size} > ${this.config.maxFileSize}`,
      });
      return;
    }

    const now = Date.now();

    const lastProcessed = this.processedHistory.get(canonical);
    if (lastProcessed && now - lastProcessed < this.config.debounceMs) {
      return;
    }

    const existing = this.pending.get(canonical);
    if (existing && existing.timer) {
      clearTimeout(existing.timer);
    }

    const watcherEvent: WatcherEventPayload = {
      path,
      canonicalPath: canonical,
      changeType,
      timestamp: new Date().toISOString(),
    };

    const timer = setTimeout(() => {
      const pending = this.pending.get(canonical);
      if (!pending) return;

      const event: FileChangeEvent = {
        path: pending.path,
        canonicalPath: pending.canonicalPath,
        changeType: pending.changeType,
        timestamp: new Date().toISOString(),
        size,
      };

      this.processedHistory.set(canonical, Date.now());
      this.pending.delete(canonical);

      for (const listener of this.listeners) {
        listener(event);
      }

      const eventName: Record<FileChangeType, "file-observed" | "file-changed" | "file-removed"> = {
        created: "file-observed",
        modified: "file-changed",
        removed: "file-removed",
      };
      emitWatcherEvent(eventName[pending.changeType], watcherEvent);
    }, this.config.debounceMs);

    this.pending.set(canonical, {
      path,
      canonicalPath: canonical,
      changeType,
      firstSeen: now,
      timer,
    });
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  getProcessedCount(): number {
    return this.processedHistory.size;
  }

  clearHistory(): void {
    this.processedHistory.clear();
    this.processed.clear();
  }
}

export const fileWatcherService = new FileWatcherService();
