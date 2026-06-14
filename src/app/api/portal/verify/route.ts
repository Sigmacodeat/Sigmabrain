import { NextRequest, NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal-token";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const payload = await verifyPortalToken(token);
  if (!payload) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 403 });
  }

  return NextResponse.json({
    valid: true,
    caseSlug: payload.case_slug,
    expiresAt: payload.exp,
  });
}
