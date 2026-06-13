import type { Metadata } from "next";
import TaxumioPage from "@/components/marketing/taxumio-page";
import { TAXUMIO } from "@/content/taxumio";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: TAXUMIO.de.metaTitle,
  description: TAXUMIO.de.metaDesc,
  alternates: { canonical: "/de/taxumio", languages: { en: "/taxumio", de: "/de/taxumio" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(TAXUMIO.de.faq)} />
      <TaxumioPage lang="de" />
    </>
  );
}
