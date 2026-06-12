import type { Metadata } from "next";
import VerticalPage from "@/components/marketing/vertical";
import { PRODUCTS } from "@/content/products";
import { VERTICALS } from "@/content/verticals";
import { JsonLd, faqPageLd } from "@/components/seo/jsonld";

const product = PRODUCTS.de.taxumio;

export const metadata: Metadata = {
  title: product.metaTitle,
  description: product.metaDesc,
  alternates: { canonical: "/de/taxumio", languages: { en: "/taxumio", de: "/de/taxumio" } },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageLd(VERTICALS.de[product.vertical].faq)} />
      <VerticalPage lang="de" slug={product.vertical} product={product} />
    </>
  );
}
