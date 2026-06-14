import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const { slug } = await params;
  const path = slug.join("/");

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(path)}`, { headers: auth });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "page_not_found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  const { slug } = await params;
  const path = slug.join("/");

  try {
    const res = await fetch(`${ENGINE_URL}/api/pages/${encodeURIComponent(path)}`, { method: "DELETE", headers: auth });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "delete_failed" }, { status: 500 });
  }
}
