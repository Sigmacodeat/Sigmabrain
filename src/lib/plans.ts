// Plan limits — single source of truth for fair-use display and seat checks.
// These power the usage meter and the team invite gate. Keep in sync with
// the public pricing copy (content/site.ts PRICING): the pricing page
// promises "generous limits shown transparently" — these ARE those limits.
//
// V1 is display + soft gating only: we show usage and warn, we don't cut
// anyone off mid-month ("we ask before anything changes" — pricing footnote).

import type { Plan } from "@/lib/auth/store";

export interface PlanLimits {
  /** Max pages in the brain (pricing: Pro = 25,000). */
  pages: number;
  /** Fair-use queries (think + search) per calendar month. */
  queriesPerMonth: number;
  /** Seats = org members incl. owner. 1 means no team features. */
  seats: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { pages: 200, queriesPerMonth: 100, seats: 1 },
  pro: { pages: 25_000, queriesPerMonth: 2_000, seats: 1 },
  team: { pages: 100_000, queriesPerMonth: 10_000, seats: 5 },
  enterprise: { pages: 1_000_000, queriesPerMonth: 100_000, seats: 25 },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}
