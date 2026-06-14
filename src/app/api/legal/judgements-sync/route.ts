import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

// The engine fetches external court databases inline — give it time.
export const maxDuration = 120;

/** Proxy: run the legal-judgements connector and import into the tenant source. */
export async function POST(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const body = await req.json();

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/judgements-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return Response.json({ error: `Engine returned ${res.status}` }, { status: res.status });
    }
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
