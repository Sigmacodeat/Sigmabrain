import { NextRequest, NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal-token";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const caseSlug = searchParams.get("caseSlug");

  if (!token || !caseSlug) {
    return NextResponse.json({ error: "token_and_caseSlug_required" }, { status: 400 });
  }

  const payload = await verifyPortalToken(token);
  if (!payload || payload.case_slug !== caseSlug) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 403 });
  }

  try {
    const { api } = await import("@/lib/api");
    const pages = await api.brain.listPages({ type: "portal_message", limit: 100 });
    const messages = pages
      .filter((p) => (p.frontmatter as Record<string, unknown>).case_slug === caseSlug)
      .map((p) => {
        const fm = p.frontmatter as Record<string, unknown>;
        return {
          id: p.slug,
          text: p.content || "",
          sender: String(fm.sender ?? "client"),
          createdAt: String(fm.created_at ?? p.created_at),
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[portal/messages] failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
