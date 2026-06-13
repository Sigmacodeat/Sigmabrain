// Sliding-window in-memory rate limiter for auth endpoints.
//
// Scope: brute-force protection for login/signup on a single instance
// (self-hosted or single-region node). On multi-instance serverless this
// degrades gracefully (per-instance windows) — swap `hit` for an
// Upstash/Redis implementation behind the same signature before scaling out.

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const windows = new Map<string, Window>();

/** Periodic sweep so abandoned keys don't accumulate forever. */
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSeconds: number;
}

/**
 * Record a hit for `key` and report whether it stays within `max` per
 * `windowMs`. Keys should combine route + client identity, e.g.
 * `login:1.2.3.4` or `login:email:user@example.com`.
 */
export function hit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  w.count++;
  if (w.count > max) {
    return { ok: false, retryAfterSeconds: Math.ceil((w.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP behind proxies; falls back to a shared bucket. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
