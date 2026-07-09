export type SecretKey = string;

export type SecretKind =
  | "session_token"
  | "api_key"
  | "oauth_token"
  | "encryption_key"
  | "connector_credential"
  | "generic";

export interface SecretMetadata {
  key: SecretKey;
  kind: SecretKind;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessedAt: string | null;
}

export interface SecureStoreEntry {
  key: SecretKey;
  value: string;
  kind: SecretKind;
}

export type SecureStoreErrorCode =
  | "NOT_FOUND"
  | "STORE_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "INVALID_KEY"
  | "ENCRYPTION_FAILED"
  | "UNKNOWN";

export class SecureStoreError extends Error {
  code: SecureStoreErrorCode;

  constructor(code: SecureStoreErrorCode, message: string) {
    super(message);
    this.name = "SecureStoreError";
    this.code = code;
  }
}

export interface SecureStoreAdapter {
  saveSecret(key: SecretKey, value: string, kind?: SecretKind): Promise<void>;
  loadSecret(key: SecretKey): Promise<string>;
  deleteSecret(key: SecretKey): Promise<void>;
  hasSecret(key: SecretKey): Promise<boolean>;
  listSecrets(): Promise<SecretMetadata[]>;
  isAvailable(): Promise<boolean>;
}

export type KeychainEventName =
  | "secret-stored"
  | "secret-loaded"
  | "secret-deleted";

export interface KeychainEventPayload {
  key: SecretKey;
  kind: SecretKind;
  timestamp: string;
  success: boolean;
  errorCode?: SecureStoreErrorCode;
}
