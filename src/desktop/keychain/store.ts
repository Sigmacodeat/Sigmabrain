import { create } from "zustand";
import type { SecretKey, SecretKind, SecretMetadata, KeychainEventPayload } from "@/core/secure-store-types";
import { getKeychainAdapter, isKeychainAvailable } from "./adapter-factory";

interface KeychainStore {
  available: boolean;
  initialized: boolean;
  secrets: SecretMetadata[];
  init: () => Promise<void>;
  saveSecret: (key: SecretKey, value: string, kind?: SecretKind) => Promise<void>;
  loadSecret: (key: SecretKey) => Promise<string>;
  deleteSecret: (key: SecretKey) => Promise<void>;
  hasSecret: (key: SecretKey) => Promise<boolean>;
  refreshList: () => Promise<void>;
  handleEvent: (payload: KeychainEventPayload) => void;
}

export const useKeychainStore = create<KeychainStore>((set, get) => ({
  available: false,
  initialized: false,
  secrets: [],

  init: async () => {
    const available = await isKeychainAvailable();
    const adapter = getKeychainAdapter();
    const secrets = await adapter.listSecrets();
    set({ available, initialized: true, secrets });
  },

  saveSecret: async (key, value, kind = "generic") => {
    const adapter = getKeychainAdapter();
    await adapter.saveSecret(key, value, kind);
    await get().refreshList();
  },

  loadSecret: async (key) => {
    const adapter = getKeychainAdapter();
    const value = await adapter.loadSecret(key);
    await get().refreshList();
    return value;
  },

  deleteSecret: async (key) => {
    const adapter = getKeychainAdapter();
    await adapter.deleteSecret(key);
    await get().refreshList();
  },

  hasSecret: async (key) => {
    const adapter = getKeychainAdapter();
    return adapter.hasSecret(key);
  },

  refreshList: async () => {
    const adapter = getKeychainAdapter();
    const secrets = await adapter.listSecrets();
    set({ secrets });
  },

  handleEvent: (payload) => {
    if (payload.success) {
      get().refreshList();
    }
  },
}));
