"use client";

// Shared marketing chrome: Nav (with language switcher + solutions dropdown),
// Footer, and small shared primitives used across all marketing pages.

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Globe,
  Database,
  GitBranch,
  Search,
  Zap,
  Shield,
  Layers,
  Network,
  Megaphone,
  Gift,
  Handshake,
  CalendarClock,
  Mail,
  ShieldAlert,
  Calculator,
  Landmark,
  FileText,
  FolderOpen,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaLogo, SigmaMark } from "@/components/brand/logo";
import { SubsumioLogo } from "@/components/brand/subsumio-logo";
import { NAV, FOOTER, p, altPath, ENGINE_REPO_URL, type Lang } from "@/content/site";
import { brandForHost, SUBSUMIO_SITE_URL, isExternalUrl, type SiteBrand } from "@/lib/brand";
import SalesAgentWidget from "./sales-agent-widget";

// Resolve the active brand from the request host on the client. On a Subsumio
// domain (subsum.io / subsumio.com) the chrome renders Subsumio-scoped: a
// Subsumio wordmark and no platform "Solutions" dropdown. Detected post-mount
// to keep every marketing page statically rendered.
function useSiteBrand(): SiteBrand {
  const [brand, setBrand] = useState<SiteBrand>("sigmabrain");
  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("brand");
    if (override === "subsumio" || override === "sigmabrain") {
      setBrand(override);
      return;
    }
    setBrand(brandForHost(window.location.host));
  }, []);
  return brand;
}

// Brand-aware logo lockup for the nav. Subsumio is "powered by Sigmabrain", so
// it keeps the Sigma mark and adds the attribution line.
function BrandLogo({ brand }: { brand: SiteBrand }) {
  if (brand !== "subsumio") return <SigmaLogo size={32} />;
  return <SubsumioLogo size={34} />;
}

// Content files store icon names as strings; resolve them here.
export const ICONS: Record<string, LucideIcon> = {
  Brain, Database, GitBranch, Search, Zap, Shield, Layers, Network,
  Megaphone, Gift, Handshake,
  CalendarClock, Mail, ShieldAlert, Calculator, Landmark, FileText, FolderOpen, MessageSquare, Users,
};

export const COLOR_MAP: Record<string, string> = {
  violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

export function MarketingBackground() {
  // Scroll-parallax depth: orbs and grid drift at different rates as the page
  // scrolls. The CSS orb-float animation still runs on the inner element, so
  // parallax (outer) + float (inner) compose. Reduced-motion → no drift.
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const span = reduce ? 0 : 1;
  const yViolet = useTransform(scrollY, [0, 1600], [0, 240 * span]);
  const yBlue = useTransform(scrollY, [0, 1600], [0, -190 * span]);
  const yGrid = useTransform(scrollY, [0, 1600], [0, 110 * span]);
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <motion.div style={{ y: yViolet }} className="absolute top-[-20%] left-[-10%] will-change-transform">
        <div className="orb w-[600px] h-[600px] rounded-full brand-glow-bg" />
      </motion.div>
      <motion.div style={{ y: yBlue }} className="absolute bottom-[-20%] right-[-10%] will-change-transform">
        <div className="orb-slow w-[500px] h-[500px] rounded-full brand-secondary-soft" />
      </motion.div>
      <motion.div style={{ y: yGrid }} className="grid-bg absolute inset-0 opacity-40 will-change-transform" />
    </div>
  );
}

