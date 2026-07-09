export type FileChangeType = "created" | "modified" | "removed";

export interface FileChangeEvent {
  path: string;
  canonicalPath: string;
  changeType: FileChangeType;
  timestamp: string;
  size: number | null;
}

export type WatcherStatus = "idle" | "watching" | "stopped" | "error";

export interface WatcherConfig {
  debounceMs: number;
  ignoreDotFiles: boolean;
  ignorePatterns: string[];
  maxFileSize: number | null;
}

export type WatcherEventName =
  | "file-observed"
  | "file-changed"
  | "file-removed"
  | "file-ignored";

export interface WatcherEventPayload {
  path: string;
  canonicalPath: string;
  changeType: FileChangeType;
  timestamp: string;
  reason?: string;
}

export const DEFAULT_WATCHER_CONFIG: WatcherConfig = {
  debounceMs: 300,
  ignoreDotFiles: true,
  ignorePatterns: ["node_modules", ".git", "tmp", "dist", "build", ".next"],
  maxFileSize: 100 * 1024 * 1024,
};
