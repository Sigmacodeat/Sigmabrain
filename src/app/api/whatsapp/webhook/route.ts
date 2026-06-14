import { NextRequest } from "next/server";
import { handleLegalChatMedia, handleLegalChatMessage } from "@/lib/legal-chat/actions";
import { downloadAndStoreWhatsAppMedia } from "@/lib/whatsapp/media";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { extractIncomingMessages, type WhatsAppWebhookPayload } from "@/lib/whatsapp/types";
import { resolveSender, verifyWebhookChallenge, verifyWhatsAppSignature } from "@/lib/whatsapp/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const result = verifyWebhookChallenge(new URL(req.url).searchParams);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return new Response(result.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyWhatsAppSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = extractIncomingMessages(payload);
  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const message of messages) {
    const sender = resolveSender(message.from);
    if (!sender) {
      results.push({ id: message.id, status: "ignored", error: "sender_not_allowed" });
      continue;
    }

    try {
      const reply = message.type === "text"
        ? await handleLegalChatMessage({
            sender,
            fromPhone: message.from,
            messageId: message.id,
            text: message.text,
          })
        : await handleLegalChatMedia({
            sender,
            fromPhone: message.from,
            messageId: message.id,
            caption: message.caption,
          }, await downloadAndStoreWhatsAppMedia(message));
      await sendWhatsAppText(message.from, reply);
      results.push({ id: message.id, status: "processed" });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[whatsapp-webhook] message failed:", error);
      try {
        await sendWhatsAppText(message.from, `Kanzlei OS konnte die Nachricht nicht verarbeiten: ${error}`);
      } catch {}
      results.push({ id: message.id, status: "failed", error });
    }
  }

  return Response.json({ success: true, processed: results.length, results });
}
