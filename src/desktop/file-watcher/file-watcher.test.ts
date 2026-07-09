import { describe, it, expect, beforeEach } from "bun:test";
import { FileWatcherService } from "./watcher-service";
import { folderAuthService } from "../folder-auth/folder-auth-service";
import { useFolderGrantStore } from "../folder-auth/grant-store";
import type { FileChangeEvent } from "@/core/watch-types";

describe("WP-105: File Watcher — Tests", () => {
  let watcher: FileWatcherService;

  beforeEach(() => {
    useFolderGrantStore.getState().clear();
    watcher = new FileWatcherService();
    watcher.setConfig({ debounceMs: 50, ignoreDotFiles: true, ignorePatterns: ["node_modules", ".git", "tmp", "dist", "build", ".next"], maxFileSize: null });
  });

  describe("Authorization Boundary Tests", () => {
    it("only watches authorized folders", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs", "/home/user/other"]);
      const watched = watcher.getWatchedPaths();
      expect(watched).toContain("/home/user/docs");
      expect(watched).not.toContain("/home/user/other");
    });

    it("sets status to error when no authorized folders", () => {
      watcher.startWatcher(["/home/user/unauthorized"]);
      expect(watcher.getStatus()).toBe("error");
    });

    it("sets status to watching when authorized folders exist", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      expect(watcher.getStatus()).toBe("watching");
    });

    it("isPathWatched returns true for files in watched folder", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      expect(watcher.isPathWatched("/home/user/docs/file.txt")).toBe(true);
    });

    it("isPathWatched returns false for files outside watched folder", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      expect(watcher.isPathWatched("/home/user/other/file.txt")).toBe(false);
    });

    it("rejects path traversal in startWatcher", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["../../etc/passwd"]);
      expect(watcher.getWatchedPaths()).not.toContain("../../etc/passwd");
    });
  });

  describe("Debounce Tests", () => {
    it("debounces rapid changes to same file", async () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);

      const events: FileChangeEvent[] = [];
      watcher.onFileEvent((e) => events.push(e));

      watcher.emitChange("/home/user/docs/file.txt", "modified");
      watcher.emitChange("/home/user/docs/file.txt", "modified");
      watcher.emitChange("/home/user/docs/file.txt", "modified");

      expect(watcher.getPendingCount()).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBe(1);
    });

    it("processes different files independently", async () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);

      const events: FileChangeEvent[] = [];
      watcher.onFileEvent((e) => events.push(e));

      watcher.emitChange("/home/user/docs/file1.txt", "created");
      watcher.emitChange("/home/user/docs/file2.txt", "created");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBe(2);
    });

    it("suppresses duplicate events within debounce window", async () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);

      const events: FileChangeEvent[] = [];
      watcher.onFileEvent((e) => events.push(e));

      watcher.emitChange("/home/user/docs/file.txt", "modified");
      await new Promise((resolve) => setTimeout(resolve, 150));

      watcher.emitChange("/home/user/docs/file.txt", "modified");
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(events.length).toBe(2);
    });
  });

  describe("Ignore Pattern Tests", () => {
    it("ignores dotfiles", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      expect(watcher.shouldIgnore("/home/user/docs/.hidden")).toBe(true);
    });

    it("ignores node_modules", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      expect(watcher.shouldIgnore("/home/user/docs/node_modules/pkg/index.js")).toBe(true);
    });

    it("ignores .git directory", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      expect(watcher.shouldIgnore("/home/user/docs/.git/HEAD")).toBe(true);
    });

    it("does not ignore regular files", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      expect(watcher.shouldIgnore("/home/user/docs/regular.txt")).toBe(false);
    });

    it("does not emit events for ignored files", async () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);

      const events: FileChangeEvent[] = [];
      watcher.onFileEvent((e) => events.push(e));

      watcher.emitChange("/home/user/docs/.hidden", "created");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBe(0);
    });
  });

  describe("Stop/Start Tests", () => {
    it("stopWatcher clears pending and paths", () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      watcher.stopWatcher();
      expect(watcher.getStatus()).toBe("stopped");
      expect(watcher.getWatchedPaths().length).toBe(0);
    });

    it("does not emit events when stopped", async () => {
      folderAuthService.authorizeFolder("/home/user/docs");
      watcher.startWatcher(["/home/user/docs"]);
      watcher.stopWatcher();

      const events: FileChangeEvent[] = [];
      watcher.onFileEvent((e) => events.push(e));

      watcher.emitChange("/home/user/docs/file.txt", "created");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBe(0);
    });
  });

  describe("Module Structure Tests", () => {
    it("file-watcher module files exist", () => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(import.meta.dir);
      expect(fs.existsSync(path.join(dir, "watcher-service.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "events.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "use-file-watcher.ts"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "index.ts"))).toBe(true);
    });

    it("watch-types module exists", () => {
      const fs = require("fs");
      const path = require("path");
      const corePath = path.join(import.meta.dir, "..", "..", "core", "watch-types.ts");
      expect(fs.existsSync(corePath)).toBe(true);
    });

    it("events module exports listeners", async () => {
      const mod = await import("./events");
      expect(typeof mod.onFileObserved).toBe("function");
      expect(typeof mod.onFileChanged).toBe("function");
      expect(typeof mod.onFileRemoved).toBe("function");
      expect(typeof mod.onFileIgnored).toBe("function");
    });
  });
});
