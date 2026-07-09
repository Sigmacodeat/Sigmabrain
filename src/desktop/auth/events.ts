import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DesktopAuthEventName, DesktopAuthEventPayload } from "@/core/session-types";

type EventCallback = (payload: DesktopAuthEventPayload) => void;

async function on(event: DesktopAuthEventName, callback: EventCallback): Promise<UnlistenFn> {
  return listen<DesktopAuthEventPayload>(event, (e) => callback(e.payload));
}

export async function onSessionStarted(callback: EventCallback): Promise<UnlistenFn> {
  return on("desktop-session-started", callback);
}

export async function onSessionRestored(callback: EventCallback): Promise<UnlistenFn> {
  return on("desktop-session-restored", callback);
}

export async function onSessionEnded(callback: EventCallback): Promise<UnlistenFn> {
  return on("desktop-session-ended", callback);
}
