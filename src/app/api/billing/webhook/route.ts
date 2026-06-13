// Stripe webhook: upgrades/downgrades plans on subscription events.
// Verifies the Stripe-Signature header (v1 scheme, HMAC-SHA256) without the SDK.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore, type Plan } from "@/lib/auth/store";

const TOLERANCE_SECONDS = 300;

function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=", 2) as [string, string]),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 501 });
  }

  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const store = getStore();
  const obj = (event.data?.object ?? {}) as {
    client_reference_id?: string;
    customer?: string;
    metadata?: { plan?: string; user_id?: string };
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = obj.client_reference_id ?? obj.metadata?.user_id;
      const plan = obj.metadata?.plan;
      if (userId && (plan === "pro" || plan === "team")) {
        await store.update(userId, {
          plan: plan as Plan,
          stripeCustomerId: typeof obj.customer === "string" ? obj.customer : null,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      // Downgrade by Stripe customer id.
      const customerId = typeof obj.customer === "string" ? obj.customer : null;
      if (customerId) {
        const users = await store.list();
        const user = users.find((u) => u.stripeCustomerId === customerId);
        if (user) await store.update(user.id, { plan: "free" });
      }
      break;
    }
    default:
      break; // acknowledge everything else
  }

  return NextResponse.json({ received: true });
}
