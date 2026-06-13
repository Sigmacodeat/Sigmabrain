import { NextRequest } from "next/server";
import { ENGINE_URL, engineHeaders, unauthorized } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
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
  } catch {
    return Response.json([]);
  }
}