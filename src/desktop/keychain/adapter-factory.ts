import { isTauriEnvironment } from "../runtime";
import { TauriKeychainAdapter } from "./tauri-adapter";
import { MemoryFallbackAdapter } from "./fallback-adapter";
import type { SecureStoreAdapter } from "@/core/secure-store-types";

let adapterInstance: SecureStoreAdapter | null = null;

export function getKeychainAdapter(): SecureStoreAdapter {
  if (adapterInstance) return adapterInstance;

  if (isTauriEnvironment()) {
    adapterInstance = new TauriKeychainAdapter();
  } else {
    adapterInstance = new MemoryFallbackAdapter();
  }

  return adapterInstance;
}

export async function isKeychainAvailable(): Promise<boolean> {
  const adapter = getKeychainAdapter();
  return adapter.isAvailable();
}

export { TauriKeychainAdapter, MemoryFallbackAdapter };
