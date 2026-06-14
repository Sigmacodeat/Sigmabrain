"use client";

// Vertical funnel page template — one component, three industries, two languages.

import Link from "next/link";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaMark } from "@/components/brand/logo";
import { p, type Lang } from "@/content/site";
import { VERTICALS, type VerticalSlug } from "@/content/verticals";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  SectionHeading,
  FaqList,
  ICONS,
} from "./chrome";
import LiveDemo from "./live-demo";
import BranchPricing from "./branch-pricing";

/** Product-line branding (Subsumio, Taxumio, …): same funnel body, branded
 *  hero, and signup deep-links carrying the industry for prefill. */
export interface ProductBrand {
  name: string;
  claim: string;
  poweredBy: string;
  industry: string;
}

export default function VerticalPage({
  lang,
  slug,
  product,
}: {
  lang: Lang;
  slug: VerticalSlug;
  product?: ProductBrand;
}) {
  const t = VERTICALS[lang][slug];
  const signupHref = p(lang, product ? `/signup?industry=${product.industry}` : "/signup");

  return (
    <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang}>
      <MarketingBackground />
      <MarketingNav lang={lang} />

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-24 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs text-violet-400 font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          {product ? product.poweredBy : t.badge}
        </div>
        {product ? (
          <h1 className="text-4xl md:text-6xl font-black text-[#e8e8f0] leading-[1.08] tracking-tight mb-6">
            {product.name}<br />
            <span className="gradient-text glow-text">{product.claim}</span>
          </h1>
        ) : (
          <h1 className="text-4xl md:text-6xl font-black text-[#e8e8f0] leading-[1.08] tracking-tight mb-6">
            {t.h1a}<br />
            <span className="gradient-text glow-text">{t.h1b}</span>
          </h1>
        )}
        <p className="text-lg md:text-xl text-[#8888aa] max-w-2xl mx-auto mb-12 leading-relaxed">{t.sub}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href={signupHref}>
            <Button size="xl" variant="glow" className="min-w-[220px]">
              <SigmaMark size={18} tile={false} /> {t.ctaButton}
            </Button>
          </Link>
        </div>
        <div className="max-w-3xl mx-auto">
          <LiveDemo lang={lang} {...t.demo} />
        </div>
      </section>

      {/* Pains */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.painsTitle} />
          <div className="grid md:grid-cols-3 gap-5">
            {t.pains.map((pain) => (
              <div key={pain.title} className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]">
                <AlertCircle size={18} className="text-amber-400/80 mb-4" />
                <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{pain.title}</h3>
                <p className="text-sm text-[#8888aa] leading-relaxed">{pain.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto">
        <SectionHeading title={t.featuresTitle} />
        <div className="grid md:grid-cols-2 gap-5">
          {t.features.map((f) => {
            const Icon = ICONS[f.icon];
            return (
              <div key={f.title} className="p-7 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a] transition-colors flex gap-5">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  {Icon && <Icon size={18} className="text-violet-400" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#8888aa] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Proof */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black text-[#e8e8f0] mb-5">{t.proofTitle}</h2>
          <p className="text-base text-[#8888aa] leading-relaxed">{t.proof}</p>
        </div>
      </section>

      {/* Pricing — this branch's own tiers (or global fallback) */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <BranchPricing lang={lang} industry={product?.industry ?? slug} />
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title="FAQ" />
          <FaqList items={t.faq} />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 text-center max-w-3xl mx-auto">
        <SigmaMark size={64} className="mx-auto mb-8 rounded-[15px] glow-purple" />
        <h2 className="text-3xl md:text-4xl font-black text-[#e8e8f0] mb-4">{t.ctaTitle}</h2>
        <p className="text-lg text-[#8888aa] mb-10">{t.ctaSub}</p>
        <Link href={signupHref}>
          <Button size="xl" variant="glow">
            {t.ctaButton} <ArrowRight size={18} />
          </Button>
        </Link>
      </section>

      <MarketingFooter lang={lang} />
    </div>
  );
}
