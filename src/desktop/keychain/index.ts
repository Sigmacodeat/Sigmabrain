export { useKeychain } from "./use-keychain";
export { useKeychainStore } from "./store";
export { getKeychainAdapter, isKeychainAvailable, TauriKeychainAdapter, MemoryFallbackAdapter } from "./adapter-factory";
export { onSecretStored, onSecretLoaded, onSecretDeleted, offKeychainEvent } from "./events";
export type {
  SecretKey,
  SecretKind,
  SecretMetadata,
  SecureStoreEntry,
  SecureStoreAdapter,
  SecureStoreError,
  SecureStoreErrorCode,
  KeychainEventName,
  KeychainEventPayload,
} from "@/core/secure-store-types";
