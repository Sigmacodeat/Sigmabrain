import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { listEnvelopes } from "@/lib/docusign";

export const dynamic = "force-dynamic";

/**
 * GET /api/docusign/envelopes?fromDate=2026-01-01&status=sent&limit=50
 * Listet Envelopes des verbundenen Docusign-Accounts.
 */
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("fromDate") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

  try {
    const envelopes = await listEnvelopes(me.id, { fromDate, status, limit });
    return Response.json({ envelopes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not_connected")) {
      return Response.json({ error: "not_connected" }, { status: 400 });
    }
    if (msg.includes("expired")) {
      return Response.json({ error: "token_expired" }, { status: 401 });
    }
    console.error("[docusign envelopes] error:", msg);
    return Response.json({ error: "list_failed", message: msg }, { status: 500 });
  }
}
