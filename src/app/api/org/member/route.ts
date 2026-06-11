// Remove a member from the team workspace. Owner-only; the owner cannot
// remove themselves (dissolve via leaving once alone — see ../route.ts).
// The removed member keeps their account and falls back to their personal
// brain automatically (engineContext resolves orgId === null).

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore, getOrgStore } from "@/lib/auth/store";

export async function DELETE(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.orgId) return NextResponse.json({ error: "not_in_org" }, { status: 400 });

  const org = await getOrgStore().getById(me.orgId);
  if (!org || org.ownerId !== me.id) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const userId = (body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "missing_user" }, { status: 400 });
  if (userId === me.id) {
    return NextResponse.json({ error: "owner_cannot_remove_self" }, { status: 400 });
  }

  const store = getStore();
  const target = await store.getById(userId);
  if (!target || target.orgId !== org.id) {
    return NextResponse.json({ error: "not_a_member" }, { status: 404 });
  }

  await store.update(target.id, { orgId: null });
  return NextResponse.json({ ok: true });
}
