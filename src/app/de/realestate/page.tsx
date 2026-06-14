import type { Metadata } from "next";
import RealEstatePage from "@/components/marketing/realestate-page";
import { REALESTATE } from "@/content/realestate";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: REALESTATE.de.metaTitle,
  description: REALESTATE.de.metaDesc,
  alternates: { canonical: "/de/realestate", languages: { en: "/realestate", de: "/de/realestate" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(REALESTATE.de.faq)} />
      <RealEstatePage lang="de" />
    </>
  );
}
