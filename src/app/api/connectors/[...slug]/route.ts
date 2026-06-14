import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineContext, unauthorized } from "@/lib/engine";

const ACTIONS = new Set(["sync", "toggle"]);

/** Proxy: POST /api/connectors/:service/(sync|toggle).
 *  Connectors are install-global on the engine (not per-tenant), so
 *  lifecycle actions are restricted to admins. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  if (ctx.user.role !== "admin") {
    return Response.json(
      { error: "forbidden", message: "Nur Administratoren können Konnektoren verwalten." },
      { status: 403 },
    );
  }
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  const slug = (await params).slug ?? [];
  const service = slug[0];
  const action = slug[1];
  if (!service || !action || !ACTIONS.has(action)) {
    return Response.json({ error: "invalid_connector_action" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/connectors/${encodeURIComponent(service)}/${action}`, {
      method: "POST",
      headers: ctx.headers,
    });
    const payload = await upstream.json().catch(() => ({}));
    return Response.json(payload, { status: upstream.status });
  } catch {
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
