import type { Metadata } from "next";
import ConsultingPage from "@/components/marketing/consulting-page";
import { CONSULTING } from "@/content/consulting";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: CONSULTING.de.metaTitle,
  description: CONSULTING.de.metaDesc,
  alternates: { canonical: "/de/consulting", languages: { en: "/consulting", de: "/de/consulting" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(CONSULTING.de.faq)} />
      <ConsultingPage lang="de" />
    </>
  );
}
