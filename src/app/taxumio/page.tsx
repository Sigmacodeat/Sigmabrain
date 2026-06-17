import type { Metadata } from "next";
import TaxumioPage from "@/components/marketing/taxumio-page";
import { TAXUMIO } from "@/content/taxumio";
import { JsonLd, faqPageLd, organizationLd } from "@/components/seo/jsonld";
import { taxumioCanonical } from "@/lib/brand";

const canonical = taxumioCanonical("en");

export const metadata: Metadata = {
  title: TAXUMIO.en.metaTitle,
  description: TAXUMIO.en.metaDesc,
  alternates: {
    canonical,
    languages: { en: taxumioCanonical("en"), de: taxumioCanonical("de") },
  },
};

export default function Page() {
  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={faqPageLd(TAXUMIO.en.faq)} />
      <TaxumioPage lang="en" />
    </>
  );
}
