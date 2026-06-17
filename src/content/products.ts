// Product-line landing pages — "Branded House Light": Subsumio, Taxumio etc.
// are PRODUCT NAMES under the Sigmabrain umbrella ("powered by Sigmabrain"),
// not standalone brands (decision: SIGMABRAIN_STRATEGIE.md §3). Each product
// reuses its vertical's funnel body and deep-links signup with the industry
// for dashboard personalization.
//
// The codebase serves THREE host-routed brands:
//   sigmabrain.com  → platform site (all verticals)
//   subsum.io       → Subsumio standalone (legal)
//   taxum.io        → Taxumio standalone (tax)
//
// BEFORE public use: trademark search (Nizza 9/42) for each product name.

import type { Lang } from "./site";
import type { VerticalSlug } from "./verticals";
import type { ProductBrand } from "@/components/marketing/vertical";

export interface ProductContent extends ProductBrand {
  slug: string;
  vertical: VerticalSlug;
  metaTitle: string;
  metaDesc: string;
}

export const PRODUCT_SLUGS = ["subsumio", "taxumio"] as const;
export type ProductSlug = (typeof PRODUCT_SLUGS)[number];

export const PRODUCTS: Record<Lang, Record<ProductSlug, ProductContent>> = {
  en: {
    subsumio: {
      slug: "subsumio",
      vertical: "legal",
      industry: "legal",
      name: "Subsumio",
      claim: "The law firm's brain.",
      poweredBy: "Subsumio — powered by Sigmabrain",
      metaTitle: "Subsumio — the law firm's brain, powered by Sigmabrain",
      metaDesc: "Case files, deadlines, time, expenses, invoices and WhatsApp intake answerable in plain language — self-hosted, offline-capable or EU cloud. Subsumio is Sigmabrain tuned for law firms.",
    },
    taxumio: {
      slug: "taxumio",
      vertical: "tax",
      industry: "tax",
      name: "Taxumio",
      claim: "The tax firm's memory.",
      poweredBy: "Taxumio — powered by Sigmabrain",
      metaTitle: "Taxumio — the tax firm's memory, powered by Sigmabrain",
      metaDesc: "Client context, advisory history and deadlines next to your practice software — confidentiality-first. Taxumio is Sigmabrain tuned for tax & accounting firms.",
    },
  },
  de: {
    subsumio: {
      slug: "subsumio",
      vertical: "legal",
      industry: "legal",
      name: "Subsumio",
      claim: "Das Kanzlei-Gehirn.",
      poweredBy: "Subsumio — powered by Sigmabrain",
      metaTitle: "Subsumio — das Kanzlei-Gehirn, powered by Sigmabrain",
      metaDesc: "Akten, Fristen, Zeiten, Auslagen, Rechnungen und WhatsApp-Eingang in normaler Sprache abfragbar — self-hosted, offlinefähig oder EU-Cloud. Subsumio ist Sigmabrain für Kanzleien.",
    },
    taxumio: {
      slug: "taxumio",
      vertical: "tax",
      industry: "tax",
      name: "Taxumio",
      claim: "Das Kanzleigedächtnis.",
      poweredBy: "Taxumio — powered by Sigmabrain",
      metaTitle: "Taxumio — das Kanzleigedächtnis, powered by Sigmabrain",
      metaDesc: "Mandantenkontext, Gestaltungs-Historie und Fristen neben DATEV — Verschwiegenheit zuerst. Taxumio ist Sigmabrain, abgestimmt auf Steuerkanzleien.",
    },
  },
};
