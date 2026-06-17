// Redeem a team invite. Explicit POST only — the /join page renders a
// confirm button, so mail-scanner GET prefetches can never auto-join.
//
// Tamper model: org + email travel as plain link params, but the token's
// bind is HMAC-committed to exactly this (org, email) pair — change either
// and verification fails. The session email must match the invited address.

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore, getOrgStore } from "@/lib/auth/store";
import { verifyActionToken, bindFragment } from "@/lib/auth/tokens";
import { limitsFor } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const me = await requireAuthAction("brain.read");
  if (me instanceof Response) return me;

  let body: { token?: string; org?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = (body.org ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!orgId || !email) {
    return NextResponse.json({ error: "invalid_invite" }, { status: 400 });
  }
  if (me.user.email !== email) {
    // The invite was addressed to someone else — say so plainly.
    return NextResponse.json({ error: "wrong_account" }, { status: 403 });
  }

  const payload = await verifyActionToken(body.token, "invite");
  if (!payload || payload.bind !== (await bindFragment(`${orgId}:${email}`))) {
    return NextResponse.json({ error: "invalid_or_expired_invite" }, { status: 400 });
  }

  const org = await getOrgStore().getById(orgId);
  if (!org) return NextResponse.json({ error: "invalid_or_expired_invite" }, { status: 400 });

  if (me.user.orgId === org.id) {
    return NextResponse.json({ ok: true, org: { name: org.name } }); // idempotent re-click
  }
  if (me.user.orgId) {
    return NextResponse.json({ error: "leave_current_org_first" }, { status: 409 });
  }

  // Seat re-check at join time — the authoritative gate (invites are stateless).
  const store = getStore();
  const owner = await store.getById(org.ownerId);
  const seats = limitsFor(owner?.plan ?? "free").seats;
  const members = (await store.list()).filter((u) => u.orgId === org.id);
  if (members.length >= seats) {
    return NextResponse.json({ error: "no_seats_left" }, { status: 409 });
  }

  await store.update(me.user.id, { orgId: org.id });
  return NextResponse.json({ ok: true, org: { name: org.name } });
}
