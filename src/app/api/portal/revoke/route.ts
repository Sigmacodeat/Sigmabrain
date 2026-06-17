import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { revokePortalToken } from "@/lib/portal-token";

export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  revokePortalToken(token);
  return NextResponse.json({ revoked: true });
}
