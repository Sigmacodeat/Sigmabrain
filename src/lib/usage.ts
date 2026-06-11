// Usage metering — monthly query counters per brain.
//
// Metered at the Next.js proxy layer (every think/search passes through it),
// keyed by brainId so an org's members share one pool. File-based like the
// user store (atomic tmp+rename, serialized writes); swap for Postgres
// behind the same functions when the store adapter moves.
//
// Counter loss tolerance: this is fair-use DISPLAY data, not billing-grade
// invoicing — Stripe charges flat plans; the meter informs, it doesn't bill.

import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SIGMABRAIN_DATA_DIR || path.join(process.cwd(), ".data");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");

/** { [brainId]: { [yyyy-mm]: { queries: number } } } */
type UsageDb = Record<string, Record<string, { queries: number }>>;

let cache: UsageDb | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-06"
}

async function load(): Promise<UsageDb> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(USAGE_FILE, "utf8")) as UsageDb;
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(): Promise<void> {
  const db = cache ?? {};
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${USAGE_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, USAGE_FILE);
  });
  return writeQueue;
}

/** Record one query (think or search) for a brain. Never throws. */
export async function recordQuery(brainId: string): Promise<void> {
  try {
    const db = await load();
    const month = currentMonth();
    const brain = (db[brainId] ??= {});
    const slot = (brain[month] ??= { queries: 0 });
    slot.queries += 1;
    // Keep at most the last 12 months per brain.
    const months = Object.keys(brain).sort();
    while (months.length > 12) delete brain[months.shift()!];
    await persist();
  } catch (err) {
    console.error(`[usage] record failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface MonthUsage {
  month: string;
  queries: number;
}

export async function usageFor(brainId: string): Promise<MonthUsage> {
  const db = await load();
  const month = currentMonth();
  return { month, queries: db[brainId]?.[month]?.queries ?? 0 };
}
