import type { Metadata } from "next";
import VcPage from "@/components/marketing/vc-page";
import { VC } from "@/content/vc";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: VC.en.metaTitle,
  description: VC.en.metaDesc,
  alternates: { canonical: "/vc", languages: { en: "/vc", de: "/de/vc" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(VC.en.faq)} />
      <VcPage lang="en" />
    </>
  );
}
