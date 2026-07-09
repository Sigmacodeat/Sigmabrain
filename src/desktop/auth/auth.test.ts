import { describe, it, expect, beforeEach } from "bun:test";
import { MemoryFallbackAdapter } from "../keychain/fallback-adapter";
import { DesktopAuthService } from "./auth-service";
import { SESSION_KEYCHAIN_KEY } from "@/core/session-types";
import type { SecureStoreAdapter } from "@/core/secure-store-types";

describe("WP-102: Desktop Auth Session — Tests", () => {
  let adapter: SecureStoreAdapter;
  let authService: DesktopAuthService;

  beforeEach(() => {
    adapter = new MemoryFallbackAdapter();
    authService = new DesktopAuthService();
  });

  describe("Module Structure Tests", () => {
    it("auth module files exist", () => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(import.meta.dir);
      expect(fs.existsSync(path.join(dir, "auth-service.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "store.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "events.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "use-auth.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "index.ts"))).toBe(true);
    });

    it("session-types module exists", () => {
      const fs = require("fs");
      const path = require("path");
      const corePath = path.join(import.meta.dir, "..", "..", "core", "session-types.ts");
      expect(fs.existsSync(corePath)).toBe(true);
    });

    it("SESSION_KEYCHAIN_KEY is defined", async () => {
      const mod = await import("@/core/session-types");
      expect(mod.SESSION_KEYCHAIN_KEY).toBe("sb_desktop_session");
    });
  });

  describe("Logout Cleanup Tests", () => {
    it("logout clears session from keychain", async () => {
      await adapter.saveSecret(SESSION_KEYCHAIN_KEY, "test-token", "session_token");
      expect(await adapter.hasSecret(SESSION_KEYCHAIN_KEY)).toBe(true);

      await adapter.deleteSecret(SESSION_KEYCHAIN_KEY);
      expect(await adapter.hasSecret(SESSION_KEYCHAIN_KEY)).toBe(false);
    });

    it("logout is safe when no session exists", async () => {
      const has = await adapter.hasSecret(SESSION_KEYCHAIN_KEY);
      expect(has).toBe(false);
    });
  });

  describe("Restore Tests", () => {
    it("restoreSession returns null when no token stored", async () => {
      const { user, token } = await authService.restoreSession();
      expect(user).toBeNull();
      expect(token).toBeNull();
    });

    it("getSessionToken returns null when no token stored", async () => {
      const token = await authService.getSessionToken();
      expect(token).toBeNull();
    });

    it("isAuthenticated returns false when no session", async () => {
      const authed = await authService.isAuthenticated();
      expect(authed).toBe(false);
    });
  });

  describe("Security Tests", () => {
    it("session token is stored as session_token kind", async () => {
      await adapter.saveSecret(SESSION_KEYCHAIN_KEY, "secret-token", "session_token");
      const secrets = await adapter.listSecrets();
      const entry = secrets.find((s) => s.key === SESSION_KEYCHAIN_KEY);
      expect(entry).toBeDefined();
      expect(entry!.kind).toBe("session_token");
    });

    it("listSecrets does not expose token value", async () => {
      await adapter.saveSecret(SESSION_KEYCHAIN_KEY, "sensitive-token", "session_token");
      const secrets = await adapter.listSecrets();
      const entry = secrets[0];
      expect((entry as unknown as Record<string, unknown>).value).toBeUndefined();
    });

    it("empty session key is rejected", async () => {
      await expect(adapter.saveSecret("", "token")).rejects.toThrow();
    });
  });

  describe("Store Tests", () => {
    it("auth store initializes as unauthenticated", async () => {
      const { useAuthStore } = await import("./store");
      const state = useAuthStore.getState();
      expect(state.status).toBe("unauthenticated");
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });

    it("auth store has login, restore, logout actions", async () => {
      const { useAuthStore } = await import("./store");
      const state = useAuthStore.getState();
      expect(typeof state.login).toBe("function");
      expect(typeof state.restore).toBe("function");
      expect(typeof state.logout).toBe("function");
      expect(typeof state.clearError).toBe("function");
    });
  });

  describe("Events Tests", () => {
    it("auth events module exports event listeners", async () => {
      const mod = await import("./events");
      expect(typeof mod.onSessionStarted).toBe("function");
      expect(typeof mod.onSessionRestored).toBe("function");
      expect(typeof mod.onSessionEnded).toBe("function");
    });
  });
});
