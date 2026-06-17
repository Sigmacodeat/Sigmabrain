"use client";

// Shared pricing grid — used by the landing page section and /pricing page.

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING, p, type Lang } from "@/content/site";

export function PricingGrid({ lang }: { lang: Lang }) {
  const pricing = PRICING[lang];
  return (
    <>
      <div className={`grid md:grid-cols-2 gap-5 ${pricing.tiers.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3 max-w-5xl mx-auto"}`}>
        {pricing.tiers.map((tier) => (
          <div
            key={tier.id}
            className={`relative p-7 rounded-2xl border flex flex-col transition-all duration-200 ${
              tier.highlight
                ? "border-violet-500/50 bg-gradient-to-b from-violet-500/10 to-[var(--mk-surface)] shadow-xl shadow-violet-900/20"
                : "[border-color:var(--mk-border)] [background:var(--mk-surface)] hover:[border-color:var(--mk-border-strong)]"
            }`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                  {lang === "en" ? "Most popular" : "Beliebteste Wahl"}
                </span>
              </div>
            )}
            <div className="mb-5">
              <p className="text-sm font-medium [color:var(--mk-text-muted)] mb-1">{tier.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold [color:var(--mk-text)]">{tier.price}</span>
                <span className="text-xs [color:var(--mk-text-muted)]">{tier.period}</span>
              </div>
              <p className="text-xs [color:var(--mk-text-muted)] mt-2 leading-relaxed">{tier.blurb}</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-7">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs [color:var(--mk-text-muted)]">
                  <Check size={13} className="text-violet-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            {tier.href.startsWith("http") || tier.href.startsWith("mailto") ? (
              <a href={tier.href} target={tier.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                <Button variant={tier.highlight ? "glow" : "secondary"} size="md" className="w-full">
                  {tier.cta} <ArrowRight size={13} />
                </Button>
              </a>
            ) : (
              <Link href={p(lang, tier.href)}>
                <Button variant={tier.highlight ? "glow" : "secondary"} size="md" className="w-full">
                  {tier.cta} <ArrowRight size={13} />
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-xs [color:var(--mk-text-subtle)] mt-8 max-w-2xl mx-auto">{pricing.footnote}</p>
    </>
  );
}
