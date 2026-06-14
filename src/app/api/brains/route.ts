import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { engineContext } from "@/lib/engine";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ctx = await engineContext();
  if (!ctx) return NextResponse.json({ error: "engine_context_failed" }, { status: 500 });

  const brains = [
    { name: "Haupt-Brain", slug: ctx.brainId, source: "default", engine: "pglite" },
  ];
  return NextResponse.json({ brains });
}
