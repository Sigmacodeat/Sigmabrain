"use client";

// Sigmabrain landing page — renders EN or DE from src/content/site.ts.
// Agency-grade motion: load-in hero, scroll-reveal sections, staggered cards,
// interactive live demo, parallax background (via MarketingBackground). All
// decorative motion respects prefers-reduced-motion via MotionConfig.

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaMark } from "@/components/brand/logo";
import { LANDING, PRICING, p, type Lang } from "@/content/site";
import { SUBSUMIO_SITE_URL, isExternalUrl } from "@/lib/brand";
import { PricingGrid } from "./pricing-grid";
import LiveDemo from "./live-demo";
import NeuralHero from "./neural-hero";
import DashboardReel from "./dashboard-reel";
import ProductWorkflowShowcase from "./product-workflow-showcase";
import SuperbrainAdvantage from "./superbrain-advantage";
import TrustBand from "./trust-band";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  SectionHeading,
  FaqList,
  ICONS,
  COLOR_MAP,
} from "./chrome";

const viewport = { once: true, margin: "0px 0px 80px 0px", amount: 0.12 } as const;
// Section/card scroll-reveal preset.
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport,
  transition: { duration: 0.5, ease: "easeOut" as const },
};

export default function LandingPage({ lang }: { lang: Lang }) {
  const t = LANDING[lang];
  const pricing = PRICING[lang];

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang}>
        <MarketingBackground />
        <MarketingNav lang={lang} />

        {/* Hero */}
        <section className="relative z-10 pt-20 pb-28 px-6 max-w-7xl mx-auto text-center">
          {/* Signature neural-graph backdrop */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
            <NeuralHero className="absolute inset-0 w-full h-full opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#06060f]/10 via-transparent to-[#06060f]" />
          </div>

          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs text-violet-400 font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              {t.badge}
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-[#e8e8f0] leading-[1.05] tracking-tight mb-6">
              {t.h1a}<br />
              <span className="gradient-text glow-text">{t.h1b}</span>
            </h1>
            <p className="text-lg md:text-xl text-[#8888aa] max-w-2xl mx-auto mb-12 leading-relaxed">{t.sub}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <Link href={p(lang, "/signup")}>
                <Button size="xl" variant="glow" className="min-w-[200px]">
                  <SigmaMark size={18} tile={false} /> {t.ctaPrimary}
                </Button>
              </Link>
              <a href="#demo">
                <Button size="xl" variant="secondary" className="min-w-[200px]">
                  {t.ctaSecondary} <ChevronRight size={18} />
                </Button>
              </a>
            </div>
          </motion.div>

          <motion.div
            id="demo"
            className="relative z-10 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          >
            <LiveDemo lang={lang} {...t.demo} />
          </motion.div>
        </section>

        {/* Stats */}
        <motion.section {...reveal} className="relative z-10 py-16 px-6 border-y border-[#1e1e3a] bg-[#0d0d1a]/50">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-6">
              {t.stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewport}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <p className="text-3xl font-black gradient-text mb-1">{stat.value}</p>
                  <p className="text-sm text-[#8888aa]">{stat.label}</p>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-[#4a4a6a]">{t.statsNote}</p>
          </div>
        </motion.section>

        <SuperbrainAdvantage lang={lang} />

        <ProductWorkflowShowcase lang={lang} />

        {/* Dashboard in action */}
        <section className="relative z-10 py-24 px-6 max-w-5xl mx-auto">
          <motion.div {...reveal}>
            <SectionHeading
              badge={lang === "de" ? "In Aktion" : "In action"}
              title={lang === "de" ? "Datei anhängen. Fragen. Zitierte Antwort." : "Attach a file. Ask. Cited answer."}
              sub={lang === "de"
                ? "Dateien per Upload, Google Drive oder Anwaltssoftware ins Brain — dann im Chat fragen, mit seitengenauen Quellen."
                : "Bring files in via upload, Google Drive or your practice software — then ask in chat, with page-level sources."}
            />
          </motion.div>
          <motion.div {...reveal}>
            <DashboardReel lang={lang} />
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
          <motion.div {...reveal}>
            <SectionHeading badge="Features" title={t.featuresTitle} sub={t.featuresSub} />
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.features.map((f, i) => {
              const Icon = ICONS[f.icon];
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewport}
                  transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-violet-500/40 hover:bg-[#12122a] transition-colors duration-200"
                >
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${COLOR_MAP[f.color]}`}>
                    {Icon && <Icon size={18} />}
                  </div>
                  <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#8888aa] leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="relative z-10 py-24 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
          <div className="max-w-5xl mx-auto">
            <motion.div {...reveal}><SectionHeading title={t.howTitle} /></motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {t.how.map((item, i) => {
                const Icon = ICONS[item.icon];
                return (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={viewport}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-mono text-[#4a4a6a]">{item.step}</span>
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        {Icon && <Icon size={15} className="text-violet-400" />}
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{item.title}</h3>
                    <p className="text-sm text-[#8888aa] leading-relaxed">{item.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Verticals */}
        <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
          <motion.div {...reveal}><SectionHeading title={t.verticalsTitle} sub={t.verticalsSub} /></motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.verticalCards.map((v, i) => {
              const comingSoon = "comingSoon" in v && v.comingSoon;
              const soonLabel = lang === "de" ? "Bald verfügbar" : "Coming soon";
              return (
                <motion.div
                  key={v.href}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={comingSoon ? undefined : { y: -4 }}
                  viewport={viewport}
                  transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                  className="h-full"
                >
                  {comingSoon ? (
                    <div className="relative h-full p-7 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a]/60 flex flex-col cursor-default">
                      <span className="absolute top-5 right-5 text-[10px] font-semibold uppercase tracking-wide text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                        {soonLabel}
                      </span>
                      <h3 className="text-lg font-bold text-[#c8c8d8] mb-2 pr-24">{v.title}</h3>
                      <p className="text-sm text-[#6f6f8a] leading-relaxed flex-1 mb-5">{v.desc}</p>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6f6f8a]">
                        {soonLabel}
                      </span>
                    </div>
                  ) : (() => {
                    const resolvedHref = v.href === "/subsumio" ? SUBSUMIO_SITE_URL : v.href;
                    const cardCls = "group h-full p-7 rounded-2xl border border-violet-500/30 bg-[#12122a] hover:border-violet-500/60 hover:bg-[#16163a] transition-colors duration-200 flex flex-col shadow-lg shadow-violet-500/5";
                    const cardInner = (
                      <>
                        <h3 className="text-lg font-bold text-[#e8e8f0] mb-2 group-hover:text-violet-300">{v.title}</h3>
                        <p className="text-sm text-[#8888aa] leading-relaxed flex-1 mb-5">{v.desc}</p>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400">
                          {v.cta} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </>
                    );
                    return isExternalUrl(resolvedHref) ? (
                      <a href={resolvedHref} className={cardCls}>{cardInner}</a>
                    ) : (
                      <Link href={p(lang, resolvedHref)} className={cardCls}>{cardInner}</Link>
                    );
                  })()}
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Scenarios (honest — no fake testimonials) */}
        <section className="relative z-10 py-24 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
          <div className="max-w-7xl mx-auto">
            <motion.div {...reveal}><SectionHeading title={t.scenariosTitle} sub={t.scenariosSub} /></motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {t.scenarios.map((s, i) => (
                <motion.div
                  key={s.role}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewport}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]"
                >
                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">{s.role}</p>
                  <p className="text-sm text-[#8888aa] leading-relaxed">{s.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust band — light section (the serious counterpoint, primes pricing) */}
        <TrustBand lang={lang} />

        {/* Pricing */}
        <section id="pricing" className="relative z-10 py-24 px-6">
          <motion.div {...reveal} className="max-w-6xl mx-auto">
            <SectionHeading badge="Pricing" title={pricing.title} sub={pricing.sub} />
            <PricingGrid lang={lang} />
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="relative z-10 py-24 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
          <motion.div {...reveal} className="max-w-5xl mx-auto">
            <SectionHeading title={t.faqTitle} />
            <FaqList items={t.faq} />
          </motion.div>
        </section>

        {/* Final CTA */}
        <motion.section {...reveal} className="relative z-10 py-24 px-6 text-center max-w-3xl mx-auto">
          <SigmaMark size={64} className="mx-auto mb-8 rounded-[15px] glow-purple" />
          <h2 className="text-4xl font-black text-[#e8e8f0] mb-4">{t.ctaTitle}</h2>
          <p className="text-lg text-[#8888aa] mb-10">{t.ctaSub}</p>
          <Link href={p(lang, "/signup")}>
            <Button size="xl" variant="glow">
              <SigmaMark size={18} tile={false} /> {t.ctaButton} <ArrowRight size={18} />
            </Button>
          </Link>
        </motion.section>

        <MarketingFooter lang={lang} />
      </div>
    </MotionConfig>
  );
}
