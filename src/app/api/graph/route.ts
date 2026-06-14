import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "200";

  try {
    const res = await fetch(`${ENGINE_URL}/api/graph?limit=${limit}`, { headers: auth });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ nodes: [], links: [] });
  }
}
