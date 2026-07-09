"use client";

import { useEffect, useCallback } from "react";
import { useFolderGrantStore } from "./grant-store";
import { folderAuthService } from "./folder-auth-service";
import { FolderAuthError } from "./types";
import type { FolderGrant } from "./types";

export function useFolderAuth() {
  const grants = useFolderGrantStore((s) => s.grants);
  const load = useFolderGrantStore((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  const authorize = useCallback((path: string, label?: string): FolderGrant => {
    return folderAuthService.authorizeFolder(path, label);
  }, []);

  const revoke = useCallback((path: string): void => {
    folderAuthService.revokeFolder(path);
  }, []);

  const isAuthorized = useCallback((path: string): boolean => {
    return folderAuthService.isAuthorized(path);
  }, []);

  const isPathAuthorized = useCallback((path: string): boolean => {
    return folderAuthService.isPathAuthorized(path);
  }, []);

  const activeGrants = grants.filter((g) => g.status === "active");

  return {
    grants: activeGrants,
    authorize,
    revoke,
    isAuthorized,
    isPathAuthorized,
    error: null as FolderAuthError | null,
  };
}
