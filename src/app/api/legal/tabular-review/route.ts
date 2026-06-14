import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

// Pro Dokument ein LLM-Call — bei vielen Dokumenten dauert das.
export const maxDuration = 300;

/** Proxy: tabellarische Massenprüfung (Grid: Dokumente × Fragen, zitiert). */
export async function POST(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const body = await req.json();

  try {
    const res = await fetch(`${ENGINE_URL}/api/legal/tabular-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return Response.json(payload.error ? payload : { error: `Engine returned ${res.status}` }, { status: res.status });
    }
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Engine nicht erreichbar" }, { status: 503 });
  }
}
