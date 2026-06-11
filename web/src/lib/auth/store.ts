// User store with a swappable adapter. Default: JSON file at <app>/.data/users.json
// — perfect for self-hosted and dev. For serverless production, implement the
// same UserStore interface against Postgres (the engine DB is right there) and
// swap it in getStore(). Every consumer goes through this interface only.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

export type Plan = "free" | "pro" | "team" | "enterprise";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "admin";
  plan: Plan;
  locale: "en" | "de";
  /** This user's own referral code (sigmabrain.com/?ref=CODE). */
  referralCode: string;
  /** Referral code of the user who referred this one, if any. */
  referredBy: string | null;
  /** Brain identifier for multi-tenant provisioning against the Sigmabrain Engine. */
  brainId: string;
  stripeCustomerId: string | null;
  /** ISO timestamp once the verification link was clicked; null until then. */
  emailVerifiedAt?: string | null;
  /** Org membership: when set, the org's shared brain replaces the personal one. */
  orgId?: string | null;
  /** Industry chosen at signup — drives dashboard personalization (verticals). */
  industry?: string | null;
  createdAt: string;
}

/** A team workspace: members share ONE brain; seats are gated by the owner's plan. */
export interface Org {
  id: string;
  name: string;
  /** The shared brain every member's engine calls scope to. */
  brainId: string;
  ownerId: string;
  createdAt: string;
}

export interface OrgStore {
  getById(id: string): Promise<Org | null>;
  create(org: Org): Promise<Org>;
  update(id: string, patch: Partial<Org>): Promise<Org | null>;
  delete(id: string): Promise<void>;
  list(): Promise<Org[]>;
}

export interface UserStore {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  getByReferralCode(code: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User | null>;
  list(): Promise<User[]>;
}

// --- File adapter -----------------------------------------------------------

const DATA_DIR = process.env.SIGMABRAIN_DATA_DIR || path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

class FileUserStore implements UserStore {
  private cache: User[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private async load(): Promise<User[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(USERS_FILE, "utf8");
      this.cache = JSON.parse(raw) as User[];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    const users = this.cache ?? [];
    // serialize writes to avoid interleaving
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${USERS_FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
      await fs.rename(tmp, USERS_FILE);
    });
    return this.writeQueue;
  }

  async getById(id: string) {
    return (await this.load()).find((u) => u.id === id) ?? null;
  }
  async getByEmail(email: string) {
    const norm = email.trim().toLowerCase();
    return (await this.load()).find((u) => u.email === norm) ?? null;
  }
  async getByReferralCode(code: string) {
    return (await this.load()).find((u) => u.referralCode === code) ?? null;
  }
  async create(user: User) {
    const users = await this.load();
    users.push(user);
    await this.persist();
    return user;
  }
  async update(id: string, patch: Partial<User>) {
    const users = await this.load();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch, id: users[idx].id };
    await this.persist();
    return users[idx];
  }
  async list() {
    return [...(await this.load())];
  }
}

let store: UserStore | null = null;
export function getStore(): UserStore {
  if (!store) store = new FileUserStore();
  return store;
}

// --- Org adapter (same file-based pattern as users) --------------------------

const ORGS_FILE = path.join(DATA_DIR, "orgs.json");

class FileOrgStore implements OrgStore {
  private cache: Org[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private async load(): Promise<Org[]> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await fs.readFile(ORGS_FILE, "utf8")) as Org[];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    const orgs = this.cache ?? [];
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${ORGS_FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(orgs, null, 2), "utf8");
      await fs.rename(tmp, ORGS_FILE);
    });
    return this.writeQueue;
  }

  async getById(id: string) {
    return (await this.load()).find((o) => o.id === id) ?? null;
  }
  async create(org: Org) {
    const orgs = await this.load();
    orgs.push(org);
    await this.persist();
    return org;
  }
  async update(id: string, patch: Partial<Org>) {
    const orgs = await this.load();
    const idx = orgs.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    orgs[idx] = { ...orgs[idx], ...patch, id: orgs[idx].id };
    await this.persist();
    return orgs[idx];
  }
  async delete(id: string) {
    const orgs = await this.load();
    const idx = orgs.findIndex((o) => o.id === id);
    if (idx !== -1) {
      orgs.splice(idx, 1);
      await this.persist();
    }
  }
  async list() {
    return [...(await this.load())];
  }
}

let orgStore: OrgStore | null = null;
export function getOrgStore(): OrgStore {
  if (!orgStore) orgStore = new FileOrgStore();
  return orgStore;
}

export function buildNewOrg(opts: { name: string; ownerId: string }): Org {
  return {
    id: randomUUID(),
    name: opts.name.trim(),
    brainId: `org_${randomUUID().slice(0, 8)}`,
    ownerId: opts.ownerId,
    createdAt: new Date().toISOString(),
  };
}

// --- Helpers ----------------------------------------------------------------

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars

export function generateReferralCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

export async function buildNewUser(opts: {
  email: string;
  name: string;
  passwordHash: string;
  locale?: "en" | "de";
  referredBy?: string | null;
  industry?: string | null;
}): Promise<User> {
  const s = getStore();
  // first user ever becomes admin — sensible bootstrap for a fresh install
  const isFirst = (await s.list()).length === 0;
  let referralCode = generateReferralCode();
  // collision check (8 chars over 31-alphabet makes this near-impossible, but cheap to verify)
  while (await s.getByReferralCode(referralCode)) referralCode = generateReferralCode();
  return {
    id: randomUUID(),
    email: opts.email.trim().toLowerCase(),
    name: opts.name.trim(),
    passwordHash: opts.passwordHash,
    role: isFirst ? "admin" : "user",
    plan: "free",
    locale: opts.locale ?? "en",
    referralCode,
    referredBy: opts.referredBy ?? null,
    brainId: `brain_${randomUUID().slice(0, 8)}`,
    stripeCustomerId: null,
    emailVerifiedAt: null,
    orgId: null,
    industry: opts.industry ?? null,
    createdAt: new Date().toISOString(),
  };
}

/** Public projection — never leaks the password hash. */
export type PublicUser = Omit<User, "passwordHash">;
export function toPublic(user: User): PublicUser {
  const { passwordHash: _omit, ...pub } = user;
  void _omit;
  return pub;
}
