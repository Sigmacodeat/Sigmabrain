import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getMailMessage } from "@/lib/email/mailbox";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const message = await getMailMessage(user, id);
    if (!message) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "mailbox_database_not_configured" ? 503 : 500;
    console.error("[email] failed to load message:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
