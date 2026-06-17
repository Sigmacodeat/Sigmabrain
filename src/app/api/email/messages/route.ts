import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { buildMailDraft, listMailMessages, sendMailboxMessage, type MailDirection } from "@/lib/email/mailbox";

export const dynamic = "force-dynamic";

function directionParam(value: string | null): MailDirection | undefined {
  return value === "inbound" || value === "outbound" ? value : undefined;
}

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("brain.read");
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const messages = await listMailMessages(ctx.user, {
      limit: Number.isFinite(limit) ? limit : 50,
      direction: directionParam(searchParams.get("direction")),
    });
    return NextResponse.json({ messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "mailbox_database_not_configured" ? 503 : 500;
    console.error("[email] failed to list messages:", message);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;

  try {
    const draft = buildMailDraft(await req.json());
    const message = await sendMailboxMessage(ctx.user, draft);
    return NextResponse.json({ message }, { status: message.status === "sent" ? 201 : 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message === "mailbox_database_not_configured" ? 503 :
      /required|invalid/.test(message) ? 400 :
      500;
    console.error("[email] failed to send message:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
