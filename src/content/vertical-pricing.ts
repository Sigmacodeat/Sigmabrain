// Per-branch pricing. Each branded page (/subsumio, /taxumio, …) can show its
// OWN pricing block (own tier names + framing), with signup deep-links that
// carry ?industry= so the brain is provisioned for that vertical. Verticals
// without an entry fall back to the global PRICING tiers (still rendered on the
// branch page, branded, with the industry deep-link) — so every branch has a
// pricing section, and launch products (Subsumio) get bespoke tiers.

import type { Lang, PricingTier } from "./site";
import { PRICING } from "./site";
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
      sub: "Per seat, billed annually. Top-tier case synthesis on infrastructure you control — no client data leaves the EU.",
      tiers: [
        {
          id: "solo", name: "Professional", price: "€590", period: "/seat/mo",
          blurb: "For solo practitioners and small firms. The full case brain, fully managed.",
          features: ["Managed EU hosting — no API keys", "Case Q&A with page-level citations", "WhatsApp matter copilot", "ZPO/BGB deadlines + §43a conflict check", "beA intake · 50 GB per seat", "Priority support"],
          cta: "Start Subsumio", href: "/signup",
        },
        {
          id: "kanzlei", name: "Kanzlei", price: "€790", period: "/seat/mo",
          blurb: "One shared firm brain, scoped per lawyer. From 5 seats.",
          features: ["Everything in Professional", "Shared matter memory + firm-wide conflict checks", "Time, expenses, invoicing & DATEV export", "Four-eyes approval, full audit trail", "150 GB per seat", "Onboarding & dedicated support"],
          cta: "Start Kanzlei", href: "/signup", highlight: true,
        },
        {
          id: "ent", name: "Enterprise", price: "€990", period: "/seat/mo",
          blurb: "Compliance-grade, on your infrastructure or EU cloud. From 20 seats.",
          features: ["EU cloud or on-premise deployment", "DPA, SLA, SSO/SAML", "DMS / RA-MICRO / Advoware import", "Maximum-recall search mode", "Dedicated CSM, custom retention & storage"],
          cta: "Talk to us", href: "mailto:hello@sigmabrain.com",
        },
      ],
    },
  },
  de: {
    legal: {
      title: "Preise für Kanzleien",
      sub: "Pro Seat, jährliche Abrechnung. Spitzen-Synthese auf Infrastruktur, die ihr kontrolliert — keine Mandantendaten verlassen die EU.",
      tiers: [
        {
          id: "solo", name: "Professional", price: "590 €", period: "/Seat/Mon.",
          blurb: "Für Einzelanwälte und kleine Kanzleien. Das volle Akten-Gehirn, voll verwaltet.",
          features: ["Verwaltetes EU-Hosting — keine API-Keys", "Akten-Q&A mit seitengenauen Zitaten", "WhatsApp-Akten-Copilot", "ZPO/BGB-Fristen + Kollisionsprüfung §43a", "beA-Eingang · 50 GB pro Seat", "Priorisierter Support"],
          cta: "Subsumio starten", href: "/signup",
        },
        {
          id: "kanzlei", name: "Kanzlei", price: "790 €", period: "/Seat/Mon.",
          blurb: "Ein gemeinsames Kanzlei-Gehirn, pro Anwalt gescoped. Ab 5 Seats.",
          features: ["Alles aus Professional", "Geteiltes Akten-Gedächtnis + kanzleiweite Kollisionsprüfung", "Zeit, Auslagen, Rechnungen & DATEV-Export", "Vier-Augen-Freigabe, voller Audit-Trail", "150 GB pro Seat", "Onboarding & dedizierter Support"],
          cta: "Kanzlei starten", href: "/signup", highlight: true,
        },
        {
          id: "ent", name: "Enterprise", price: "990 €", period: "/Seat/Mon.",
          blurb: "Compliance-Grade, auf eurer Infrastruktur oder EU-Cloud. Ab 20 Seats.",
          features: ["EU-Cloud oder On-Premise-Deployment", "AVV, SLA, SSO/SAML", "DMS / RA-MICRO / Advoware-Import", "Maximaler Recall-Modus", "Dedizierter CSM, individuelle Aufbewahrung & Speicher"],
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
