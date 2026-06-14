import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

export const maxDuration = 60;

/** Proxy: § 203 StGB Anonymisierung eines Textes (regex + optional LLM-Namen). */
export async function POST(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const body = await req.json();

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/anonymize`, {
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
