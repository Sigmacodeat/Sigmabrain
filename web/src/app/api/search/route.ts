import { NextRequest } from "next/server";
import { ENGINE_URL, engineContext, unauthorized } from "@/lib/engine";
import { recordQuery } from "@/lib/usage";

export async function GET(req: NextRequest) {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = searchParams.get("limit") || "10";
  if (q.trim()) void recordQuery(ctx.brainId);

  try {
    const res = await fetch(
      `${ENGINE_URL}/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: ctx.headers },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json([], { status: 200 });
  }
}
