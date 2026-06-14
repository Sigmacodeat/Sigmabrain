import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/store";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { userId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId || !role) {
    return NextResponse.json({ error: "userId_and_role_required" }, { status: 400 });
  }

  const validRoles = ["admin", "lawyer", "assistant", "client_viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  try {
    const store = getStore();
    const targetUser = await store.getById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Prevent self-demotion from admin if no other admin exists
    if (targetUser.role === "admin" && role !== "admin" && user.id === userId) {
      const allUsers = await store.list();
      const adminCount = allUsers.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return NextResponse.json({ error: "last_admin_cannot_change_role" }, { status: 400 });
      }
    }

    await store.update(userId, { role: role as import("@/lib/auth/store").KanzleiRole });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[team/role] failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
