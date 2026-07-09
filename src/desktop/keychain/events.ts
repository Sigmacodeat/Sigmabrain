import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { KeychainEventName, KeychainEventPayload } from "@/core/secure-store-types";

type EventCallback = (payload: KeychainEventPayload) => void;

const listeners = new Map<string, Set<UnlistenFn>>();

async function on(event: KeychainEventName, callback: EventCallback): Promise<UnlistenFn> {
  const unlisten = await listen<KeychainEventPayload>(event, (e) => callback(e.payload));
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(unlisten);
  return unlisten;
}

export async function onSecretStored(callback: EventCallback): Promise<UnlistenFn> {
  return on("secret-stored", callback);
}

export async function onSecretLoaded(callback: EventCallback): Promise<UnlistenFn> {
  return on("secret-loaded", callback);
}

export async function onSecretDeleted(callback: EventCallback): Promise<UnlistenFn> {
  return on("secret-deleted", callback);
}

export function offKeychainEvent(unlisten: UnlistenFn): void {
  unlisten();
  for (const set of listeners.values()) {
    set.delete(unlisten);
  }
}
