// Per-branch pricing. Each branded page (/subsumio, /taxumio, …) can show its
// OWN pricing block (own tier names + framing), with signup deep-links that
// carry ?industry= so the brain is provisioned for that vertical. Verticals
// without an entry fall back to the global PRICING tiers (still rendered on the
// branch page, branded, with the industry deep-link) — so every branch has a
// pricing section, and launch products (Subsumio) get bespoke tiers.

import type { Lang, PricingTier } from "./site";
import { ENGINE_REPO_URL, PRICING } from "./site";
import { profileForIndustry } from "@/lib/industry-pack";

export interface VerticalPricing {
  title: string;
  sub: string;
  tiers: PricingTier[];
}

// industry key (signupIndustry) → bespoke pricing. Only verticals with a real
// override live here; everything else uses the global PRICING.
export const VERTICAL_PRICING: Record<Lang, Partial<Record<string, VerticalPricing>>> = {
  en: {
    legal: {
      title: "Pricing for law firms",
      sub: "Start free and self-hosted, or let us host it. No seat minimum — one lawyer works.",
      tiers: [
        {
          id: "oss", name: "Self-hosted", price: "€0", period: "forever",
          blurb: "The full engine on your own infrastructure — client data never leaves the building.",
          features: ["Complete engine (MIT), auditable", "Case Q&A with page-level citations", "Deadlines, conflict check, RVG fee calc", "Unlimited matters — your hardware", "Community support"],
          cta: "Deploy yourself", href: ENGINE_REPO_URL,
        },
        {
          id: "solo", name: "Einzelanwalt", price: "€79", period: "/lawyer/mo",
          blurb: "Hosted, for the solo practitioner. Your matters, answerable.",
          features: ["Fully managed — no API keys", "25,000 pages · 50 GB storage", "beA draft intake, ZPO deadline tracking", "AI output labeled (EU AI Act)", "Priority email support"],
          cta: "Start Subsumio", href: "/signup", highlight: true,
        },
        {
          id: "kanzlei", name: "Kanzlei", price: "€290", period: "/mo",
          blurb: "5 seats, +€49/extra. One shared firm brain, scoped per lawyer.",
          features: ["Everything in Einzelanwalt", "Shared matter memory, conflict checks across the firm", "250 GB storage", "Per-lawyer scoped access — fuzz-tested", "Four-eyes approval, audit trail, onboarding"],
          cta: "Start Kanzlei", href: "/signup",
        },
        {
          id: "ent", name: "Enterprise", price: "Custom", period: "from €12k/yr",
          blurb: "Compliance-grade. 25+ seats, your infrastructure or EU cloud.",
          features: ["EU cloud or on-premise", "DPA, SLA, SSO", "DMS / RA-MICRO / Advoware import", "Max-recall search mode", "Dedicated support & integration"],
          cta: "Talk to us", href: "mailto:hello@sigmabrain.com",
        },
      ],
    },
  },
  de: {
    legal: {
      title: "Preise für Kanzleien",
      sub: "Kostenlos & self-hosted starten — oder wir hosten. Kein Seat-Minimum, ein Anwalt reicht.",
      tiers: [
        {
          id: "oss", name: "Self-hosted", price: "0 €", period: "für immer",
          blurb: "Volle Engine auf eigener Infrastruktur — Mandantendaten verlassen das Haus nie.",
          features: ["Komplette Engine (MIT), auditierbar", "Akten-Q&A mit seitengenauen Zitaten", "Fristen, Kollisionsprüfung, RVG-Berechnung", "Unbegrenzte Akten — eure Hardware", "Community-Support"],
          cta: "Selbst deployen", href: ENGINE_REPO_URL,
        },
        {
          id: "solo", name: "Einzelanwalt", price: "79 €", period: "/Anwalt/Mon.",
          blurb: "Gehostet, für die Einzelkanzlei. Eure Akten, abfragbar.",
          features: ["Voll verwaltet — keine API-Keys", "25.000 Seiten · 50 GB Speicher", "beA-Entwurfs-Eingang, ZPO-Fristen", "KI-Output gekennzeichnet (EU AI Act)", "Priorisierter E-Mail-Support"],
          cta: "Subsumio starten", href: "/signup", highlight: true,
        },
        {
          id: "kanzlei", name: "Kanzlei", price: "290 €", period: "/Mon.",
          blurb: "5 Seats, +49 €/weiterer. Ein gemeinsames Kanzlei-Gehirn, pro Anwalt gescoped.",
          features: ["Alles aus Einzelanwalt", "Geteiltes Akten-Gedächtnis, kanzleiweite Kollisionsprüfung", "250 GB Speicher", "Zugriff pro Anwalt gescoped — fuzz-getestet", "Vier-Augen-Freigabe, Audit-Trail, Onboarding"],
          cta: "Kanzlei starten", href: "/signup",
        },
        {
          id: "ent", name: "Enterprise", price: "Individuell", period: "ab 12k €/Jahr",
          blurb: "Compliance-Grade. 25+ Seats, eure Infrastruktur oder EU-Cloud.",
          features: ["EU-Cloud oder On-Premise", "AVV, SLA, SSO", "DMS / RA-MICRO / Advoware-Import", "Maximaler Recall-Modus", "Dedizierter Support & Integration"],
          cta: "Kontakt aufnehmen", href: "mailto:hello@sigmabrain.com",
        },
      ],
    },
  },
};

export function pricingForIndustry(lang: Lang, industry: string | null | undefined): VerticalPricing | null {
  if (!industry) return null;
  const bespoke = VERTICAL_PRICING[lang][industry];
  if (bespoke) return bespoke;

  const profile = profileForIndustry(industry);
  if (!profile) return null;
  const label = profile.label[lang].toLowerCase();
  return {
    title: lang === "en" ? `Pricing for ${profile.brand}` : `Preise für ${profile.brand}`,
    sub: lang === "en"
      ? `Sigmabrain tuned for ${label}: same platform, industry-specific onboarding, prompts and schema pack.`
      : `Sigmabrain für ${label}: gleiche Plattform, branchenspezifisches Onboarding, Prompts und Schema-Pack.`,
    tiers: PRICING[lang].tiers.map((tier) => ({
      ...tier,
      cta: tier.href === "/signup"
        ? (lang === "en" ? `Start ${profile.brand}` : `${profile.brand} starten`)
        : tier.cta,
    })),
  };
}
