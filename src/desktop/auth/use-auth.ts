"use client";

import { useEffect, useCallback } from "react";
import { useAuthStore } from "./store";
import type { DesktopLoginCredentials } from "@/core/session-types";

export function useDesktopAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const restoredAt = useAuthStore((s) => s.restoredAt);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const restore = useAuthStore((s) => s.restore);
  const logout = useAuthStore((s) => s.logout);
  const clearError = useAuthStore((s) => s.clearError);

  useEffect(() => {
    if (status === "unauthenticated" && !restoredAt) {
      restore();
    }
  }, [status, restoredAt, restore]);

  const signIn = useCallback(
    async (credentials: DesktopLoginCredentials) => {
      return login(credentials);
    },
    [login],
  );

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  return {
    status,
    user,
    token,
    restoredAt,
    error,
    isAuthenticated: status === "authenticated",
    isAuthenticating: status === "authenticating" || status === "restoring",
    signIn,
    signOut,
    clearError,
  };
}
