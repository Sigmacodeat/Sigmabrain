import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { loadAllowedSenders } from "@/lib/whatsapp/verify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("settings.read");
  if (ctx instanceof Response) return ctx;

  const allowed = loadAllowedSenders();
  return NextResponse.json({
    configured: Boolean(
      process.env.WHATSAPP_VERIFY_TOKEN &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      allowed.length > 0,
    ),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    appSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
    accessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    mediaStorageProvider: process.env.WHATSAPP_MEDIA_STORAGE_PROVIDER || (process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "local"),
    mediaStorageDir: process.env.WHATSAPP_MEDIA_STORAGE_DIR || ".data/whatsapp-media",
    mediaMaxBytes: Number(process.env.WHATSAPP_MEDIA_MAX_BYTES || 25 * 1024 * 1024),
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    allowedSenders: allowed.map((sender) => ({
      brainId: sender.brainId,
      userId: sender.userId,
      name: sender.name,
      role: sender.role,
      phoneLast4: sender.phone.slice(-4),
    })),
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/whatsapp/webhook`,
  });
}
