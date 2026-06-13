import type { Metadata } from "next";
import InsurancePage from "@/components/marketing/insurance-page";
import { INSURANCE } from "@/content/insurance";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: INSURANCE.de.metaTitle,
  description: INSURANCE.de.metaDesc,
  alternates: { canonical: "/de/insurance", languages: { en: "/insurance", de: "/de/insurance" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(INSURANCE.de.faq)} />
      <InsurancePage lang="de" />
    </>
  );
}
