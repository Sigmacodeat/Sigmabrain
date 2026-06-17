"use client";

import { motion, MotionConfig } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SigmaMark } from "@/components/brand/logo";
import { getDocs, type Lang } from "@/content/docs";
import { p } from "@/content/site";
import { ICONS } from "./chrome";
import { MarketingBackground, MarketingNav, MarketingFooter } from "./chrome";

const viewport = { once: true, margin: "0px 0px 80px 0px", amount: 0.12 } as const;
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport,
  transition: { duration: 0.5, ease: "easeOut" as const },
};

function FeatureCard({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) {
  const Icon = ICONS[icon];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration: 0.4, delay: (index % 3) * 0.06 }}
      whileHover={{ y: -3 }}
      className="p-5 rounded-2xl [background:var(--mk-surface)] transition-colors duration-200 hover:[background:var(--mk-surface-2)]"
      style={{ boxShadow: "var(--mk-card-shadow)" }}
    >
      <div className="flex items-start gap-3.5">
        {Icon && (
          <div className="w-9 h-9 rounded-lg brand-soft flex items-center justify-center shrink-0 mt-0.5">
            <Icon size={17} className="brand-text" />
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold [color:var(--mk-text)] mb-1.5">{title}</h4>
          <p className="text-xs leading-relaxed [color:var(--mk-text-muted)]">{desc}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function DocsPage({ lang }: { lang: Lang }) {
  const d = getDocs(lang);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen [background:var(--mk-bg)] overflow-x-hidden" lang={lang}>
        <MarketingBackground />
        <MarketingNav lang={lang} theme="dark" />

        {/* Hero */}
        <section className="relative z-10 pt-20 pb-16 px-6 max-w-7xl mx-auto text-center">
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8" style={{ color: "var(--signal-blue)", background: "rgba(29,78,216,0.08)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--signal-blue)" }} />
              {d.hero.badge}
            </div>
            <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-5 [color:var(--mk-text)]">
              {d.hero.title}<br />
              <span className="gradient-text">{d.hero.claim}</span>
            </h1>
            <p className="text-lg max-w-2xl mx-auto mb-10 leading-relaxed [color:var(--mk-text-muted)]">{d.hero.sub}</p>
            <p className="text-sm max-w-xl mx-auto leading-relaxed [color:var(--mk-text-subtle)]">{d.intro}</p>
          </motion.div>
        </section>

        {/* Categories */}
        <section className="relative z-10 pb-28 px-6">
          <div className="max-w-7xl mx-auto space-y-20">
            {d.categories.map((cat, ci) => (
              <motion.div key={cat.id} {...reveal}>
                <div className="mb-8">
                  <h2 className="text-2xl md:text-3xl font-black [color:var(--mk-text)] mb-2">{cat.title}</h2>
                  <p className="text-sm [color:var(--mk-text-muted)]">{cat.sub}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cat.features.map((f, i) => (
                    <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} index={i} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="relative z-10 py-24 px-6 [background:color-mix(in_srgb,var(--mk-surface)_50%,transparent)]">
          <div className="max-w-7xl mx-auto">
            <motion.div {...reveal} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black [color:var(--mk-text)] mb-3">{d.arch.title}</h2>
              <p className="text-sm [color:var(--mk-text-muted)]">{d.arch.sub}</p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {d.arch.items.map((item, i) => (
                <FeatureCard key={item.title} icon={item.icon} title={item.title} desc={item.desc} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <motion.section {...reveal} className="relative z-10 py-28 px-6 text-center max-w-3xl mx-auto">
          <SigmaMark size={56} className="mx-auto mb-6 rounded-[15px] glow-purple" />
          <h2 className="text-3xl font-black [color:var(--mk-text)] mb-3">{d.cta.title}</h2>
          <p className="text-base [color:var(--mk-text-muted)] mb-8">{d.cta.sub}</p>
          <Link href={p(lang, "/login")}>
            <Button size="lg" variant="glow">
              <SigmaMark size={16} tile={false} /> {d.cta.button} <ArrowRight size={16} />
            </Button>
          </Link>
        </motion.section>

        <MarketingFooter lang={lang} />
      </div>
    </MotionConfig>
  );
}
