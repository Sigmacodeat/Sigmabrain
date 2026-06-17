import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore } from "@/lib/auth/store";

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("settings.read");
  if (ctx instanceof Response) return ctx;

  try {
    const allUsers = await getStore().list();

    // Scope to org or personal workspace — never leak cross-tenant data.
    const members = allUsers
      .filter((u) =>
        ctx.user.orgId ? u.orgId === ctx.user.orgId : u.id === ctx.user.id,
      )
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      }));

    return NextResponse.json({ members });
  } catch (err) {
    console.error("[team] failed to list users:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
