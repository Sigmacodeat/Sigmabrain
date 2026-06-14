import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { disconnectUser } from "@/lib/docusign";

export const dynamic = "force-dynamic";

/**
 * POST /api/docusign/disconnect
 * Trennt die Docusign-Verbindung des aktuellen Users.
 */
export async function POST() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  await disconnectUser(me.id);
  return Response.json({ ok: true, disconnected: true });
}
