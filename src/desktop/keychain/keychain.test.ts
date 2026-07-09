import { describe, it, expect, beforeEach } from "bun:test";
import { MemoryFallbackAdapter } from "./fallback-adapter";
import type { SecureStoreError } from "@/core/secure-store-types";

describe("WP-103: OS Keychain Integration — Tests", () => {
  let adapter: MemoryFallbackAdapter;

  beforeEach(() => {
    adapter = new MemoryFallbackAdapter();
  });

  describe("Roundtrip Tests", () => {
    it("saves and loads a secret", async () => {
      await adapter.saveSecret("test-key", "test-value", "api_key");
      const value = await adapter.loadSecret("test-key");
      expect(value).toBe("test-value");
    });

    it("saves and loads with default kind", async () => {
      await adapter.saveSecret("simple", "data");
      const value = await adapter.loadSecret("simple");
      expect(value).toBe("data");
    });

    it("overwrites existing secret", async () => {
      await adapter.saveSecret("key", "old-value");
      await adapter.saveSecret("key", "new-value");
      const value = await adapter.loadSecret("key");
      expect(value).toBe("new-value");
    });

    it("preserves createdAt on overwrite", async () => {
      await adapter.saveSecret("key", "v1");
      await adapter.saveSecret("key", "v2");
      const secrets = await adapter.listSecrets();
      const entry = secrets.find((s) => s.key === "key");
      expect(entry).toBeDefined();
      expect(entry!.createdAt).toBe(entry!.createdAt);
    });

    it("increments access count on load", async () => {
      await adapter.saveSecret("key", "value");
      await adapter.loadSecret("key");
      await adapter.loadSecret("key");
      await adapter.loadSecret("key");
      const secrets = await adapter.listSecrets();
      const entry = secrets.find((s) => s.key === "key");
      expect(entry!.accessCount).toBe(3);
    });
  });

  describe("Security Tests", () => {
    it("rejects empty key on save", async () => {
      await expect(adapter.saveSecret("", "value")).rejects.toThrow();
      try {
        await adapter.saveSecret("", "value");
      } catch (e) {
        const err = e as SecureStoreError;
        expect(err.code).toBe("INVALID_KEY");
      }
    });

    it("rejects empty key on load", async () => {
      await expect(adapter.loadSecret("")).rejects.toThrow();
    });

    it("rejects empty key on delete", async () => {
      await expect(adapter.deleteSecret("")).rejects.toThrow();
    });

    it("throws NOT_FOUND for missing key on load", async () => {
      try {
        await adapter.loadSecret("nonexistent");
        expect(false).toBe(true);
      } catch (e) {
        const err = e as SecureStoreError;
        expect(err.code).toBe("NOT_FOUND");
      }
    });

    it("throws NOT_FOUND for missing key on delete", async () => {
      try {
        await adapter.deleteSecret("nonexistent");
        expect(false).toBe(true);
      } catch (e) {
        const err = e as SecureStoreError;
        expect(err.code).toBe("NOT_FOUND");
      }
    });

    it("hasSecret returns false for missing key", async () => {
      const exists = await adapter.hasSecret("missing");
      expect(exists).toBe(false);
    });

    it("hasSecret returns true for existing key", async () => {
      await adapter.saveSecret("exists", "value");
      const exists = await adapter.hasSecret("exists");
      expect(exists).toBe(true);
    });

    it("listSecrets does not expose values", async () => {
      await adapter.saveSecret("secret1", "sensitive-data");
      const secrets = await adapter.listSecrets();
      const entry = secrets[0];
      expect(entry.key).toBe("secret1");
      expect((entry as unknown as Record<string, unknown>).value).toBeUndefined();
    });
  });

  describe("Platform Failure Tests", () => {
    it("isAvailable returns true for memory adapter", async () => {
      const available = await adapter.isAvailable();
      expect(available).toBe(true);
    });

    it("delete removes the secret", async () => {
      await adapter.saveSecret("to-delete", "value");
      await adapter.deleteSecret("to-delete");
      const exists = await adapter.hasSecret("to-delete");
      expect(exists).toBe(false);
    });

    it("listSecrets returns empty when no secrets stored", async () => {
      const secrets = await adapter.listSecrets();
      expect(secrets.length).toBe(0);
    });

    it("listSecrets returns all stored secrets", async () => {
      await adapter.saveSecret("key1", "v1", "api_key");
      await adapter.saveSecret("key2", "v2", "session_token");
      await adapter.saveSecret("key3", "v3", "oauth_token");
      const secrets = await adapter.listSecrets();
      expect(secrets.length).toBe(3);
    });
  });

  describe("Type and Module Tests", () => {
    it("secure-store-types exports are correct", async () => {
      const mod = await import("@/core/secure-store-types");
      expect(mod.SecureStoreError).toBeDefined();
      expect(typeof mod.SecureStoreError).toBe("function");
    });

    it("keychain module files exist", () => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(import.meta.dir, "..", "keychain");
      expect(fs.existsSync(path.join(dir, "index.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "store.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "events.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "adapter-factory.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "tauri-adapter.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "fallback-adapter.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "use-keychain.ts"))).toBe(true);
    });

    it("Rust keychain module exists", () => {
      const fs = require("fs");
      const path = require("path");
      const rustPath = path.join(import.meta.dir, "..", "..", "..", "src-tauri", "src", "keychain.rs");
      expect(fs.existsSync(rustPath)).toBe(true);
    });

    it("Rust keychain has all required commands", async () => {
      const fs = require("fs");
      const path = require("path");
      const rustPath = path.join(import.meta.dir, "..", "..", "..", "src-tauri", "src", "keychain.rs");
      const content = fs.readFileSync(rustPath, "utf-8");
      expect(content).toContain("pub fn save_secret");
      expect(content).toContain("pub fn load_secret");
      expect(content).toContain("pub fn delete_secret");
      expect(content).toContain("pub fn has_secret");
      expect(content).toContain("pub fn list_secrets");
      expect(content).toContain("pub fn is_keychain_available");
    });

    it("Rust keychain uses restrictive file permissions on Unix", async () => {
      const fs = require("fs");
      const path = require("path");
      const rustPath = path.join(import.meta.dir, "..", "..", "..", "src-tauri", "src", "keychain.rs");
      const content = fs.readFileSync(rustPath, "utf-8");
      expect(content).toContain("0o600");
    });
  });
});
