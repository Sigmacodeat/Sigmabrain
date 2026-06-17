import { NextRequest } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { disconnectUser } from "@/lib/docusign";

export const dynamic = "force-dynamic";

/**
 * POST /api/docusign/disconnect
 * Trennt die Docusign-Verbindung des aktuellen Users.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("settings.write");
  if (ctx instanceof Response) return ctx;

  await disconnectUser(ctx.user.id);
  return Response.json({ ok: true, disconnected: true });
}
