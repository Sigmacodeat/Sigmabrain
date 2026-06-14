"use client";

// Per-branch pricing section for the branded vertical pages. Shows the
// vertical's own tiers (vertical-pricing.ts) or the global PRICING fallback,
// with signup deep-links carrying ?industry= so the brain is provisioned for
// that vertical. Card style mirrors PricingGrid.

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING, p, type Lang } from "@/content/site";
import { pricingForIndustry } from "@/content/vertical-pricing";

export default function BranchPricing({ lang, industry }: { lang: Lang; industry: string }) {
  const vp = pricingForIndustry(lang, industry);
  const title = vp?.title ?? PRICING[lang].title;
  const sub = vp?.sub ?? PRICING[lang].sub;
  const tiers = vp?.tiers ?? PRICING[lang].tiers;

  // signup hrefs carry the industry so provisioning configures the right pack.
  const withIndustry = (href: string) =>
    href === "/signup" ? `/signup?industry=${industry}` : href;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20 mb-4">
          Pricing
        </span>
        <h2 className="text-3xl md:text-4xl font-black text-[#e8e8f0] mb-4">{title}</h2>
        <p className="text-lg text-[#8888aa] max-w-2xl mx-auto">{sub}</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {tiers.map((tier) => {
          const href = withIndustry(tier.href);
          const isExternal = href.startsWith("http") || href.startsWith("mailto");
          const btn = (
            <Button variant={tier.highlight ? "glow" : "secondary"} size="md" className="w-full">
              {tier.cta} <ArrowRight size={13} />
            </Button>
          );
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col p-6 rounded-2xl border ${
                tier.highlight ? "border-violet-500/40 bg-violet-500/[0.04]" : "border-[#1e1e3a] bg-[#0d0d1a]"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold">
                  {lang === "en" ? "Most popular" : "Beliebt"}
                </span>
              )}
              <p className="text-sm font-medium text-[#8888aa] mb-1">{tier.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#e8e8f0]">{tier.price}</span>
                <span className="text-xs text-[#8888aa]">{tier.period}</span>
              </div>
              <p className="text-xs text-[#8888aa] mt-2 leading-relaxed">{tier.blurb}</p>
              <ul className="space-y-2 my-5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[#a8a8be] leading-relaxed">
                    <Check size={13} className="text-violet-400 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              {isExternal ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{btn}</a>
              ) : (
                <Link href={p(lang, href)}>{btn}</Link>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-[#4a4a6a] mt-6">
        {PRICING[lang].footnote}{" "}
        <Link href={p(lang, "/pricing")} className="text-violet-400 hover:underline">
          {lang === "en" ? "Full pricing & FAQ" : "Alle Preise & FAQ"}
        </Link>
      </p>
    </div>
  );
}
