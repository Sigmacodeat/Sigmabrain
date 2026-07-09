import { describe, it, expect, beforeEach } from "bun:test";
import { canonicalizePath, detectPathTraversal, isPathWithinDirectory, isValidFolderPath } from "@/core/path-utils";
import { folderAuthService } from "./folder-auth-service";
import { useFolderGrantStore } from "./grant-store";
import { FolderAuthError } from "./types";

describe("WP-104: Folder Authorization — Tests", () => {
  beforeEach(() => {
    useFolderGrantStore.getState().clear();
  });

  describe("Path Canonicalization Tests", () => {
    it("canonicalizes a simple Unix path", () => {
      expect(canonicalizePath("/home/user/documents")).toBe("/home/user/documents");
    });

    it("removes trailing slashes", () => {
      expect(canonicalizePath("/home/user/documents/")).toBe("/home/user/documents");
    });

    it("resolves . segments", () => {
      expect(canonicalizePath("/home/./user/documents")).toBe("/home/user/documents");
    });

    it("resolves .. segments within bounds", () => {
      expect(canonicalizePath("/home/user/../other/documents")).toBe("/home/other/documents");
    });

    it("rejects .. that escapes root", () => {
      expect(() => canonicalizePath("../../etc/passwd")).toThrow("PATH_TRAVERSAL");
    });

    it("rejects empty path", () => {
      expect(() => canonicalizePath("")).toThrow("INVALID_PATH");
    });

    it("rejects whitespace-only path", () => {
      expect(() => canonicalizePath("   ")).toThrow("INVALID_PATH");
    });

    it("handles double slashes", () => {
      expect(canonicalizePath("/home//user/documents")).toBe("/home/user/documents");
    });
  });

  describe("Path Traversal Detection Tests", () => {
    it("detects traversal with .. at start", () => {
      expect(detectPathTraversal("../../etc/passwd")).toBe(true);
    });

    it("detects traversal with .. in middle", () => {
      expect(detectPathTraversal("/home/user/../../../etc/passwd")).toBe(true);
    });

    it("does not flag valid .. within bounds", () => {
      expect(detectPathTraversal("/home/user/../other")).toBe(false);
    });

    it("does not flag simple paths", () => {
      expect(detectPathTraversal("/home/user/documents")).toBe(false);
    });

    it("does not flag empty path", () => {
      expect(detectPathTraversal("")).toBe(false);
    });
  });

  describe("isPathWithinDirectory Tests", () => {
    it("returns true for exact match", () => {
      expect(isPathWithinDirectory("/home/user/docs", "/home/user/docs")).toBe(true);
    });

    it("returns true for subdirectory", () => {
      expect(isPathWithinDirectory("/home/user/docs/file.txt", "/home/user/docs")).toBe(true);
    });

    it("returns false for sibling directory", () => {
      expect(isPathWithinDirectory("/home/user/other", "/home/user/docs")).toBe(false);
    });

    it("returns false for parent directory", () => {
      expect(isPathWithinDirectory("/home/user", "/home/user/docs")).toBe(false);
    });
  });

  describe("isValidFolderPath Tests", () => {
    it("returns true for valid path", () => {
      expect(isValidFolderPath("/home/user/documents")).toBe(true);
    });

    it("returns false for traversal path", () => {
      expect(isValidFolderPath("../../etc/passwd")).toBe(false);
    });

    it("returns false for empty path", () => {
      expect(isValidFolderPath("")).toBe(false);
    });
  });

  describe("Grant/Revoke Tests", () => {
    it("authorizes a folder", () => {
      const grant = folderAuthService.authorizeFolder("/home/user/documents", "My Documents");
      expect(grant.canonicalPath).toBe("/home/user/documents");
      expect(grant.status).toBe("active");
      expect(grant.label).toBe("My Documents");
    });

    it("lists authorized folders", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      folderAuthService.authorizeFolder("/home/user/images");
      const list = folderAuthService.listAuthorizedFolders();
      expect(list.length).toBe(2);
    });

    it("revokes a folder", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      expect(folderAuthService.listAuthorizedFolders().length).toBe(1);
      folderAuthService.revokeFolder("/home/user/docs");
      expect(folderAuthService.listAuthorizedFolders().length).toBe(0);
    });

    it("rejects duplicate authorization", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      expect(() => folderAuthService.authorizeFolder("/home/user/docs")).toThrow(FolderAuthError);
      try {
        folderAuthService.authorizeFolder("/home/user/docs");
      } catch (e) {
        const err = e as FolderAuthError;
        expect(err.code).toBe("ALREADY_AUTHORIZED");
      }
    });

    it("rejects revoke of non-authorized folder", () => {
      expect(() => folderAuthService.revokeFolder("/home/user/docs")).toThrow(FolderAuthError);
      try {
        folderAuthService.revokeFolder("/home/user/docs");
      } catch (e) {
        const err = e as FolderAuthError;
        expect(err.code).toBe("NOT_FOUND");
      }
    });

    it("isAuthorized returns true for authorized folder", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      expect(folderAuthService.isAuthorized("/home/user/docs")).toBe(true);
    });

    it("isAuthorized returns false for non-authorized folder", () => {
      expect(folderAuthService.isAuthorized("/home/user/docs")).toBe(false);
    });

    it("isAuthorized returns false after revoke", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      folderAuthService.revokeFolder("/home/user/docs");
      expect(folderAuthService.isAuthorized("/home/user/docs")).toBe(false);
    });
  });

  describe("Symlink/Traversal Security Tests", () => {
    it("rejects path traversal in authorizeFolder", () => {
      expect(() => folderAuthService.authorizeFolder("../../etc/passwd")).toThrow(FolderAuthError);
      try {
        folderAuthService.authorizeFolder("../../etc/passwd");
      } catch (e) {
        const err = e as FolderAuthError;
        expect(err.code).toBe("PATH_TRAVERSAL");
      }
    });

    it("rejects empty path in authorizeFolder", () => {
      expect(() => folderAuthService.authorizeFolder("")).toThrow(FolderAuthError);
    });

    it("isPathAuthorized checks subdirectory access", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      expect(folderAuthService.isPathAuthorized("/home/user/docs/file.txt")).toBe(true);
      expect(folderAuthService.isPathAuthorized("/home/user/other/file.txt")).toBe(false);
    });

    it("isPathAuthorized returns false for path outside all grants", () => {
      expect(folderAuthService.isPathAuthorized("/etc/passwd")).toBe(false);
    });
  });

  describe("Module Structure Tests", () => {
    it("folder-auth module files exist", () => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(import.meta.dir);
      expect(fs.existsSync(path.join(dir, "types.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "grant-store.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "folder-auth-service.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "events.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "use-folder-auth.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "index.ts"))).toBe(true);
    });

    it("path-utils module exists", () => {
      const fs = require("fs");
      const path = require("path");
      const corePath = path.join(import.meta.dir, "..", "..", "core", "path-utils.ts");
      expect(fs.existsSync(corePath)).toBe(true);
    });

    it("events module exports listeners", async () => {
      const mod = await import("./events");
      expect(typeof mod.onFolderAuthorized).toBe("function");
      expect(typeof mod.onFolderRevoked).toBe("function");
      expect(typeof mod.onFolderAuthorizationDenied).toBe("function");
    });
  });
});
