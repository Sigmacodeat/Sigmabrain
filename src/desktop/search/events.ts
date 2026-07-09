import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SearchEvent, SearchEventPayload } from "./types";

type EventCallback = (payload: SearchEventPayload) => void;

async function on(event: SearchEvent, callback: EventCallback): Promise<UnlistenFn> {
  return listen<SearchEventPayload>(event, (e) => callback(e.payload));
}

export async function onDocumentIndexed(callback: EventCallback): Promise<UnlistenFn> {
  return on("document-indexed", callback);
}

export async function onIndexRebuilt(callback: EventCallback): Promise<UnlistenFn> {
  return on("index-rebuilt", callback);
}

export async function onSearchCacheInvalidated(callback: EventCallback): Promise<UnlistenFn> {
  return on("search-cache-invalidated", callback);
}
