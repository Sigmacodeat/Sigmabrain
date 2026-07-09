"use client";

import { useEffect, useCallback } from "react";
import { useKeychainStore } from "./store";
import type { SecretKey, SecretKind } from "@/core/secure-store-types";

export function useKeychain() {
  const available = useKeychainStore((s) => s.available);
  const initialized = useKeychainStore((s) => s.initialized);
  const secrets = useKeychainStore((s) => s.secrets);
  const init = useKeychainStore((s) => s.init);
  const saveSecret = useKeychainStore((s) => s.saveSecret);
  const loadSecret = useKeychainStore((s) => s.loadSecret);
  const deleteSecret = useKeychainStore((s) => s.deleteSecret);
  const hasSecret = useKeychainStore((s) => s.hasSecret);
  const refreshList = useKeychainStore((s) => s.refreshList);

  useEffect(() => {
    if (!initialized) {
      init();
    }
  }, [initialized, init]);

  const save = useCallback(
    async (key: SecretKey, value: string, kind?: SecretKind) => {
      await saveSecret(key, value, kind);
    },
    [saveSecret],
  );

  const load = useCallback(
    async (key: SecretKey) => {
      return loadSecret(key);
    },
    [loadSecret],
  );

  const remove = useCallback(
    async (key: SecretKey) => {
      await deleteSecret(key);
    },
    [deleteSecret],
  );

  const has = useCallback(
    async (key: SecretKey) => {
      return hasSecret(key);
    },
    [hasSecret],
  );

  return {
    available,
    initialized,
    secrets,
    save,
    load,
    remove,
    has,
    refresh: refreshList,
  };
}
