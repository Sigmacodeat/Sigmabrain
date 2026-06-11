"use client";

// Download / install page — platform cards with step-by-step install,
// live install prompt (Android/Desktop via beforeinstallprompt), store preview.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Apple,
  Smartphone,
  Monitor,
  Download as DownloadIcon,
  Bell,
  Fingerprint,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaMark } from "@/components/brand/logo";
import { p, type Lang } from "@/content/site";
import { DOWNLOAD } from "@/content/download";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  SectionHeading,
  FaqList,
} from "./chrome";

const PLATFORM_ICONS: Record<string, LucideIcon> = { Apple, Smartphone, Monitor };

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export default function DownloadPage({ lang }: { lang: Lang }) {
  const t = DOWNLOAD[lang];
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // Chrome/Edge fire beforeinstallprompt → we can offer a real one-click install.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
        <p className="text-lg md:text-xl text-[#8888aa] max-w-2xl mx-auto mb-10 leading-relaxed">{t.sub}</p>

        {installEvent && (
          <Button
            size="xl"
            variant="glow"
            className="min-w-[240px]"
            onClick={() => installEvent.prompt()}
          >
            <DownloadIcon size={18} />
            {lang === "en" ? "Install Sigmabrain now" : "Sigmabrain jetzt installieren"}
          </Button>
        )}
      </section>

      {/* Platform cards */}
      <section className="relative z-10 px-6 max-w-6xl mx-auto pb-20">
        <div className="grid md:grid-cols-3 gap-5">
          {t.platforms.map((platform, idx) => {
            const Icon = PLATFORM_ICONS[platform.icon] ?? Monitor;
            return (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: idx * 0.08, duration: 0.3 }}
                className="p-7 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a] transition-colors flex flex-col"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
                  <Icon size={22} className="text-violet-400" />
                </div>
                <h2 className="text-lg font-bold text-[#e8e8f0] mb-1">{platform.name}</h2>
                <p className="text-sm text-violet-400 font-medium mb-5">{platform.tagline}</p>
                <ol className="space-y-3 flex-1">
                  {platform.steps.map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-[#8888aa] leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                {platform.note && (
                  <p className="text-xs text-[#4a4a6a] leading-relaxed mt-5 pt-4 border-t border-[#1e1e3a]">
                    {platform.note}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Store preview */}
      <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black text-[#e8e8f0] mb-4">{t.storesTitle}</h2>
          <p className="text-base text-[#8888aa] leading-relaxed mb-8">{t.storesSub}</p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {[
              { icon: Bell, label: lang === "en" ? "Push notifications" : "Push-Benachrichtigungen" },
              { icon: Fingerprint, label: lang === "en" ? "Biometric unlock" : "Biometrische Entsperrung" },
              { icon: Share2, label: lang === "en" ? "“Send to Sigmabrain”" : "„An Sigmabrain senden“" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <span key={f.label} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1e1e3a] bg-[#0d0d1a] text-xs text-[#8888aa]">
                  <Icon size={13} className="text-violet-400" /> {f.label}
                </span>
              );
            })}
          </div>

          {/* Store badge placeholders — replace with official badges at store launch */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {["App Store", "Google Play"].map((store) => (
              <div
                key={store}
                aria-disabled="true"
                className="flex items-center gap-3 px-6 py-3 rounded-xl border border-dashed border-[#3a3a6a] bg-[#0a0a18] opacity-70 select-none"
              >
                <DownloadIcon size={16} className="text-[#4a4a6a]" />
                <div className="text-left">
                  <p className="text-[10px] text-[#4a4a6a] uppercase tracking-wide">
                    {lang === "en" ? "Coming soon to" : "Bald im"}
                  </p>
                  <p className="text-sm font-semibold text-[#8888aa]">{store}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#4a4a6a] max-w-xl mx-auto leading-relaxed">{t.storesNote}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title={t.faqTitle} />
          <FaqList items={t.faq} />
        </div>
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