export function MarketingNav({ lang }: { lang: Lang }) {
  const nav = NAV[lang];
  const brand = useSiteBrand();
  const isSubsumio = brand === "subsumio";
  const pathname = usePathname() || "/";
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const other: Lang = lang === "en" ? "de" : "en";

  return (
    <>
    <nav className="relative z-50 max-w-7xl mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <Link href={p(lang, "")} aria-label={isSubsumio ? "Subsumio home" : "Sigmabrain home"}>
          <BrandLogo brand={brand} />
        </Link>

        <div className="hidden md:flex items-center gap-7">
          <Link href={p(lang, "/features")} className="text-sm text-[#8888aa] hover:text-[#e8e8f0]">{nav.features}</Link>
          {!isSubsumio && (
          <div
            className="relative"
            onMouseEnter={() => setSolutionsOpen(true)}
            onMouseLeave={() => setSolutionsOpen(false)}
          >
            <button
              className="flex items-center gap-1 text-sm text-[#8888aa] hover:text-[#e8e8f0] py-2"
              aria-expanded={solutionsOpen}
              aria-haspopup="true"
              onClick={() => setSolutionsOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSolutionsOpen(false);
              }}
            >
              {nav.solutions} <ChevronDown size={13} className={solutionsOpen ? "rotate-180" : ""} />
            </button>
            {solutionsOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 w-80">
                <div className="glass rounded-xl p-2 shadow-2xl shadow-black/50">
                  {nav.solutionItems.map((item) => {
                    const comingSoon = "comingSoon" in item && item.comingSoon;
                    if (comingSoon) {
                      return (
                        <div
                          key={item.href}
                          className="block px-3 py-2.5 rounded-lg cursor-default opacity-55"
                          aria-disabled="true"
                        >
                          <p className="text-sm font-medium text-[#e8e8f0] flex items-center gap-2">
                            {item.label}
                            <span className="text-[10px] font-semibold uppercase tracking-wide brand-text brand-soft px-1.5 py-0.5 rounded">
                              {nav.comingSoonLabel}
                            </span>
                          </p>
                          <p className="text-xs text-[#8888aa] mt-0.5">{item.desc}</p>
                        </div>
                      );
                    }
                    const resolvedHref = item.href === "/subsumio" ? SUBSUMIO_SITE_URL : item.href;
                    const external = isExternalUrl(resolvedHref);
                    const inner = (
                      <>
                        <p className="text-sm font-medium text-[#e8e8f0] group-hover:brand-text">{item.label}</p>
                        <p className="text-xs text-[#8888aa] mt-0.5">{item.desc}</p>
                      </>
                    );
                    const cls = "block px-3 py-2.5 rounded-lg hover:bg-[#1a1a35] group";
                    return external ? (
                      <a key={item.href} href={resolvedHref} className={cls} onClick={() => setSolutionsOpen(false)}>
                        {inner}
                      </a>
                    ) : (
                      <Link key={item.href} href={p(lang, resolvedHref)} className={cls} onClick={() => setSolutionsOpen(false)}>
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}
          <Link href={p(lang, "/pricing")} className="text-sm text-[#8888aa] hover:text-[#e8e8f0]">{nav.pricing}</Link>
          {!isSubsumio && <Link href={p(lang, "/compare")} className="text-sm text-[#8888aa] hover:text-[#e8e8f0]">{nav.compare}</Link>}
          <a href={ENGINE_REPO_URL} target="_blank" rel="noreferrer" className="text-sm text-[#8888aa] hover:text-[#e8e8f0]">{nav.docs}</a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={altPath(lang, pathname)}
            className="hidden sm:flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-[#e8e8f0] border border-[#1e1e3a] hover:border-[#3a3a6a] rounded-full px-3 py-1.5"
            aria-label={lang === "en" ? "Auf Deutsch lesen" : "Read in English"}
          >
            <Globe size={12} /> {other.toUpperCase()}
          </Link>
          <Link href={p(lang, "/login")} className="hidden sm:block">
            <Button variant="ghost" size="sm">{nav.signIn}</Button>
          </Link>
          <Link href={p(lang, "/signup")}>
            <Button size="sm" variant="glow">{nav.cta} <ChevronRight size={14} /></Button>
          </Link>
          <button
            className="md:hidden p-2 text-[#8888aa] hover:text-[#e8e8f0]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden mt-3 glass rounded-xl p-3 space-y-1">
          <Link href={p(lang, "/features")} className="block px-3 py-2 rounded-lg text-sm text-[#8888aa] hover:bg-[#1a1a35]" onClick={() => setMobileOpen(false)}>{nav.features}</Link>
          {!isSubsumio && nav.solutionItems.map((item) => {
            const comingSoon = "comingSoon" in item && item.comingSoon;
            if (comingSoon) {
              return (
                <div key={item.href} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-[#8888aa] opacity-60" aria-disabled="true">
                  {item.label}
                  <span className="text-[10px] font-semibold uppercase tracking-wide brand-text">{nav.comingSoonLabel}</span>
                </div>
              );
            }
            const resolvedHref = item.href === "/subsumio" ? SUBSUMIO_SITE_URL : item.href;
            const cls = "block px-3 py-2 rounded-lg text-sm text-[#e8e8f0] hover:bg-[#1a1a35]";
            return isExternalUrl(resolvedHref) ? (
              <a key={item.href} href={resolvedHref} className={cls} onClick={() => setMobileOpen(false)}>
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={p(lang, resolvedHref)} className={cls} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            );
          })}
          <Link href={p(lang, "/pricing")} className="block px-3 py-2 rounded-lg text-sm text-[#8888aa] hover:bg-[#1a1a35]" onClick={() => setMobileOpen(false)}>{nav.pricing}</Link>
          {!isSubsumio && <Link href={p(lang, "/compare")} className="block px-3 py-2 rounded-lg text-sm text-[#8888aa] hover:bg-[#1a1a35]" onClick={() => setMobileOpen(false)}>{nav.compare}</Link>}
          <Link href={altPath(lang, pathname)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[#8888aa] hover:bg-[#1a1a35]" onClick={() => setMobileOpen(false)}>
            <Globe size={13} /> {lang === "en" ? "Deutsch" : "English"}
          </Link>
        </div>
      )}
    </nav>
    <SalesAgentWidget lang={lang} />
    </>
  );
}

export function MarketingFooter({ lang }: { lang: Lang }) {
  const footer = FOOTER[lang];
  const brand = useSiteBrand();
  const isSubsumio = brand === "subsumio";
  return (
    <footer className="relative z-10 border-t border-[#1e1e3a] py-14 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-10">
          <div className="col-span-2">
            <div className="mb-3">
              {isSubsumio ? (
                <SubsumioLogo size={28} />
              ) : (
                <SigmaLogo size={24} wordmarkClassName="text-sm font-semibold text-[#e8e8f0]" />
              )}
            </div>
            <p className="text-sm text-[#8888aa] mb-4">
              {isSubsumio
                ? (lang === "de" ? "Das Kanzlei-Gehirn — angetrieben von Sigmabrain." : "The law firm's brain — powered by Sigmabrain.")
                : footer.tagline}
            </p>
            <p className="text-xs text-[#4a4a6a] leading-relaxed max-w-xs">{footer.note}</p>
          </div>
          {footer.columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a href={link.href} target="_blank" rel="noreferrer" className="text-xs text-[#4a4a6a] hover:text-[#8888aa]">{link.label}</a>
                    ) : (
                      // App-Routen (/dashboard…) sind nicht lokalisiert —
                      // niemals den Sprachpräfix anhängen (/de/dashboard = 404).
                      <Link href={link.href.startsWith("/dashboard") ? link.href : p(lang, link.href)} className="text-xs text-[#4a4a6a] hover:text-[#8888aa]">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-[#1e1e3a] flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-[#4a4a6a]">© 2026 Sigmabrain</p>
          <p className="text-xs text-[#4a4a6a]">
            {lang === "en" ? "EU-hosted or self-hosted · GDPR-ready · confidentiality-first" : "EU-gehostet oder self-hosted · DSGVO-konform · vertraulichkeitskritisch"}
          </p>
        </div>
      </div>
    </footer>
  );
}

// --- Shared section primitives -------------------------------------------

export function SectionHeading({ badge, title, sub, tone = "dark" }: { badge?: string; title: string; sub?: string; tone?: "light" | "dark" }) {
  const light = tone === "light";
  return (
    <div className="text-center mb-14">
      {badge && (
        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium brand-soft brand-text border brand-border mb-4">
          {badge}
        </span>
      )}
      <h2 className={`text-3xl md:text-4xl font-black mb-4 ${light ? "" : "text-[#e8e8f0]"}`} style={light ? { color: "var(--color-light-text)" } : undefined}>{title}</h2>
      {sub && <p className={`text-lg max-w-2xl mx-auto ${light ? "" : "text-[#8888aa]"}`} style={light ? { color: "var(--color-light-text-muted)" } : undefined}>{sub}</p>}
    </div>
  );
}

/** Terminal-style demo window with a typewriter answer. */
export function DemoWindow({
  windowTitle, you, q, a, sourcesLabel, sources,
}: {
  windowTitle: string; you: string; q: string; a: string; sourcesLabel: string; sources: readonly string[];
}) {
  return (
    <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a] shadow-2xl shadow-black/50 overflow-hidden text-left">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e3a] bg-[#0a0a18]">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <div className="flex-1 ml-4 text-xs text-[#4a4a6a] font-mono">{windowTitle}</div>
      </div>
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] text-violet-400 font-semibold">{you}</span>
          </div>
          <p className="text-sm text-[#e8e8f0]">{q}</p>
        </div>
      </div>
      <div className="px-6 pb-6">
        <div className="flex items-start gap-3">
          <SigmaMark size={28} className="shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-[#8888aa] leading-relaxed whitespace-pre-line">
            <TypewriterText text={a} speed={8} />
          </div>
        </div>
      </div>
      <div className="px-6 py-3 border-t border-[#1e1e3a] bg-[#0a0a18] flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[#4a4a6a]">{sourcesLabel}</span>
        {sources.map((slug) => (
          <span key={slug} className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">{slug}</span>
        ))}
      </div>
    </div>
  );
}

export function TypewriterText({ text, speed = 12 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started || displayed.length >= text.length) return;
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed);
    return () => clearTimeout(t);
  }, [displayed, started, text, speed]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && started && (
        <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </span>
  );
}

/** Renders **bold** spans inside demo answers (simple, no markdown lib). */
export function FaqList({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {items.map((item) => (
        <details key={item.q} className="group rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] open:border-[#3a3a6a]">
          <summary className="flex items-center justify-between cursor-pointer list-none px-5 py-4 text-sm font-medium text-[#e8e8f0]">
            {item.q}
            <ChevronDown size={15} className="text-[#4a4a6a] shrink-0 ml-4 group-open:rotate-180 transition-transform" />
          </summary>
          <p className="px-5 pb-4 text-sm text-[#8888aa] leading-relaxed">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
