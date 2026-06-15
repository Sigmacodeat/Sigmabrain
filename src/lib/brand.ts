// Multi-brand host routing. ONE codebase serves both the Sigmabrain platform
// site and the Subsumio vertical site (subsum.io / subsumio.com). The brand is
// resolved from the request host: middleware rewrites the Subsumio domains so
// the Subsumio page becomes their homepage, and the marketing chrome renders a
// Subsumio-scoped nav + "powered by Sigmabrain" footer.

export type SiteBrand = "sigmabrain" | "subsumio";

const DEFAULT_SUBSUMIO_HOSTS = [
  "subsum.io",
  "www.subsum.io",
  "subsumio.com",
  "www.subsumio.com",
];

/** Hosts that resolve to the Subsumio brand. Override with
 *  NEXT_PUBLIC_SUBSUMIO_HOSTS="subsum.io,subsumio.com,…" (comma-separated). */
export const SUBSUMIO_HOSTS: string[] = (() => {
  const raw = process.env.NEXT_PUBLIC_SUBSUMIO_HOSTS;
  const list = raw ? raw.split(",") : DEFAULT_SUBSUMIO_HOSTS;
  return list.map((h) => h.trim().toLowerCase()).filter(Boolean);
})();

/** Other-vertical roots that should fold to Subsumio on a Subsumio host —
 *  the Subsumio domain presents Subsumio alone, never the whole platform. */
export const OTHER_VERTICAL_PATHS = [
  "/taxumio",
  "/vc",
  "/consulting",
  "/recruiting",
  "/insurance",
  "/realestate",
  "/compliance",
];

/** Resolve the brand for a request host (port-stripped, case-insensitive). */
export function brandForHost(host: string | null | undefined): SiteBrand {
  if (!host) return "sigmabrain";
  const h = host.split(":")[0].trim().toLowerCase();
  return SUBSUMIO_HOSTS.includes(h) ? "subsumio" : "sigmabrain";
}
