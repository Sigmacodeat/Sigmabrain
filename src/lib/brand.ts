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

/** Canonical public URL for the Subsumio product, used by the platform site's
 *  "Solutions → Subsumio" link. Defaults to the in-app path (always works); set
 *  NEXT_PUBLIC_SUBSUMIO_URL="https://subsum.io" once the domain is attached to
 *  the Vercel project so the platform links out to the standalone site. */
export const SUBSUMIO_SITE_URL = process.env.NEXT_PUBLIC_SUBSUMIO_URL || "/subsumio";

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/** Canonical URL for the Subsumio page in a given language. Consolidates SEO to
 *  the standalone Subsumio domain once NEXT_PUBLIC_SUBSUMIO_URL points there, so
 *  sigmabrain.com/subsumio and subsum.io/ don't compete as duplicate content.
 *  Falls back to the in-app path (resolved against metadataBase) otherwise. */
export function subsumioCanonical(lang: "en" | "de"): string {
  if (isExternalUrl(SUBSUMIO_SITE_URL)) {
    const root = SUBSUMIO_SITE_URL.replace(/\/$/, "");
    return lang === "de" ? `${root}/de` : root;
  }
  return lang === "de" ? "/de/subsumio" : "/subsumio";
}
