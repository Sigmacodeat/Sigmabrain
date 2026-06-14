import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

export async function GET() {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  try {
    const res = await fetch(`${ENGINE_URL}/api/stats`, { headers: auth });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json(
      { total_pages: 0, total_entities: 0, total_queries: 0, total_edges: 0 },
      { status: 200 }
    );
  }
}
