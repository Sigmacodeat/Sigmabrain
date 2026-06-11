import { engineContext, unauthorized } from "@/lib/engine";
import { usageFor } from "@/lib/usage";
import { limitsFor } from "@/lib/plans";

export async function GET() {
  const ctx = await engineContext();
  if (!ctx) return unauthorized();
  const usage = await usageFor(ctx.brainId);
  return Response.json({
    month: usage.month,
    queries: usage.queries,
    plan: ctx.plan,
    limits: limitsFor(ctx.plan),
    shared: ctx.brainId !== ctx.user.brainId, // true when metering an org pool
  });
}
