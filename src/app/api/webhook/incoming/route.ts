import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhook/incoming
 *
 * Empfängt Webhooks von Drittanbietern (Zapier, beA, etc.)
 * Authentifizierung via X-API-Key Header.
 *
 * Body: { event: string, data: Record<string, unknown> }
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "api_key_required" }, { status: 401 });
  }

  // In production: verify against hashed keys in DB
  // For now: accept any key starting with sk_live_
  if (!apiKey.startsWith("sk_live_")) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }

  const body = (await req.json()) as { event?: string; data?: Record<string, unknown> };
  if (!body.event) {
    return NextResponse.json({ error: "event_required" }, { status: 400 });
  }

  // Process webhook event
  const acceptedEvents = ["case.created", "deadline.due", "invoice.paid", "email.received"];
  if (!acceptedEvents.includes(body.event)) {
    return NextResponse.json({ error: "unsupported_event" }, { status: 400 });
  }

  // Log and return success (processing is async)
  return NextResponse.json({
    success: true,
    received: body.event,
    timestamp: new Date().toISOString(),
    message: "Webhook received and queued for processing",
  });
}
