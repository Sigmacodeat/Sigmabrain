import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const key of ["limit", "offset", "source", "type", "tag"]) {
    const val = searchParams.get(key);
    if (val) params.set(key, val);
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages?${params.toString()}`, { headers: auth });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch (err) {
    console.error("[pages] list failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const body = await req.json();

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
