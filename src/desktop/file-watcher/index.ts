export { fileWatcherService, FileWatcherService } from "./watcher-service";
export { onFileObserved, onFileChanged, onFileRemoved, onFileIgnored } from "./events";
export { useFileWatcher } from "./use-file-watcher";
export type { FileChangeEvent, FileChangeType, WatcherConfig, WatcherStatus, WatcherEventName, WatcherEventPayload } from "@/core/watch-types";
