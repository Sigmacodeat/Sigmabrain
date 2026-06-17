// Team workspace API — GET current org + members, POST create, DELETE leave.
// Invite/remove live in ./invite and ./member. All endpoints are session-
// bound; mutating ones enforce owner/seat rules (see lib/plans.ts).

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore, getOrgStore, buildNewOrg, toPublic } from "@/lib/auth/store";

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("brain.read");
  if (ctx instanceof Response) return ctx;
  if (!ctx.user.orgId) return NextResponse.json({ org: null });

  const org = await getOrgStore().getById(ctx.user.orgId);
  if (!org) return NextResponse.json({ org: null });

  const members = (await getStore().list())
    .filter((u) => u.orgId === org.id)
    .map((u) => ({ ...toPublic(u), isOwner: u.id === org.ownerId }));
  return NextResponse.json({
    org: { id: org.id, name: org.name, ownerId: org.ownerId, createdAt: org.createdAt },
    members,
    isOwner: ctx.user.id === org.ownerId,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;
  if (ctx.user.orgId) return NextResponse.json({ error: "already_in_org" }, { status: 409 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const org = await getOrgStore().create(buildNewOrg({ name, ownerId: ctx.user.id }));
  await getStore().update(ctx.user.id, { orgId: org.id });
  return NextResponse.json({ org }, { status: 201 });
}

/** Leave the org. The owner can only leave (and thereby dissolve it) once alone. */
export async function DELETE(req: NextRequest) {
  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;
  if (!ctx.user.orgId) return NextResponse.json({ error: "not_in_org" }, { status: 400 });

  const orgs = getOrgStore();
  const org = await orgs.getById(ctx.user.orgId);
  if (!org) {
    await getStore().update(ctx.user.id, { orgId: null });
    return NextResponse.json({ ok: true });
  }

  if (ctx.user.id === org.ownerId) {
    const memberCount = (await getStore().list()).filter((u) => u.orgId === org.id).length;
    if (memberCount > 1) {
      // Owner leaving would orphan the shared brain — remove members first.
      return NextResponse.json({ error: "owner_must_remove_members_first" }, { status: 409 });
    }
    await getStore().update(ctx.user.id, { orgId: null });
    await orgs.delete(org.id);
    return NextResponse.json({ ok: true });
  }

  await getStore().update(ctx.user.id, { orgId: null });
  return NextResponse.json({ ok: true });
}
