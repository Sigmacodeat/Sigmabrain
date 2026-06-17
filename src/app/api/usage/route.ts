import { NextRequest } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { usageFor } from "@/lib/usage";
import { limitsFor } from "@/lib/plans";

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("brain.read");
  if (ctx instanceof Response) return ctx;
  const usage = await usageFor(ctx.brainId);
  return Response.json({
    month: usage.month,
    queries: usage.queries,
    plan: ctx.plan,
    limits: limitsFor(ctx.plan),
    shared: ctx.brainId !== ctx.user.brainId, // true when metering an org pool
  });
}
