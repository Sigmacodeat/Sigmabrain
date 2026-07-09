import { invoke } from "@tauri-apps/api/core";
import { SecureStoreError } from "@/core/secure-store-types";
import type { SecretKey, SecretKind, SecretMetadata, SecureStoreAdapter, SecureStoreErrorCode } from "@/core/secure-store-types";

interface RustSecretMetadata {
  key: string;
  kind: string;
  created_at: string;
  updated_at: string;
  access_count: number;
  last_accessed_at: string | null;
}

function parseErrorCode(errMsg: string): SecureStoreErrorCode {
  if (errMsg.startsWith("NOT_FOUND")) return "NOT_FOUND";
  if (errMsg.startsWith("INVALID_KEY")) return "INVALID_KEY";
  if (errMsg.startsWith("PERMISSION_DENIED")) return "PERMISSION_DENIED";
  if (errMsg.startsWith("STORE_UNAVAILABLE")) return "STORE_UNAVAILABLE";
  return "UNKNOWN";
}

function createError(errMsg: string): SecureStoreError {
  const code = parseErrorCode(errMsg);
  const message = errMsg.split(": ").slice(1).join(": ") || errMsg;
  return new SecureStoreError(code, message);
}

export class TauriKeychainAdapter implements SecureStoreAdapter {
  async saveSecret(key: SecretKey, value: string, kind: SecretKind = "generic"): Promise<void> {
    try {
      await invoke("save_secret", { key, value, kind });
    } catch (e) {
      throw createError(String(e));
    }
  }

  async loadSecret(key: SecretKey): Promise<string> {
    try {
      return await invoke<string>("load_secret", { key });
    } catch (e) {
      throw createError(String(e));
    }
  }

  async deleteSecret(key: SecretKey): Promise<void> {
    try {
      await invoke("delete_secret", { key });
    } catch (e) {
      throw createError(String(e));
    }
  }

  async hasSecret(key: SecretKey): Promise<boolean> {
    try {
      return await invoke<boolean>("has_secret", { key });
    } catch {
      return false;
    }
  }

  async listSecrets(): Promise<SecretMetadata[]> {
    try {
      const raw = await invoke<RustSecretMetadata[]>("list_secrets");
      return raw.map((r) => ({
        key: r.key,
        kind: r.kind as SecretKind,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        accessCount: r.access_count,
        lastAccessedAt: r.last_accessed_at,
      }));
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>("is_keychain_available");
    } catch {
      return false;
    }
  }
}
