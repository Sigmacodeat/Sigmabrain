export type FolderGrantStatus = "active" | "revoked";

export interface FolderGrant {
  id: string;
  canonicalPath: string;
  originalPath: string;
  status: FolderGrantStatus;
  authorizedAt: string;
  revokedAt: string | null;
  label: string | null;
}

export type FolderAuthEventName =
  | "folder-authorized"
  | "folder-revoked"
  | "folder-authorization-denied";

export interface FolderAuthEventPayload {
  path: string;
  canonicalPath: string;
  timestamp: string;
  success: boolean;
  reason?: string;
}

export class FolderAuthError extends Error {
  code: "INVALID_PATH" | "PATH_TRAVERSAL" | "SYMLINK_DETECTED" | "ALREADY_AUTHORIZED" | "NOT_FOUND" | "UNKNOWN";

  constructor(code: FolderAuthError["code"], message: string) {
    super(message);
    this.name = "FolderAuthError";
    this.code = code;
  }
}
