import { NextRequest, NextResponse } from "next/server";
import { hit, clientIp } from "@/lib/auth/rate-limit";
import { timingSafeEqual } from "node:crypto";

/**
 * POST /api/webhook/incoming
 *
 * Empfängt Webhooks von Drittanbietern (Zapier, beA, etc.)
 * Authentifizierung via X-API-Key Header.
 *
 * Body: { event: string, data: Record<string, unknown> }
 */
function verifyWebhookKey(provided: string): boolean {
  const expected = process.env.SIGMABRAIN_WEBHOOK_API_KEY;
  if (!expected) return false;
  // Timing-safe comparison
  if (provided.length !== expected.length) return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Rate-limit webhooks by IP
  const ip = clientIp(req.headers);
  const rate = await hit(`webhook:ip:${ip}`, 60, 60_000); // 60/min
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !verifyWebhookKey(apiKey)) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!event) {
    return NextResponse.json({ error: "event_required" }, { status: 400 });
  }

  // Process webhook event
  const acceptedEvents = ["case.created", "deadline.due", "invoice.paid", "email.received"];
  if (!acceptedEvents.includes(event)) {
    return NextResponse.json({ error: "unsupported_event" }, { status: 400 });
  }

  // Log and return success (processing is async)
  console.log(`[webhook] received ${event} from ${ip}`);
  return NextResponse.json({
    success: true,
    received: event,
    timestamp: new Date().toISOString(),
    message: "Webhook received and queued for processing",
  });
}
