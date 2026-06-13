import type { Metadata } from "next";
import TaxumioPage from "@/components/marketing/taxumio-page";
import { TAXUMIO } from "@/content/taxumio";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: TAXUMIO.en.metaTitle,
  description: TAXUMIO.en.metaDesc,
  alternates: { canonical: "/taxumio", languages: { en: "/taxumio", de: "/de/taxumio" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(TAXUMIO.en.faq)} />
      <TaxumioPage lang="en" />
    </>
  );
}
