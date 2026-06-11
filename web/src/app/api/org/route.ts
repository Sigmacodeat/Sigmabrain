// Team workspace API — GET current org + members, POST create, DELETE leave.
// Invite/remove live in ./invite and ./member. All endpoints are session-
// bound; mutating ones enforce owner/seat rules (see lib/plans.ts).

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore, getOrgStore, buildNewOrg, toPublic } from "@/lib/auth/store";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.orgId) return NextResponse.json({ org: null });

  const org = await getOrgStore().getById(me.orgId);
  if (!org) return NextResponse.json({ org: null });

  const members = (await getStore().list())
    .filter((u) => u.orgId === org.id)
    .map((u) => ({ ...toPublic(u), isOwner: u.id === org.ownerId }));
  return NextResponse.json({
    org: { id: org.id, name: org.name, ownerId: org.ownerId, createdAt: org.createdAt },
    members,
    isOwner: me.id === org.ownerId,
  });
}

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.orgId) return NextResponse.json({ error: "already_in_org" }, { status: 409 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const org = await getOrgStore().create(buildNewOrg({ name, ownerId: me.id }));
  await getStore().update(me.id, { orgId: org.id });
  return NextResponse.json({ org }, { status: 201 });
}

/** Leave the org. The owner can only leave (and thereby dissolve it) once alone. */
export async function DELETE() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.orgId) return NextResponse.json({ error: "not_in_org" }, { status: 400 });

  const orgs = getOrgStore();
  const org = await orgs.getById(me.orgId);
  if (!org) {
    await getStore().update(me.id, { orgId: null });
    return NextResponse.json({ ok: true });
  }

  if (me.id === org.ownerId) {
    const memberCount = (await getStore().list()).filter((u) => u.orgId === org.id).length;
    if (memberCount > 1) {
      // Owner leaving would orphan the shared brain — remove members first.
      return NextResponse.json({ error: "owner_must_remove_members_first" }, { status: 409 });
    }
    await getStore().update(me.id, { orgId: null });
    await orgs.delete(org.id);
    return NextResponse.json({ ok: true });
  }

  await getStore().update(me.id, { orgId: null });
  return NextResponse.json({ ok: true });
}
