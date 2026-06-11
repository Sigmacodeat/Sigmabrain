"use client";

// Features page — interactive category explorer with animated transitions.

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaMark } from "@/components/brand/logo";
import { p, type Lang } from "@/content/site";
import { FEATURES_PAGE } from "@/content/features";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  ICONS,
} from "./chrome";

export default function FeaturesPage({ lang }: { lang: Lang }) {
  const t = FEATURES_PAGE[lang];
  const [active, setActive] = useState(t.categories[0].id);
  const cat = t.categories.find((c) => c.id === active) ?? t.categories[0];
  const CatIcon = ICONS[cat.icon];

  return (
    <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang}>
      <MarketingBackground />
      <MarketingNav lang={lang} />

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-16 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs text-violet-400 font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          {t.badge}
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-[#e8e8f0] leading-[1.08] tracking-tight mb-6">
          {t.h1a}<br />
          <span className="gradient-text glow-text">{t.h1b}</span>
        </h1>
        <p className="text-lg md:text-xl text-[#8888aa] max-w-2xl mx-auto leading-relaxed">{t.sub}</p>
      </section>

      {/* Category tabs */}
      <section className="relative z-10 px-6 max-w-6xl mx-auto pb-24">
        <div
          role="tablist"
          aria-label="Feature categories"
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {t.categories.map((c) => {
            const Icon = ICONS[c.icon];
            const isActive = c.id === active;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(c.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                  isActive
                    ? "bg-violet-600/15 text-violet-300 border-violet-500/40 shadow-lg shadow-violet-900/20"
                    : "text-[#8888aa] border-[#1e1e3a] hover:border-[#3a3a6a] hover:text-[#e8e8f0]"
                }`}
              >
                {Icon && <Icon size={14} />}
                {c.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={cat.id}
            role="tabpanel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="grid lg:grid-cols-2 gap-8 items-start"
          >
            {/* Left: explanation */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  {CatIcon && <CatIcon size={20} className="text-violet-400" />}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-[#e8e8f0]">{cat.title}</h2>
              </div>
              <p className="text-base text-[#8888aa] leading-relaxed mb-8">{cat.intro}</p>
              <div className="space-y-4">
                {cat.items.map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.2 }}
                    className="flex gap-3 p-4 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a] transition-colors"
                  >
                    <CheckCircle2 size={16} className="text-violet-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-[#e8e8f0] mb-1">{item.title}</h3>
                      <p className="text-sm text-[#8888aa] leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: terminal demo */}
            {cat.demo ? (
              <div className="lg:sticky lg:top-8">
                <div className="rounded-2xl border border-[#1e1e3a] bg-[#0a0a18] shadow-2xl shadow-black/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e3a]">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                    <div className="flex-1 ml-4 text-xs text-[#4a4a6a] font-mono">{cat.demo.windowTitle}</div>
                  </div>
                  <div className="p-5 font-mono text-xs leading-relaxed space-y-1.5">
                    {cat.demo.lines.map((line, i) => (
                      <motion.p
                        key={`${cat.id}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.12 * i, duration: 0.25 }}
                        className={
                          line.startsWith("$") || line.startsWith(">")
                            ? "text-[#e8e8f0]"
                            : line.includes("⚠")
                              ? "text-amber-400"
                              : line.startsWith("→") || line.match(/^\d\d:\d\d/)
                                ? "text-violet-300"
                                : "text-[#8888aa]"
                        }
                      >
                        {line}
                      </motion.p>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex items-center justify-center h-full min-h-[300px] rounded-2xl border border-dashed border-[#1e1e3a]">
                <div className="text-center px-8">
                  <CatIcon size={32} className="text-violet-500/40 mx-auto mb-4" />
                  <p className="text-sm text-[#4a4a6a] max-w-xs">
                    {lang === "en"
                      ? "Audited in code, enforced by tests — read the open-source core."
                      : "Im Code auditierbar, durch Tests erzwungen — lies den Open-Source-Kern."}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 text-center max-w-3xl mx-auto border-t border-[#1e1e3a]">
        <SigmaMark size={64} className="mx-auto mb-8 rounded-[15px] glow-purple" />
        <h2 className="text-3xl md:text-4xl font-black text-[#e8e8f0] mb-4">{t.ctaTitle}</h2>
        <p className="text-lg text-[#8888aa] mb-10">{t.ctaSub}</p>
        <Link href={p(lang, "/signup")}>
          <Button size="xl" variant="glow">
            {t.ctaButton} <ArrowRight size={18} />
          </Button>
        </Link>
      </section>

      <MarketingFooter lang={lang} />
    </div>
  );
}
