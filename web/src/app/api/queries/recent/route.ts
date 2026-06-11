import { NextRequest } from "next/server";
import { ENGINE_URL, engineHeaders, unauthorized } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "10";

  try {
    const res = await fetch(`${ENGINE_URL}/api/queries/recent?limit=${limit}`, { headers: auth });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch {
    return Response.json([]);
  }
}