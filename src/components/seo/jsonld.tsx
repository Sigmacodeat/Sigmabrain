// Server-safe JSON-LD injection. Render inside any server page component.
// Data objects are built per page; keep claims consistent with visible copy.

import type { Lang } from "@/content/site";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://sigmabrain.com";

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Sigmabrain",
    url: BASE,
    logo: `${BASE}/icon-512.png`,
    sameAs: ["https://github.com/garrytan/gbrain"],
  };
}

export function softwareApplicationLd(lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Sigmabrain",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Self-hosted",
    description:
      lang === "de"
        ? "Das Company Brain für wissensintensive Teams: eine Antwort statt zehn Dokumente — aus euren Meetings, Mails, Deals und Akten. Self-hosted oder EU-Cloud, Open-Source-Engine."
        : "The company brain for knowledge-intensive teams: one answer instead of ten documents — from your meetings, emails, deals and files. Self-hosted or EU cloud, open-source engine.",
    offers: [
      {
        "@type": "Offer",
        name: "Open Source",
        price: "0",
        priceCurrency: "EUR",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "79",
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "79",
          priceCurrency: "EUR",
          unitText: lang === "de" ? "pro Nutzer und Monat" : "per user per month",
        },
      },
    ],
  };
}

export function faqPageLd(faq: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
