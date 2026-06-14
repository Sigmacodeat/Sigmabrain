import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/api-keys
 * Persistiert API-Keys server-seitig im User-Store.
 * In Produktion: Keys sollten encrypted-at-rest gespeichert werden.
 * Body: { openaiKey?, anthropicKey?, zeroEntropyKey? }
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    openaiKey?: string;
    anthropicKey?: string;
    zeroEntropyKey?: string;
  };

  const store = getStore();
  await store.update(me.id, {
    openaiKey: body.openaiKey || null,
    anthropicKey: body.anthropicKey || null,
    zeroEntropyKey: body.zeroEntropyKey || null,
  });

  return Response.json({ ok: true });
}

/**
 * GET /api/settings/api-keys
 * Lädt gespeicherte API-Keys (nur für den authentifizierten Nutzer).
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const store = getStore();
  const user = await store.getById(me.id);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  return Response.json({
    openaiKey: user.openaiKey || "",
    anthropicKey: user.anthropicKey || "",
    zeroEntropyKey: user.zeroEntropyKey || "",
  });
}
