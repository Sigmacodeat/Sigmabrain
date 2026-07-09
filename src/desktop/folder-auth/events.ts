import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FolderAuthEventName, FolderAuthEventPayload } from "./types";

type EventCallback = (payload: FolderAuthEventPayload) => void;

async function on(event: FolderAuthEventName, callback: EventCallback): Promise<UnlistenFn> {
  return listen<FolderAuthEventPayload>(event, (e) => callback(e.payload));
}

export async function onFolderAuthorized(callback: EventCallback): Promise<UnlistenFn> {
  return on("folder-authorized", callback);
}

export async function onFolderRevoked(callback: EventCallback): Promise<UnlistenFn> {
  return on("folder-revoked", callback);
}

export async function onFolderAuthorizationDenied(callback: EventCallback): Promise<UnlistenFn> {
  return on("folder-authorization-denied", callback);
}
