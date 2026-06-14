import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { signPortalToken } from "@/lib/portal-token";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "lawyer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { caseSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const caseSlug = body.caseSlug;
  if (!caseSlug) {
    return NextResponse.json({ error: "caseSlug_required" }, { status: 400 });
  }

  const token = await signPortalToken(caseSlug);
  return NextResponse.json({ token, url: `/portal/${token}` });
}
