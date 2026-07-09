"use client";

import { useEffect, useCallback, useRef } from "react";
import { fileWatcherService } from "./watcher-service";
import { useFolderGrantStore } from "../folder-auth/grant-store";
import type { FileChangeEvent, WatcherConfig } from "@/core/watch-types";

export function useFileWatcher() {
  const grants = useFolderGrantStore((s) => s.grants);
  const loadGrants = useFolderGrantStore((s) => s.load);
  const eventsRef = useRef<FileChangeEvent[]>([]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  const start = useCallback(() => {
    const activePaths = grants
      .filter((g) => g.status === "active")
      .map((g) => g.canonicalPath);
    fileWatcherService.startWatcher(activePaths);
  }, [grants]);

  const stop = useCallback(() => {
    fileWatcherService.stopWatcher();
  }, []);

  const onEvent = useCallback((callback: (event: FileChangeEvent) => void) => {
    return fileWatcherService.onFileEvent(callback);
  }, []);

  const setConfig = useCallback((config: Partial<WatcherConfig>) => {
    fileWatcherService.setConfig(config);
  }, []);

  return {
    status: fileWatcherService.getStatus(),
    watchedPaths: fileWatcherService.getWatchedPaths(),
    isWatching: fileWatcherService.isWatching(),
    start,
    stop,
    onEvent,
    setConfig,
  };
}
