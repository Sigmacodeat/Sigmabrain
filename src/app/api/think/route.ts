import { NextRequest } from "next/server";
import { ENGINE_URL, engineContext, unauthorized } from "@/lib/engine";
import { recordQuery } from "@/lib/usage";

export async function POST(req: NextRequest) {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  const body = await req.json();
  void recordQuery(ctx.brainId);

  try {
    const upstream = await fetch(`${ENGINE_URL}/api/think`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Sigmabrain Engine returned ${upstream.status}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Sigmabrain Engine nicht erreichbar. Starte: gbrain serve" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
