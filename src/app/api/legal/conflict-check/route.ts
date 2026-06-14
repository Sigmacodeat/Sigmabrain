import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

/** Proxy: server-side Kollisionsprüfung over the tenant's legal_case pages. */
export async function POST(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const body = await req.json();

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/conflict-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return Response.json({ error: `Engine returned ${res.status}` }, { status: res.status });
    }
    return Response.json(await res.json());
  } catch (err) {
    console.error("[conflict-check] engine unreachable:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
