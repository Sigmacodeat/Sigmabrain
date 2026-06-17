import { NextRequest, NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal-token";
import { hit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  // Portal messages are public (token-based) but must be rate-limited
  const ip = clientIp(req.headers);
  const rate = await hit(`portal-msg:ip:${ip}`, 10, 60_000); // 10/min
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: { token?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { token, message } = body;
  if (!token || !message || message.trim().length === 0) {
    return NextResponse.json({ error: "token_and_message_required" }, { status: 400 });
  }
  if (message.length > 5_000) {
    return NextResponse.json({ error: "message_too_long", max: 5000 }, { status: 400 });
  }

  const payload = await verifyPortalToken(token);
  if (!payload) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 403 });
  }

  try {
    // Dynamischer Import, damit es nur server-seitig läuft
    const { api } = await import("@/lib/api");
    const slug = `portal-message/${payload.case_slug}/${Date.now()}`;
    await api.brain.createPage({
      slug,
      title: `Nachricht vom Mandanten`,
      type: "portal_message",
      content: message.trim(),
      frontmatter: {
        type: "portal_message",
        case_slug: payload.case_slug,
        sender: "client",
        created_at: new Date().toISOString(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal/message] failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
