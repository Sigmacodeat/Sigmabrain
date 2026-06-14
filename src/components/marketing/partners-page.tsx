"use client";

// Partner program page — affiliate / referral / certified partner tracks.

import Link from "next/link";
import { ArrowRight, Check, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lang } from "@/content/site";
import { PARTNERS } from "@/content/partners";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  SectionHeading,
  FaqList,
  ICONS,
} from "./chrome";

export default function PartnersPage({ lang }: { lang: Lang }) {
  const t = PARTNERS[lang];

  return (
    <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang}>
      <MarketingBackground />
      <MarketingNav lang={lang} />

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-20 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs text-violet-400 font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          {t.badge}
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-[#e8e8f0] leading-[1.08] tracking-tight mb-6">
          {t.h1a}<br />
          <span className="gradient-text-gold glow-text">{t.h1b}</span>
        </h1>
        <p className="text-lg md:text-xl text-[#8888aa] max-w-2xl mx-auto mb-4 leading-relaxed">{t.sub}</p>
      </section>

      {/* Tiers */}
      <section id="affiliate" className="relative z-10 pb-24 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5">
          {t.tiers.map((tier) => {
            const Icon = ICONS[tier.icon];
            return (
              <div
                key={tier.id}
                id={tier.id}
                className={`relative p-7 rounded-2xl border flex flex-col transition-all duration-200 ${
                  tier.highlight
                    ? "border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-[#0d0d1a] shadow-xl shadow-amber-900/10"
                    : "border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a]"
                }`}
              >
                <div className={`w-11 h-11 rounded-lg border flex items-center justify-center mb-5 ${
                  tier.highlight
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : "text-violet-400 bg-violet-500/10 border-violet-500/20"
                }`}>
                  {Icon && <Icon size={20} />}
                </div>
                <p className="text-sm font-medium text-[#8888aa] mb-1">{tier.name}</p>
                <p className={`text-xl font-bold mb-3 ${tier.highlight ? "gradient-text-gold" : "text-[#e8e8f0]"}`}>{tier.headline}</p>
                <p className="text-sm text-[#8888aa] leading-relaxed mb-6">{tier.desc}</p>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {tier.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-[#8888aa]">
                      <Check size={13} className={`shrink-0 mt-0.5 ${tier.highlight ? "text-amber-400" : "text-violet-400"}`} />
                      {point}
                    </li>
                  ))}
                </ul>
                {tier.href.startsWith("mailto") ? (
                  <a href={tier.href}>
                    <Button variant={tier.highlight ? "glow" : "secondary"} size="md" className="w-full">
                      {tier.cta} <ArrowRight size={13} />
                    </Button>
                  </a>
                ) : (
                  <Link href={tier.href}>
                    <Button variant={tier.highlight ? "glow" : "secondary"} size="md" className="w-full">
                      {tier.cta} <ArrowRight size={13} />
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Earnings illustration */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-3xl mx-auto text-center">
          <TrendingUp size={28} className="text-amber-400 mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-black text-[#e8e8f0] mb-5">{t.calcTitle}</h2>
          <p className="text-lg text-[#e8e8f0] leading-relaxed mb-6">{t.calcSub}</p>
          <p className="text-xs text-[#4a4a6a] max-w-xl mx-auto leading-relaxed">{t.calcNote}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-24 px-6 max-w-5xl mx-auto">
        <SectionHeading title={t.howTitle} />
        <div className="grid md:grid-cols-3 gap-6">
          {t.how.map((item) => (
            <div key={item.step} className="p-6 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]">
              <span className="text-xs font-mono text-[#4a4a6a] block mb-4">{item.step}</span>
              <h3 className="text-base font-semibold text-[#e8e8f0] mb-2">{item.title}</h3>
              <p className="text-sm text-[#8888aa] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.faqTitle} />
          <FaqList items={t.faq} />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 text-center max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black text-[#e8e8f0] mb-4">{t.ctaTitle}</h2>
        <p className="text-lg text-[#8888aa] mb-10">{t.ctaSub}</p>
        <a href="mailto:partners@sigmabrain.com?subject=Partner%20application">
          <Button size="xl" variant="glow">
            {t.ctaButton} <ArrowRight size={18} />
          </Button>
        </a>
      </section>

      <MarketingFooter lang={lang} />
    </div>
  );
}
