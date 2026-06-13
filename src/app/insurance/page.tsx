import type { Metadata } from "next";
import InsurancePage from "@/components/marketing/insurance-page";
import { INSURANCE } from "@/content/insurance";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: INSURANCE.en.metaTitle,
  description: INSURANCE.en.metaDesc,
  alternates: { canonical: "/insurance", languages: { en: "/insurance", de: "/de/insurance" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(INSURANCE.en.faq)} />
      <InsurancePage lang="en" />
    </>
  );
}
