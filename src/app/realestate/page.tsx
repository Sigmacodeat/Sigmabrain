import type { Metadata } from "next";
import RealEstatePage from "@/components/marketing/realestate-page";
import { REALESTATE } from "@/content/realestate";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: REALESTATE.en.metaTitle,
  description: REALESTATE.en.metaDesc,
  alternates: { canonical: "/realestate", languages: { en: "/realestate", de: "/de/realestate" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(REALESTATE.en.faq)} />
      <RealEstatePage lang="en" />
    </>
  );
}
