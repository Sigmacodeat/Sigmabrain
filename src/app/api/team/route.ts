import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/store";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const users = await getStore().list();
    const members = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
    }));
    return NextResponse.json({ members });
  } catch (err) {
    console.error("[team] failed to list users:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
