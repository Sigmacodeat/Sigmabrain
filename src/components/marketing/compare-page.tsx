"use client";

// /compare — honest competitive comparison page. Renders the matrices from
// content/compare.ts with colorized cells (✓ green, ✗ rose, ~ amber,
// "k. A."/"n/a" gray). The page deliberately shows lost rows; do not "fix"
// the content to win them.
//
// Presentation: framer-motion scroll-reveals, a sticky table header, and a
// dedicated mobile card view (the wide matrices are unreadable as a single
// horizontally-scrolling table on phones). Decorative motion respects
// prefers-reduced-motion via <MotionConfig reducedMotion="user">.

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { ArrowRight, Check, X, Minus, CircleHelp } from "lucide-react";
import { p, type Lang } from "@/content/site";
import { COMPARE, type CompareTable } from "@/content/compare";
import {
  MarketingBackground,
  MarketingNav,
  MarketingFooter,
  SectionHeading,
  FaqList,
} from "./chrome";

function CellValue({ value }: { value: string }) {
  if (value.startsWith("✓")) {
    return (
      <span className="inline-flex items-start gap-1.5 text-emerald-400">
        <Check size={14} className="shrink-0 mt-0.5" />
        <span className="text-[#c8c8d8]">{value.slice(1).trim() || "Ja"}</span>
      </span>
    );
  }
  if (value.startsWith("✗")) {
    return (
      <span className="inline-flex items-start gap-1.5 text-rose-400">
        <X size={14} className="shrink-0 mt-0.5" />
        <span className="text-[#8888aa]">{value.slice(1).trim() || "Nein"}</span>
      </span>
    );
  }
  if (value.startsWith("~")) {
    return (
      <span className="inline-flex items-start gap-1.5 text-amber-400">
        <Minus size={14} className="shrink-0 mt-0.5" />
        <span className="text-[#a8a8be]">{value.slice(1).trim()}</span>
      </span>
    );
  }
  if (value === "k. A." || value === "n/a") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[#7878a0]">
        <CircleHelp size={13} className="shrink-0" />
        {value}
      </span>
    );
  }
  return <span className="text-[#a8a8be]">{value}</span>;
}

const viewport = { once: true, margin: "-60px" } as const;

