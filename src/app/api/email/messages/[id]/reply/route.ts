import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildMailDraft, getMailMessage, sendMailboxMessage } from "@/lib/email/mailbox";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const parent = await getMailMessage(user, id);
    if (!parent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const draft = buildMailDraft(await req.json(), id);
    const message = await sendMailboxMessage(user, draft);
    return NextResponse.json({ message }, { status: message.status === "sent" ? 201 : 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message === "mailbox_database_not_configured" ? 503 :
      /required|invalid/.test(message) ? 400 :
      500;
    console.error("[email] failed to send reply:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
