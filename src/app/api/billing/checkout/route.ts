// Creates a Stripe Checkout session via the REST API (no SDK dependency).
// Env-gated: without STRIPE_SECRET_KEY this returns 501 with a clear message —
// the UI shows a "billing not configured yet" state instead of pretending.

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { isBillingConfigured, stripePriceId, BILLABLE_PLANS } from "@/lib/billing/plans";

export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("billing.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const plan = body.plan === "pro" || body.plan === "team" ? (body.plan as string) : null;
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  if (!isBillingConfigured()) {
    return NextResponse.json(
      {
        error: "billing_not_configured",
        message:
          "Stripe is not connected yet. Set STRIPE_SECRET_KEY, STRIPE_PRICE_PRO and STRIPE_PRICE_TEAM to enable checkout.",
      },
      { status: 501 },
    );
  }

  const priceId = stripePriceId(plan as "pro" | "team");
  if (!priceId) {
    return NextResponse.json(
      { error: "price_not_configured", message: `Missing env ${BILLABLE_PLANS[plan as "pro" | "team"].stripePriceEnv}.` },
      { status: 501 },
    );
  }

  const origin = req.nextUrl.origin;
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: ctx.user.id,
    customer_email: ctx.user.email,
    "metadata[plan]": plan,
    "metadata[user_id]": ctx.user.id,
    success_url: `${origin}/dashboard/billing?status=success`,
    cancel_url: `${origin}/dashboard/billing?status=cancelled`,
    // Referral attribution flows into Stripe metadata so payout tooling
    // (e.g. Rewardful) or manual reconciliation can see it.
    ...(ctx.user.referredBy ? { "metadata[referred_by]": ctx.user.referredBy } : {}),
  });

  const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return NextResponse.json(
      { error: "stripe_error", message: data?.error?.message ?? "Stripe request failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ url: data.url });
}
