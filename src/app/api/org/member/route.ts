// Remove a member from the team workspace. Owner-only; the owner cannot
// remove themselves (dissolve via leaving once alone — see ../route.ts).
// The removed member keeps their account and falls back to their personal
// brain automatically (engineContext resolves orgId === null).

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore, getOrgStore } from "@/lib/auth/store";

export async function DELETE(req: NextRequest) {
  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;
  if (!ctx.user.orgId) return NextResponse.json({ error: "not_in_org" }, { status: 400 });

  const org = await getOrgStore().getById(ctx.user.orgId);
  if (!org || org.ownerId !== ctx.user.id) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return NextResponse.json({ error: "missing_user" }, { status: 400 });
  if (userId === ctx.user.id) {
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
