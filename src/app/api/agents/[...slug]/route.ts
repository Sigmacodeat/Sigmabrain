import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineContext, unauthorized } from "@/lib/engine";

/**
 * Dynamic route for agent job actions + inbox.
 * Matches /api/agents/:id/:action (pause, resume, cancel, replay, inbox)
 * e.g. /api/agents/123/pause  or  /api/agents/123/inbox
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const { slug } = await params;
  const [id, sub] = slug;

  if (!id || isNaN(Number(id))) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const path = sub === "inbox" ? `${id}/inbox` : id;

  try {
    const res = await fetch(`${ENGINE_URL}/api/agents/${path}`, { headers: ctx.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "engine_unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const { slug } = await params;
  const [id, action] = slug;

  if (!id || isNaN(Number(id))) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const validActions = ["pause", "resume", "cancel", "replay", "inbox"];
  if (!action || !validActions.includes(action)) {
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  try {
    const isInbox = action === "inbox";
    const body = isInbox ? await req.json() : undefined;

    const res = await fetch(`${ENGINE_URL}/api/agents/${id}/${action}`, {
      method: "POST",
      headers: isInbox
        ? { "Content-Type": "application/json", ...ctx.headers }
        : ctx.headers,
      ...(isInbox ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "engine_unavailable" }, { status: 503 });
  }
}
