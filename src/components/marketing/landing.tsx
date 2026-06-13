"use client";

// Sigmabrain landing page — renders EN or DE from src/content/site.ts.

import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaMark } from "@/components/brand/logo";
import { LANDING, PRICING, p, type Lang } from "@/content/site";
import { PricingGrid } from "./pricing-grid";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  SectionHeading,
  DemoWindow,
  FaqList,
  ICONS,
  COLOR_MAP,
} from "./chrome";

export default function LandingPage({ lang }: { lang: Lang }) {
  const t = LANDING[lang];
  const pricing = PRICING[lang];

  return (
    <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang}>
      <MarketingBackground />
      <MarketingNav lang={lang} />

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-28 px-6 max-w-7xl mx-auto text-center">
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

        <div id="demo" className="max-w-3xl mx-auto">
          <DemoWindow {...t.demo} />
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 py-16 px-6 border-y border-[#1e1e3a] bg-[#0d0d1a]/50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-6">
            {t.stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-black gradient-text mb-1">{stat.value}</p>
                <p className="text-sm text-[#8888aa]">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[#4a4a6a]">{t.statsNote}</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <SectionHeading badge="Features" title={t.featuresTitle} sub={t.featuresSub} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {t.features.map((f) => {
            const Icon = ICONS[f.icon];
            return (
              <div key={f.title} className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a] hover:bg-[#12122a] transition-all duration-200">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${COLOR_MAP[f.color]}`}>
                  {Icon && <Icon size={18} />}
                </div>
                <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{f.title}</h3>
                <p className="text-sm text-[#8888aa] leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-24 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.howTitle} />
          <div className="grid md:grid-cols-3 gap-6">
            {t.how.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <div key={item.step} className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-mono text-[#4a4a6a]">{item.step}</span>
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      {Icon && <Icon size={15} className="text-violet-400" />}
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{item.title}</h3>
                  <p className="text-sm text-[#8888aa] leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <SectionHeading title={t.verticalsTitle} sub={t.verticalsSub} />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.verticalCards.map((v) => (
            <Link
              key={v.href}
              href={p(lang, v.href)}
              className="group p-7 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-violet-500/40 hover:bg-[#12122a] transition-all duration-200 flex flex-col"
            >
              <h3 className="text-lg font-bold text-[#e8e8f0] mb-2 group-hover:text-violet-300">{v.title}</h3>
              <p className="text-sm text-[#8888aa] leading-relaxed flex-1 mb-5">{v.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400">
                {v.cta} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Scenarios (honest — no fake testimonials) */}
      <section className="relative z-10 py-24 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title={t.scenariosTitle} sub={t.scenariosSub} />
          <div className="grid md:grid-cols-3 gap-6">
            {t.scenarios.map((s) => (
              <div key={s.role} className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]">
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">{s.role}</p>
                <p className="text-sm text-[#8888aa] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading badge="Pricing" title={pricing.title} sub={pricing.sub} />
          <PricingGrid lang={lang} />
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-24 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.faqTitle} />
          <FaqList items={t.faq} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-24 px-6 text-center max-w-3xl mx-auto">
        <SigmaMark size={64} className="mx-auto mb-8 rounded-[15px] glow-purple" />
        <h2 className="text-4xl font-black text-[#e8e8f0] mb-4">{t.ctaTitle}</h2>
        <p className="text-lg text-[#8888aa] mb-10">{t.ctaSub}</p>
        <Link href={p(lang, "/signup")}>
          <Button size="xl" variant="glow">
            <SigmaMark size={18} tile={false} /> {t.ctaButton} <ArrowRight size={18} />
          </Button>
        </Link>
      </section>

      <MarketingFooter lang={lang} />
    </div>
  );
}