function CompareMatrix({ table }: { table: CompareTable }) {
  return (
    <div>
      <SectionHeading title={table.title} sub={table.sub} />

      {/* Desktop / tablet: full matrix with sticky header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewport}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="hidden md:block overflow-x-auto rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a]"
      >
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-[#1e1e3a]">
              <th
                scope="col"
                className="sticky top-0 z-10 bg-[#0d0d1a] text-left p-4 text-[#8888aa] font-medium w-64"
              >
                <span className="sr-only">Feature</span>
              </th>
              {table.cols.map((col, i) => (
                <th
                  key={col}
                  scope="col"
                  className={`sticky top-0 z-10 text-left p-4 font-semibold ${
                    i === 0
                      ? "text-violet-300 bg-[#13102a]"
                      : "text-[#e8e8f0] bg-[#0d0d1a]"
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e3a]">
            {table.rows.map((row, ri) => (
              <motion.tr
                key={row.label}
                className="align-top hover:bg-white/[0.015] transition-colors"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={viewport}
                transition={{ duration: 0.3, delay: Math.min(ri * 0.025, 0.3) }}
              >
                <th scope="row" className="p-4 text-left text-[#e8e8f0] font-medium">
                  {row.label}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={i} className={`p-4 ${i === 0 ? "bg-violet-500/[0.04]" : ""}`}>
                    <CellValue value={cell} />
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Mobile: one card per row, each column listed vertically */}
      <div className="md:hidden space-y-3">
        {table.rows.map((row, ri) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.3, delay: Math.min(ri * 0.03, 0.25) }}
            className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] overflow-hidden"
          >
            <p className="px-4 py-3 text-sm font-semibold text-[#e8e8f0] border-b border-[#1e1e3a] bg-white/[0.02]">
              {row.label}
            </p>
            <dl className="divide-y divide-[#1e1e3a]">
              {row.cells.map((cell, i) => (
                <div
                  key={i}
                  className={`flex items-start justify-between gap-3 px-4 py-2.5 ${
                    i === 0 ? "bg-violet-500/[0.05]" : ""
                  }`}
                >
                  <dt
                    className={`text-xs shrink-0 ${
                      i === 0 ? "text-violet-300 font-semibold" : "text-[#8888aa]"
                    }`}
                  >
                    {table.cols[i]}
                  </dt>
                  <dd className="text-right text-sm">
                    <CellValue value={cell} />
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        ))}
      </div>

      <ul className="mt-4 space-y-1.5">
        {table.footnotes.map((note, i) => (
          <li key={i} className="text-xs text-[#7878a0] leading-relaxed">
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ComparePage({ lang }: { lang: Lang }) {
  const t = COMPARE[lang];

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#06060f] overflow-x-hidden" lang={lang}>
        <MarketingBackground />
        <MarketingNav lang={lang} />

        {/* Hero */}
        <section className="relative z-10 pt-20 pb-16 px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-4xl mx-auto text-center"
          >
            <span className="inline-block px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-6">
              {t.badge}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-[#e8e8f0] leading-tight mb-6">
              {t.h1a}
              <br />
              <span className="text-violet-400">{t.h1b}</span>
            </h1>
            <p className="text-lg text-[#8888aa] leading-relaxed max-w-3xl mx-auto">{t.sub}</p>
            <p className="text-xs text-[#7878a0] mt-6">{t.snapshot}</p>
          </motion.div>
        </section>

        {/* Honesty block — what we are NOT */}
        <section className="relative z-10 py-12 px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.4 }}
            className="max-w-4xl mx-auto p-7 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04]"
          >
            <h2 className="text-lg font-bold text-amber-300 mb-3">{t.honestyTitle}</h2>
            <p className="text-sm text-[#a8a8be] leading-relaxed">{t.honestyText}</p>
          </motion.div>
        </section>

        {/* Matrix 1: legal AI */}
        <section className="relative z-10 py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <CompareMatrix table={t.legal} />
          </div>
        </section>

        {/* Matrix 2: governance & EU compliance */}
        <section className="relative z-10 py-16 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
          <div className="max-w-6xl mx-auto">
            <CompareMatrix table={t.gov} />
          </div>
        </section>

        {/* Matrix 3: knowledge tools */}
        <section className="relative z-10 py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <CompareMatrix table={t.km} />
          </div>
        </section>

        {/* When them / when us */}
        <section className="relative z-10 py-20 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={viewport}
              transition={{ duration: 0.4 }}
              className="p-7 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a]"
            >
              <h3 className="text-base font-bold text-[#e8e8f0] mb-4">{t.whenThem.title}</h3>
              <ul className="space-y-3">
                {t.whenThem.items.map((item, i) => (
                  <li key={i} className="text-sm text-[#8888aa] leading-relaxed flex gap-2.5">
                    <ArrowRight size={14} className="text-[#7878a0] shrink-0 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={viewport}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="p-7 rounded-2xl border border-violet-500/30 bg-violet-500/[0.05]"
            >
              <h3 className="text-base font-bold text-violet-300 mb-4">{t.whenUs.title}</h3>
              <ul className="space-y-3">
                {t.whenUs.items.map((item, i) => (
                  <li key={i} className="text-sm text-[#a8a8be] leading-relaxed flex gap-2.5">
                    <Check size={14} className="text-violet-400 shrink-0 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="relative z-10 py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <SectionHeading title={t.faqTitle} />
            <FaqList items={t.faq} />
          </div>
        </section>

        {/* Sources + disclaimer */}
        <section className="relative z-10 py-16 px-6 bg-[#0d0d1a]/50 border-y border-[#1e1e3a]">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-semibold text-[#8888aa] mb-4">{t.sourcesTitle}</h3>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mb-8">
              {t.sources.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="text-xs text-violet-400/80 hover:text-violet-300 hover:underline"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#7878a0] leading-relaxed">{t.disclaimer}</p>
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
    </MotionConfig>
  );
}
