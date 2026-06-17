import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { signPortalToken } from "@/lib/portal-token";

export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("brain.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const caseSlug = typeof body.caseSlug === "string" ? body.caseSlug : "";
  if (!caseSlug) {
    return NextResponse.json({ error: "caseSlug_required" }, { status: 400 });
  }

  const token = await signPortalToken(caseSlug);
  return NextResponse.json({ token, url: `/portal/${token}` });
}
