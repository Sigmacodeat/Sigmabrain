import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VerticalPage from "@/components/marketing/vertical";
import { VERTICALS, VERTICAL_SLUGS, type VerticalSlug } from "@/content/verticals";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

export function generateStaticParams() {
  return VERTICAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!VERTICAL_SLUGS.includes(slug as VerticalSlug)) return {};
  const v = VERTICALS.en[slug as VerticalSlug];
  return {
    title: v.metaTitle,
    description: v.metaDesc,
    alternates: {
      canonical: `/solutions/${slug}`,
      languages: { en: `/solutions/${slug}`, de: `/de/solutions/${slug}` },
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!VERTICAL_SLUGS.includes(slug as VerticalSlug)) notFound();
  return (
    <>
      <JsonLd data={faqPageLd(VERTICALS.en[slug as VerticalSlug].faq)} />
      <VerticalPage lang="en" slug={slug as VerticalSlug} />
    </>
  );
}
