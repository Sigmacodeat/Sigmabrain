"use client";

// Brain-connected workspace home for a vertical without bespoke tooling.
// Prompts deep-link to /dashboard/query?q= (the real brain query, industry-tuned);
// tools link to the generic dashboard pages that serve the vertical.

import Link from "next/link";
import { MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import type { DashboardVertical } from "@/content/dashboard-verticals";
import { styleForIndustry } from "@/lib/industry-theme";

export default function VerticalWorkspace({ v }: { v: DashboardVertical }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10" style={styleForIndustry(v.slug)}>
      {/* Header */}
      <div>
        <span className="inline-block px-2.5 py-0.5 rounded-full border brand-border brand-soft brand-text text-xs font-medium mb-3">
          {v.brand} · powered by Sigmabrain
        </span>
        <h1 className="text-2xl font-bold text-[#15151d]">{v.title}</h1>
        <p className="text-sm text-[#585866] mt-2 max-w-2xl leading-relaxed">{v.intro}</p>
      </div>

      {/* Brain prompts */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#585866] mb-3 flex items-center gap-2">
          <MessageSquare size={13} className="brand-text" /> Das Brain fragen
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {v.prompts.map((p) => (
            <Link
              key={p}
              href={`/dashboard/query?q=${encodeURIComponent(p)}`}
              className="group flex items-start gap-3 p-4 rounded-xl border border-[#e2e4ec] bg-[#ffffff] hover:brand-border-strong hover:bg-[#f1f2f6] transition-colors"
            >
              <MessageSquare size={15} className="brand-text shrink-0 mt-0.5" />
              <span className="text-sm text-[#2a2a36] leading-snug">{p}</span>
              <ArrowRight size={14} className="text-[#74748a] shrink-0 ml-auto mt-0.5 group-hover:brand-text transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#585866] mb-3">Tools</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {v.tools.map((t) => (
            <Link
              key={t.href + t.label}
              href={t.href}
              className="group p-4 rounded-xl border border-[#e2e4ec] bg-[#ffffff] hover:brand-border-strong hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#15151d]">{t.label}</h3>
                <ArrowRight size={13} className="text-[#74748a] group-hover:brand-text transition-colors" />
              </div>
              <p className="text-xs text-[#585866] mt-1 leading-relaxed">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Skills available */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#585866] mb-3 flex items-center gap-2">
          <Sparkles size={13} className="brand-text" /> Agenten-Skills für diese Branche
        </h2>
        <div className="flex flex-wrap gap-2">
          {v.skills.map((s) => (
            <span key={s} className="text-xs font-mono brand-text brand-soft border brand-border px-2.5 py-1 rounded-full">
              {s}
            </span>
          ))}
        </div>
        <p className="text-xs text-[#74748a] mt-3 leading-relaxed">
          Diese Skills bedient der <Link href="/dashboard/assistant" className="brand-text hover:underline">Assistant</Link> bzw. die <Link href="/dashboard/agents" className="brand-text hover:underline">Agenten</Link> automatisch, wenn die Anfrage dazu passt.
        </p>
      </section>
    </div>
  );
}
