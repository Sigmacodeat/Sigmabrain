import { create } from "zustand";
import { authService } from "./auth-service";
import type {
  DesktopSessionStatus,
  DesktopSessionUser,
  DesktopLoginCredentials,
} from "@/core/session-types";

interface AuthStore {
  status: DesktopSessionStatus;
  user: DesktopSessionUser | null;
  token: string | null;
  restoredAt: string | null;
  error: string | null;
  login: (credentials: DesktopLoginCredentials) => Promise<boolean>;
  restore: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: "unauthenticated",
  user: null,
  token: null,
  restoredAt: null,
  error: null,

  login: async (credentials) => {
    set({ status: "authenticating", error: null });

    const result = await authService.login(credentials);

    if (result.success && result.token && result.user) {
      set({
        status: "authenticated",
        user: result.user,
        token: result.token,
        error: null,
      });
      return true;
    }

    set({
      status: "error",
      error: result.error ?? "Login failed",
    });
    return false;
  },

  restore: async () => {
    set({ status: "restoring", error: null });

    const { user, token } = await authService.restoreSession();

    if (user && token) {
      set({
        status: "authenticated",
        user,
        token,
        restoredAt: new Date().toISOString(),
        error: null,
      });
      return true;
    }

    set({
      status: "unauthenticated",
      user: null,
      token: null,
      restoredAt: null,
    });
    return false;
  },

  logout: async () => {
    await authService.logout();
    set({
      status: "unauthenticated",
      user: null,
      token: null,
      restoredAt: null,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
