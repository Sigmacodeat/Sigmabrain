import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore, getOrgStore } from "@/lib/auth/store";
import type { KanzleiRole } from "@/lib/auth/store";
import { logAudit } from "@/lib/audit";

const VALID_ROLES: KanzleiRole[] = ["admin", "lawyer", "assistant", "client_viewer"];

async function handleRoleChange(req: NextRequest) {
  const ctx = await requireAuthAction("team.role_change");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  if (!userId || !role) {
    return NextResponse.json({ error: "userId_and_role_required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as KanzleiRole)) {
    return NextResponse.json({ error: "invalid_role", allowed: VALID_ROLES }, { status: 400 });
  }

  const store = getStore();
  const targetUser = await store.getById(userId);
  if (!targetUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Org-scope guard: owner can only manage members of their own org.
  if (ctx.user.orgId) {
    const org = await getOrgStore().getById(ctx.user.orgId);
    if (!org || org.ownerId !== ctx.user.id) {
      return NextResponse.json({ error: "owner_only" }, { status: 403 });
    }
    if (targetUser.orgId !== ctx.user.orgId) {
      return NextResponse.json({ error: "not_in_your_org" }, { status: 403 });
    }
  }

  // Prevent self-demotion when last admin.
  if (targetUser.id === ctx.user.id && targetUser.role === "admin" && role !== "admin") {
    const allUsers = await store.list();
    const adminCount = allUsers.filter(
      (u) => u.role === "admin" && (!ctx.user.orgId || u.orgId === ctx.user.orgId),
    ).length;
    if (adminCount <= 1) {
      return NextResponse.json({ error: "last_admin_cannot_change_role" }, { status: 409 });
    }
  }

  await store.update(userId, { role: role as KanzleiRole });

  void logAudit("team.role_change", "user", {
    entityId: userId,
    details: { previousRole: targetUser.role, newRole: role },
  });

  return NextResponse.json({ ok: true, userId, role });
}

export const POST = handleRoleChange;
export const PATCH = handleRoleChange;
