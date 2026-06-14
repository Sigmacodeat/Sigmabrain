"use client";

// /security — trust & data-protection page. Renders content/security.ts.
// The roadmap section deliberately lists what we DON'T have yet; keep it.

import Link from "next/link";
import { ArrowRight, Check, Shield, Layers, Lock, Eye, type LucideIcon } from "lucide-react";
import { p, type Lang } from "@/content/site";
import { SECURITY } from "@/content/security";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  SectionHeading,
  FaqList,
} from "./chrome";

const PILLAR_ICONS: Record<string, LucideIcon> = { Shield, Layers, Lock, Eye };

export default function SecurityPage({ lang }: { lang: Lang }) {
  const t = SECURITY[lang];

  return (
    <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang}>
      <MarketingBackground />
      <MarketingNav lang={lang} />

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-6">
            {t.badge}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-[#e8e8f0] leading-tight mb-6">
            {t.h1a}
            <br />
            <span className="text-violet-400">{t.h1b}</span>
          </h1>
          <p className="text-lg text-[#8888aa] leading-relaxed max-w-3xl mx-auto">{t.sub}</p>
        </div>
      </section>

      {/* Pillars */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-5">
          {t.pillars.map((pillar) => {
            const Icon = PILLAR_ICONS[pillar.icon] ?? Shield;
            return (
              <div key={pillar.title} className="p-7 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a]">
                <Icon size={22} className="text-violet-400 mb-4" />
                <h3 className="text-base font-bold text-[#e8e8f0] mb-2">{pillar.title}</h3>
                <p className="text-sm text-[#8888aa] leading-relaxed">{pillar.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Hosting options */}
      <section className="relative z-10 py-16 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.hostingTitle} sub={t.hostingSub} />
          <div className="grid md:grid-cols-2 gap-6">
            {t.hostingOptions.map((opt) => (
              <div key={opt.title} className="p-7 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a]">
                <h3 className="text-base font-bold text-[#e8e8f0] mb-4">{opt.title}</h3>
                <ul className="space-y-2.5">
                  {opt.points.map((point, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-[#8888aa] leading-relaxed">
                      <Check size={14} className="text-emerald-400 shrink-0 mt-1" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance today */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionHeading title={t.complianceTitle} />
          <div className="space-y-4">
            {t.complianceItems.map((item) => (
              <div key={item.title} className="p-6 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a]">
                <h3 className="text-sm font-bold text-[#e8e8f0] mb-1.5">{item.title}</h3>
                <p className="text-sm text-[#8888aa] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EU AI Act */}
      <section className="relative z-10 py-12 px-6">
        <div className="max-w-4xl mx-auto p-7 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04]">
          <h2 className="text-lg font-bold text-violet-300 mb-2">{t.aiActTitle}</h2>
          <p className="text-sm text-[#a8a8be] leading-relaxed mb-4">{t.aiActText}</p>
          <div className="space-y-4">
            {t.aiActItems.map((item) => (
              <div key={item.title} className="flex gap-2.5">
                <Check size={14} className="text-violet-400 shrink-0 mt-1" />
                <div>
                  <h3 className="text-sm font-bold text-[#e8e8f0] mb-1">{item.title}</h3>
                  <p className="text-sm text-[#a8a8be] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Honest roadmap */}
      <section className="relative z-10 py-12 px-6">
        <div className="max-w-4xl mx-auto p-7 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04]">
          <h2 className="text-lg font-bold text-amber-300 mb-2">{t.roadmapTitle}</h2>
          <p className="text-sm text-[#a8a8be] leading-relaxed mb-4">{t.roadmapText}</p>
          <ul className="space-y-2.5">
            {t.roadmapItems.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-[#a8a8be] leading-relaxed">
                <ArrowRight size={14} className="text-amber-400 shrink-0 mt-1" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.faqTitle} />
          <FaqList items={t.faq} />
        </div>
      </section>

      {/* Responsible disclosure */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-4xl mx-auto p-7 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a]">
          <h3 className="text-sm font-bold text-[#e8e8f0] mb-2">{t.disclosureTitle}</h3>
          <p className="text-sm text-[#8888aa] leading-relaxed">{t.disclosureText}</p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#e8e8f0] mb-4">{t.ctaTitle}</h2>
          <p className="text-[#8888aa] mb-8">{t.ctaSub}</p>
          <Link
            href={p(lang, "/signup")}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            {t.ctaButton} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <MarketingFooter lang={lang} />
    </div>
  );
}
