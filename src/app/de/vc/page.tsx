import type { Metadata } from "next";
import VcPage from "@/components/marketing/vc-page";
import { VC } from "@/content/vc";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: VC.de.metaTitle,
  description: VC.de.metaDesc,
  alternates: { canonical: "/de/vc", languages: { en: "/vc", de: "/de/vc" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(VC.de.faq)} />
      <VcPage lang="de" />
    </>
  );
}
