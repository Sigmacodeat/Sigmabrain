import type { Metadata } from "next";
import CompliancePage from "@/components/marketing/compliance-page";
import { COMPLIANCE } from "@/content/compliance";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: COMPLIANCE.de.metaTitle,
  description: COMPLIANCE.de.metaDesc,
  alternates: { canonical: "/de/compliance", languages: { en: "/compliance", de: "/de/compliance" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(COMPLIANCE.de.faq)} />
      <CompliancePage lang="de" />
    </>
  );
}
