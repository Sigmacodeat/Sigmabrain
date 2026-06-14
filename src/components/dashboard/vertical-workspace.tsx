"use client";

// Brain-connected workspace home for a vertical without bespoke tooling.
// Prompts deep-link to /dashboard/query?q= (the real brain query, industry-tuned);
// tools link to the generic dashboard pages that serve the vertical.

import Link from "next/link";
import { MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import type { DashboardVertical } from "@/content/dashboard-verticals";

export default function VerticalWorkspace({ v }: { v: DashboardVertical }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div>
        <span className="inline-block px-2.5 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-3">
          {v.brand} · powered by Sigmabrain
        </span>
        <h1 className="text-2xl font-bold text-[#e8e8f0]">{v.title}</h1>
        <p className="text-sm text-[#8888aa] mt-2 max-w-2xl leading-relaxed">{v.intro}</p>
      </div>

      {/* Brain prompts */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888aa] mb-3 flex items-center gap-2">
          <MessageSquare size={13} className="text-violet-400" /> Das Brain fragen
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {v.prompts.map((p) => (
            <Link
              key={p}
              href={`/dashboard/query?q=${encodeURIComponent(p)}`}
              className="group flex items-start gap-3 p-4 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-violet-500/40 hover:bg-[#0f0f20] transition-colors"
            >
              <MessageSquare size={15} className="text-violet-400 shrink-0 mt-0.5" />
              <span className="text-sm text-[#c8c8d8] leading-snug">{p}</span>
              <ArrowRight size={14} className="text-[#4a4a6a] shrink-0 ml-auto mt-0.5 group-hover:text-violet-400 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888aa] mb-3">Tools</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {v.tools.map((t) => (
            <Link
              key={t.href + t.label}
              href={t.href}
              className="group p-4 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-violet-500/40 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#e8e8f0]">{t.label}</h3>
                <ArrowRight size={13} className="text-[#4a4a6a] group-hover:text-violet-400 transition-colors" />
              </div>
              <p className="text-xs text-[#8888aa] mt-1 leading-relaxed">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Skills available */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8888aa] mb-3 flex items-center gap-2">
          <Sparkles size={13} className="text-violet-400" /> Agenten-Skills für diese Branche
        </h2>
        <div className="flex flex-wrap gap-2">
          {v.skills.map((s) => (
            <span key={s} className="text-xs font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
              {s}
            </span>
          ))}
        </div>
        <p className="text-xs text-[#4a4a6a] mt-3 leading-relaxed">
          Diese Skills bedient der <Link href="/dashboard/assistant" className="text-violet-400 hover:underline">Assistant</Link> bzw. die <Link href="/dashboard/agents" className="text-violet-400 hover:underline">Agenten</Link> automatisch, wenn die Anfrage dazu passt.
        </p>
      </section>
    </div>
  );
}
