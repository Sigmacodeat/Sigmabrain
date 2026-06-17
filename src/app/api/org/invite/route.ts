// Invite a member to the team workspace. Owner-only, seat-gated by the
// owner's plan. The invite is a stateless action token bound to org+email:
// only the invited address can redeem it, and it expires after 7 days.

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore, getOrgStore } from "@/lib/auth/store";
import { signActionToken, bindFragment, INVITE_TOKEN_TTL_SECONDS } from "@/lib/auth/tokens";
import { limitsFor } from "@/lib/plans";
import { hit, clientIp } from "@/lib/auth/rate-limit";
import { sendMail, siteUrl } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const ipLimit = await hit(`invite:ip:${clientIp(req.headers)}`, 20, 60 * 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;
  if (!ctx.user.orgId) return NextResponse.json({ error: "not_in_org" }, { status: 400 });

  const org = await getOrgStore().getById(ctx.user.orgId);
  if (!org || org.ownerId !== ctx.user.id) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (email === ctx.user.email) {
    return NextResponse.json({ error: "self_invite" }, { status: 400 });
  }

  // Seat gate: the OWNER's plan carries the seats. Counting current members
  // means pending (unredeemed) invites don't block — the check re-runs at
  // join time, so a full org can never be over-joined.
  const store = getStore();
  const members = (await store.list()).filter((u) => u.orgId === org.id);
  const seats = limitsFor(ctx.user.plan).seats;
  if (members.length >= seats) {
    return NextResponse.json({ error: "no_seats_left", seats }, { status: 409 });
  }

  const existing = await store.getByEmail(email);
  if (existing?.orgId === org.id) {
    return NextResponse.json({ error: "already_member" }, { status: 409 });
  }

  const token = await signActionToken(
    { uid: ctx.user.id, purpose: "invite", bind: await bindFragment(`${org.id}:${email}`) },
    INVITE_TOKEN_TTL_SECONDS,
  );
  const joinUrl = `${siteUrl()}/join?token=${encodeURIComponent(token)}&org=${encodeURIComponent(org.id)}&email=${encodeURIComponent(email)}`;

  const de = ctx.user.locale === "de";
  const result = await sendMail({
    to: email,
    subject: de
      ? `${ctx.user.name} lädt dich zu „${org.name}“ auf Sigmabrain ein`
      : `${ctx.user.name} invited you to “${org.name}” on Sigmabrain`,
    text: de
      ? `Hallo,\n\n${ctx.user.name} (${ctx.user.email}) lädt dich ein, dem Team „${org.name}“ auf Sigmabrain beizutreten — ein gemeinsames Brain für euer Wissen.\n\nBeitreten (Link 7 Tage gültig):\n${joinUrl}\n\nNoch kein Konto? Der Link führt dich zuerst durch die Registrierung.\n\n— Sigmabrain`
      : `Hi,\n\n${ctx.user.name} (${ctx.user.email}) invited you to join the team “${org.name}” on Sigmabrain — one shared brain for your knowledge.\n\nJoin (link valid for 7 days):\n${joinUrl}\n\nNo account yet? The link walks you through signup first.\n\n— Sigmabrain`,
  });

  if (!result.sent && process.env.NODE_ENV !== "production") {
    return NextResponse.json({ ok: true, devJoinUrl: joinUrl });
  }
  return NextResponse.json({ ok: true });
}
