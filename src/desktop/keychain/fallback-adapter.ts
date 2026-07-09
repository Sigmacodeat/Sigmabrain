import type { SecretKey, SecretKind, SecretMetadata, SecureStoreAdapter, SecureStoreErrorCode } from "@/core/secure-store-types";
import { SecureStoreError } from "@/core/secure-store-types";

const STORAGE_PREFIX = "__sb_secure__";

function storageKey(key: SecretKey): string {
  return `${STORAGE_PREFIX}${key}`;
}

function createError(code: SecureStoreErrorCode, message: string): SecureStoreError {
  return new SecureStoreError(code, message);
}

interface StoredEntry {
  value: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessedAt: string | null;
}

export class MemoryFallbackAdapter implements SecureStoreAdapter {
  private store = new Map<SecretKey, StoredEntry>();

  async saveSecret(key: SecretKey, value: string, kind: SecretKind = "generic"): Promise<void> {
    if (!key) throw createError("INVALID_KEY", "key must not be empty");
    const now = new Date().toISOString();
    const existing = this.store.get(key);
    this.store.set(key, {
      value,
      kind,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      accessCount: existing?.accessCount ?? 0,
      lastAccessedAt: existing?.lastAccessedAt ?? null,
    });
  }

  async loadSecret(key: SecretKey): Promise<string> {
    if (!key) throw createError("INVALID_KEY", "key must not be empty");
    const entry = this.store.get(key);
    if (!entry) throw createError("NOT_FOUND", "secret not found");
    entry.accessCount++;
    entry.lastAccessedAt = new Date().toISOString();
    return entry.value;
  }

  async deleteSecret(key: SecretKey): Promise<void> {
    if (!key) throw createError("INVALID_KEY", "key must not be empty");
    if (!this.store.has(key)) throw createError("NOT_FOUND", "secret not found");
    this.store.delete(key);
  }

  async hasSecret(key: SecretKey): Promise<boolean> {
    return this.store.has(key);
  }

  async listSecrets(): Promise<SecretMetadata[]> {
    return Array.from(this.store.entries()).map(([key, entry]) => ({
      key,
      kind: entry.kind as SecretKind,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      accessCount: entry.accessCount,
      lastAccessedAt: entry.lastAccessedAt,
    }));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
