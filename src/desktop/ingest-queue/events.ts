import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { IngestEventName, IngestEventPayload } from "@/core/ingest-types";

type EventCallback = (payload: IngestEventPayload) => void;

async function on(event: IngestEventName, callback: EventCallback): Promise<UnlistenFn> {
  return listen<IngestEventPayload>(event, (e) => callback(e.payload));
}

export async function onIngestQueued(callback: EventCallback): Promise<UnlistenFn> {
  return on("ingest-queued", callback);
}

export async function onIngestStarted(callback: EventCallback): Promise<UnlistenFn> {
  return on("ingest-started", callback);
}

export async function onIngestCompleted(callback: EventCallback): Promise<UnlistenFn> {
  return on("ingest-completed", callback);
}

export async function onIngestFailed(callback: EventCallback): Promise<UnlistenFn> {
  return on("ingest-failed", callback);
}
