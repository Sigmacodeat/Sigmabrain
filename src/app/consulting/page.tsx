import type { Metadata } from "next";
import ConsultingPage from "@/components/marketing/consulting-page";
import { CONSULTING } from "@/content/consulting";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: CONSULTING.en.metaTitle,
  description: CONSULTING.en.metaDesc,
  alternates: { canonical: "/consulting", languages: { en: "/consulting", de: "/de/consulting" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(CONSULTING.en.faq)} />
      <ConsultingPage lang="en" />
    </>
  );
}
