import { NextRequest, NextResponse } from "next/server";
import { ENGINE_URL, requireAuthAction } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("brain.read");
  if (ctx instanceof Response) return ctx;

  try {
    const res = await fetch(`${ENGINE_URL}/api/stats`, { headers: ctx.headers });
    if (res.ok) {
      const stats = await res.json();
      return NextResponse.json({
        brains: [{
          name: ctx.user.orgId ? "Team-Brain" : "Haupt-Brain",
          slug: ctx.brainId,
          source: "default",
          isShared: !!ctx.user.orgId,
          stats,
        }],
      });
    }
  } catch {
    // Engine unreachable — fall back to minimal known data.
  }

  return NextResponse.json({
    brains: [{
      name: ctx.user.orgId ? "Team-Brain" : "Haupt-Brain",
      slug: ctx.brainId,
      source: "default",
      isShared: !!ctx.user.orgId,
    }],
  });
}
