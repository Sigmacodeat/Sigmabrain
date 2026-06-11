// Server-side helper for the dashboard's engine proxies.
//
// Multi-tenant V1: every proxy resolves the logged-in user and forwards
// their brainId as `x-sigmabrain-source` — the engine's web API scopes
// every operation to it (see src/commands/web-api.ts upstream). The header
// is added server-to-server only; the browser can never choose a tenant.

import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/session";
import { getStore, getOrgStore, type Plan, type User } from "@/lib/auth/store";

export const ENGINE_URL =
  process.env.SIGMABRAIN_API_URL || process.env.GBRAIN_API_URL || "http://localhost:3001";

export interface EngineContext {
  headers: Record<string, string>;
  /** The brain all engine calls scope to: the org's shared brain when the
   *  user is a team member, otherwise their personal one. */
  brainId: string;
  /** Plan whose limits apply to this brain (org → the OWNER's plan). */
  plan: Plan;
  user: User;
}

/**
 * Full engine-call context for the current session, or null when nobody is
 * signed in. Org membership switches both the brain AND the plan whose
 * fair-use limits apply (the org owner pays; their plan carries the pool).
 */
export async function engineContext(): Promise<EngineContext | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getStore().getById(session.uid);
  if (!user) return null;

  let brainId = user.brainId;
  let plan: Plan = user.plan;
  if (user.orgId) {
    const org = await getOrgStore().getById(user.orgId);
    if (org) {
      brainId = org.brainId;
      const owner = await getStore().getById(org.ownerId);
      if (owner) plan = owner.plan;
    }
  }

  const headers: Record<string, string> = { "x-sigmabrain-source": brainId };
  const apiKey = process.env.SIGMABRAIN_WEB_API_KEY || process.env.GBRAIN_WEB_API_KEY;
  if (apiKey) headers["x-sigmabrain-api-key"] = apiKey;
  return { headers, brainId, plan, user };
}

/**
 * Headers for an engine call on behalf of the current session, or null when
 * nobody is signed in (proxies answer 401 then — the dashboard middleware
 * normally prevents that from ever happening).
 */
export async function engineHeaders(): Promise<Record<string, string> | null> {
  const ctx = await engineContext();
  return ctx?.headers ?? null;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
