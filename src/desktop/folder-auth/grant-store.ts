import { create } from "zustand";
import type { FolderGrant, FolderGrantStatus } from "./types";

const STORAGE_KEY = "sb_folder_grants";

function loadGrants(): FolderGrant[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FolderGrant[];
  } catch {
    return [];
  }
}

function saveGrants(grants: FolderGrant[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grants));
  } catch {
    // Storage might be unavailable in some contexts
  }
}

function generateId(): string {
  return `fg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface FolderGrantStore {
  grants: FolderGrant[];
  load: () => void;
  addGrant: (canonicalPath: string, originalPath: string, label?: string) => FolderGrant;
  revokeGrant: (canonicalPath: string) => void;
  findGrant: (canonicalPath: string) => FolderGrant | undefined;
  isAuthorized: (canonicalPath: string) => boolean;
  listActive: () => FolderGrant[];
  clear: () => void;
}

export const useFolderGrantStore = create<FolderGrantStore>((set, get) => ({
  grants: [],

  load: () => {
    set({ grants: loadGrants() });
  },

  addGrant: (canonicalPath, originalPath, label) => {
    const grant: FolderGrant = {
      id: generateId(),
      canonicalPath,
      originalPath,
      status: "active",
      authorizedAt: new Date().toISOString(),
      revokedAt: null,
      label: label ?? null,
    };
    const grants = [...get().grants, grant];
    saveGrants(grants);
    set({ grants });
    return grant;
  },

  revokeGrant: (canonicalPath) => {
    const grants = get().grants.map((g) =>
      g.canonicalPath === canonicalPath && g.status === "active"
        ? { ...g, status: "revoked" as FolderGrantStatus, revokedAt: new Date().toISOString() }
        : g,
    );
    saveGrants(grants);
    set({ grants });
  },

  findGrant: (canonicalPath) => {
    return get().grants.find(
      (g) => g.canonicalPath === canonicalPath && g.status === "active",
    );
  },

  isAuthorized: (canonicalPath) => {
    return get().findGrant(canonicalPath) !== undefined;
  },

  listActive: () => {
    return get().grants.filter((g) => g.status === "active");
  },

  clear: () => {
    saveGrants([]);
    set({ grants: [] });
  },
}));
