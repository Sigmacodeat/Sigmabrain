import type { Metadata } from "next";
import RecruitingPage from "@/components/marketing/recruiting-page";
import { RECRUITING } from "@/content/recruiting";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export const metadata: Metadata = {
  title: RECRUITING.en.metaTitle,
  description: RECRUITING.en.metaDesc,
  alternates: { canonical: "/recruiting", languages: { en: "/recruiting", de: "/de/recruiting" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(RECRUITING.en.faq)} />
      <RecruitingPage lang="en" />
    </>
  );
}
