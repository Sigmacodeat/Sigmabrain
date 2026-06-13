import type { Metadata } from "next";
import VerticalPage from "@/components/marketing/vertical";
import { PRODUCTS } from "@/content/products";
import { VERTICALS } from "@/content/verticals";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

const product = PRODUCTS.de.subsumio;

export const metadata: Metadata = {
  title: product.metaTitle,
  description: product.metaDesc,
  alternates: { canonical: "/de/subsumio", languages: { en: "/subsumio", de: "/de/subsumio" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(VERTICALS.de[product.vertical].faq)} />
      <VerticalPage lang="de" slug={product.vertical} product={product} />
    </>
  );
}
