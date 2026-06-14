// industry-pack — the link between a branch landing page and the brain that
// gets provisioned for that branch.
//
// Each branch page (/subsumio, /taxumio, /compliance, /insurance, /realestate,
// /vc, /consulting, /recruiting) deep-links to /signup?industry=<key>. This
// module is the SINGLE SOURCE that (a) validates which industry keys are
// accepted and (b) maps each to the gbrain schema pack that configures the
// tenant's brain for that vertical (page types, link verbs, calibration).
//
// Provisioning (signup → engine brain) should call packForIndustry(user.industry)
// and apply the returned pack to the new tenant's source via the engine
// (`gbrain onboard` / schema-pack apply). Until the engine + provisioning path
// are live this is a no-op lookup; wiring it here means the mapping is correct
// and ready the moment provisioning runs.

/** industry key (from ?industry=) → bundled gbrain schema pack name. */
export const INDUSTRY_PACK = {
  legal: "gbrain-legal",
  tax: "gbrain-tax",
  compliance: "gbrain-compliance",
  insurance: "gbrain-insurance",
  realestate: "gbrain-realestate",
  vc: "gbrain-investor",
  consulting: "gbrain-consulting",
  recruiting: "gbrain-recruiting",
  medical: "gbrain-medical",
} as const;

export type Industry = keyof typeof INDUSTRY_PACK;

/** Valid signup industry values: every mapped vertical + the generic "other". */
export const INDUSTRIES: ReadonlySet<string> = new Set([
  ...Object.keys(INDUSTRY_PACK),
  "other",
]);

/** Is this a known signup industry value? */
export function isValidIndustry(industry: string | null | undefined): boolean {
  return !!industry && INDUSTRIES.has(industry);
}

/** The schema pack that configures a brain for this industry, or null
 *  ("other"/unknown → no vertical pack, generic base brain). */
export function packForIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null;
  return (INDUSTRY_PACK as Record<string, string>)[industry] ?? null;
}
