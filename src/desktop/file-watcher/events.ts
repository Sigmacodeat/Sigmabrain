import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WatcherEventName, WatcherEventPayload } from "@/core/watch-types";

type EventCallback = (payload: WatcherEventPayload) => void;

async function on(event: WatcherEventName, callback: EventCallback): Promise<UnlistenFn> {
  return listen<WatcherEventPayload>(event, (e) => callback(e.payload));
}

export async function onFileObserved(callback: EventCallback): Promise<UnlistenFn> {
  return on("file-observed", callback);
}

export async function onFileChanged(callback: EventCallback): Promise<UnlistenFn> {
  return on("file-changed", callback);
}

export async function onFileRemoved(callback: EventCallback): Promise<UnlistenFn> {
  return on("file-removed", callback);
}

export async function onFileIgnored(callback: EventCallback): Promise<UnlistenFn> {
  return on("file-ignored", callback);
}
