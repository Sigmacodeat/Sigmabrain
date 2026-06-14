"use client";

// Vertical funnel page template — one component, three industries, two languages.

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaMark } from "@/components/brand/logo";
import { p, type Lang } from "@/content/site";
import { VERTICALS, type VerticalSlug } from "@/content/verticals";
import { profileForIndustry } from "@/lib/industry-pack";
import { styleForIndustry } from "@/lib/industry-theme";
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
import IndustryHeroMotif from "./industry-hero-motif";
import ProductWorkflowShowcase from "./product-workflow-showcase";
import DashboardReel from "./dashboard-reel";

/** Product-line branding (Subsumio, Taxumio, …): same funnel body, branded
 *  hero, and signup deep-links carrying the industry for prefill. */
export interface ProductBrand {
  name: string;
  claim: string;
  poweredBy: string;
  industry: string;
}

function SignatureBand({ industry, lang }: { industry: string; lang: Lang }) {
  const profile = profileForIndustry(industry);
  if (!profile) return null;

  const signature = profile.signature;
  const locale = lang === "de" ? "de" : "en";

  return (
    <section className="relative z-10 px-6 pb-20">
      <div className="max-w-5xl mx-auto relative overflow-hidden rounded-2xl border brand-border bg-[#0b0b18]/90 p-6 md:p-8">
        <div className="absolute inset-y-0 left-0 w-1/2 brand-glow-bg blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider brand-text mb-3">{profile.brand} signature</p>
            <h2 className="text-2xl md:text-3xl font-black text-[#e8e8f0] leading-tight">{signature.title[locale]}</h2>
            <p className="mt-4 text-sm md:text-base text-[#aaaac4] leading-relaxed">{signature.proof[locale]}</p>
          </div>
          <div className="grid gap-3">
            {signature.items.map((item) => (
              <div key={item[locale]} className="flex items-center gap-3 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] px-4 py-3">
                <CheckCircle size={17} className="brand-text shrink-0" />
                <span className="text-sm font-medium text-[#e8e8f0]">{item[locale]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
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
  const industry = product?.industry ?? slug;
  const signupHref = p(lang, product ? `/signup?industry=${product.industry}` : "/signup");

  return (
    <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang} style={styleForIndustry(industry)}>
      <MarketingBackground />
      <MarketingNav lang={lang} />

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-24 px-6 max-w-7xl mx-auto text-center">
        <IndustryHeroMotif industry={industry} className="absolute inset-0 z-0 opacity-[0.16] hidden md:block" />
        <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border brand-border brand-soft text-xs brand-text font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-secondary)] animate-pulse" />
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
        </div>
      </section>

      <SignatureBand industry={industry} lang={lang} />

      <ProductWorkflowShowcase lang={lang} industry={industry} />

      {/* Product reel — Sigmabrain in action for this vertical */}
      <section className="relative z-10 py-20 px-6 max-w-5xl mx-auto">
        <SectionHeading title={lang === "de" ? "Sigmabrain in Aktion" : "Sigmabrain in action"} />
        <p className="text-center text-[#8888aa] -mt-4 mb-8 max-w-2xl mx-auto">
          {lang === "de"
            ? "Datei anhängen, fragen, belegte Antwort erhalten — mit Fundstellen aus deinem eigenen Wissen."
            : "Attach a file, ask, get a cited answer — backed by your own knowledge."}
        </p>
        <DashboardReel lang={lang} industry={industry} />
      </section>

      {/* Pains */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.painsTitle} />
          <div className="grid md:grid-cols-3 gap-5">
            {t.pains.map((pain, i) => (
              <motion.div
                key={pain.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]"
              >
                <AlertCircle size={18} className="text-amber-400/80 mb-4" />
                <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{pain.title}</h3>
                <p className="text-sm text-[#8888aa] leading-relaxed">{pain.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto">
        <SectionHeading title={t.featuresTitle} />
        <div className="grid md:grid-cols-2 gap-5">
          {t.features.map((f, i) => {
            const Icon = ICONS[f.icon];
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: (i % 2) * 0.1 }}
                whileHover={{ y: -4 }}
                className="p-7 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a] transition-colors flex gap-5"
              >
                <div className="w-10 h-10 rounded-lg brand-soft border brand-border flex items-center justify-center shrink-0">
                  {Icon && <Icon size={18} className="brand-text" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#8888aa] leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
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
