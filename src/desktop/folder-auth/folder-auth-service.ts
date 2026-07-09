import { canonicalizePath, detectPathTraversal, isSymlinkPath, isPathWithinDirectory } from "@/core/path-utils";
import { isTauriEnvironment } from "../runtime";
import { useFolderGrantStore } from "./grant-store";
import { FolderAuthError } from "./types";
import type { FolderAuthEventPayload, FolderGrant } from "./types";
import { emit } from "@tauri-apps/api/event";

function emitFolderAuthEvent(
  event: "folder-authorized" | "folder-revoked" | "folder-authorization-denied",
  payload: FolderAuthEventPayload,
) {
  if (!isTauriEnvironment()) return;
  emit(event, payload).catch(() => {
    // Event emission is best-effort; must never break folder auth flow.
  });
}

function deniedPayload(
  path: string,
  canonicalPath: string,
  reason: string,
): FolderAuthEventPayload {
  return {
    path,
    canonicalPath,
    timestamp: new Date().toISOString(),
    success: false,
    reason,
  };
}

export class FolderAuthService {
  authorizeFolder(path: string, label?: string): FolderGrant {
    if (!path || typeof path !== "string") {
      emitFolderAuthEvent(
        "folder-authorization-denied",
        deniedPayload(path, "", "path must be a non-empty string"),
      );
      throw new FolderAuthError("INVALID_PATH", "path must be a non-empty string");
    }

    if (isSymlinkPath(path)) {
      emitFolderAuthEvent(
        "folder-authorization-denied",
        deniedPayload(path, "", "symlink or expansion character detected"),
      );
      throw new FolderAuthError("SYMLINK_DETECTED", "symlink or expansion character detected");
    }

    if (detectPathTraversal(path)) {
      emitFolderAuthEvent(
        "folder-authorization-denied",
        deniedPayload(path, "", "path traversal detected"),
      );
      throw new FolderAuthError("PATH_TRAVERSAL", "path traversal detected");
    }

    let canonical: string;
    try {
      canonical = canonicalizePath(path);
    } catch (e) {
      const message = e instanceof Error ? e.message : "invalid path";
      emitFolderAuthEvent("folder-authorization-denied", deniedPayload(path, "", message));
      throw new FolderAuthError("INVALID_PATH", message);
    }

    const store = useFolderGrantStore.getState();
    const existing = store.findGrant(canonical);
    if (existing) {
      emitFolderAuthEvent(
        "folder-authorization-denied",
        deniedPayload(path, canonical, "folder is already authorized"),
      );
      throw new FolderAuthError("ALREADY_AUTHORIZED", "folder is already authorized");
    }

    const grant = store.addGrant(canonical, path, label);
    emitFolderAuthEvent("folder-authorized", {
      path,
      canonicalPath: canonical,
      timestamp: new Date().toISOString(),
      success: true,
    });
    return grant;
  }

  revokeFolder(path: string): void {
    if (!path || typeof path !== "string") {
      emitFolderAuthEvent(
        "folder-authorization-denied",
        deniedPayload(path, "", "path must be a non-empty string"),
      );
      throw new FolderAuthError("INVALID_PATH", "path must be a non-empty string");
    }

    let canonical: string;
    try {
      canonical = canonicalizePath(path);
    } catch (e) {
      const message = e instanceof Error ? e.message : "invalid path";
      emitFolderAuthEvent("folder-authorization-denied", deniedPayload(path, "", message));
      throw new FolderAuthError("INVALID_PATH", message);
    }

    const store = useFolderGrantStore.getState();
    const grant = store.findGrant(canonical);
    if (!grant) {
      emitFolderAuthEvent(
        "folder-authorization-denied",
        deniedPayload(path, canonical, "folder is not authorized"),
      );
      throw new FolderAuthError("NOT_FOUND", "folder is not authorized");
    }

    store.revokeGrant(canonical);
    emitFolderAuthEvent("folder-revoked", {
      path,
      canonicalPath: canonical,
      timestamp: new Date().toISOString(),
      success: true,
    });
  }

  listAuthorizedFolders(): FolderGrant[] {
    return useFolderGrantStore.getState().listActive();
  }

  isAuthorized(path: string): boolean {
    try {
      const canonical = canonicalizePath(path);
      return useFolderGrantStore.getState().isAuthorized(canonical);
    } catch {
      return false;
    }
  }

  isPathAuthorized(candidate: string): boolean {
    let canonicalCandidate: string;
    try {
      canonicalCandidate = canonicalizePath(candidate);
    } catch {
      return false;
    }
    if (detectPathTraversal(candidate) || isSymlinkPath(candidate)) {
      return false;
    }

    const grants = this.listAuthorizedFolders();
    for (const grant of grants) {
      if (
        canonicalCandidate === grant.canonicalPath ||
        isPathWithinDirectory(canonicalCandidate, grant.canonicalPath)
      ) {
        return true;
      }
    }
    return false;
  }

  init(): void {
    useFolderGrantStore.getState().load();
  }
}

export const folderAuthService = new FolderAuthService();
