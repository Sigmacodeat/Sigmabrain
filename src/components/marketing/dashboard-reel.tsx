"use client";

// "Sigmabrain in action" — a scripted, looping mockup of the dashboard with an
// animated cursor that attaches a file, types a question and receives a cited
// answer. The premium "product reel" technique (Linear/Arc style) done in pure
// React/framer-motion — no video, themeable via --brand-*. Reduced-motion shows
// the final answered state without the loop.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Paperclip, Send, FileText, Sparkles, MousePointer2 } from "lucide-react";
import type { Lang } from "@/content/site";

interface Reel {
  question: string;
  file: string;
  answer: string;
  sources: string[];
}

const COPY: Record<Lang, Reel> = {
  de: {
    question: "Was ist in dieser Akte noch offen — mit Fundstellen?",
    file: "Akte_Mueller_GmbH.pdf",
    answer: "3 offene Punkte: Klageerwiderung-Frist (12.07.), fehlende Vollmacht, Zeugenliste unvollständig.",
    sources: ["akten/mueller-gmbh", "fristen/2026-07", "schriftsatz/klageerwiderung"],
  },
  en: {
    question: "What's still open in this matter — with sources?",
    file: "Matter_Mueller_Ltd.pdf",
    answer: "3 open items: defense-filing deadline (Jul 12), missing power of attorney, witness list incomplete.",
    sources: ["matters/mueller-ltd", "deadlines/2026-07", "filing/defense"],
  },
};

// Scripted timeline. cursor = % position within the reel; each step dwells.
const STEPS = [
  { dwell: 900, cx: 50, cy: 50 },   // 0 idle, center
  { dwell: 650, cx: 9, cy: 90 },    // 1 → attach button
  { dwell: 500, cx: 9, cy: 90 },    // 2 click attach (file attaches)
  { dwell: 1800, cx: 45, cy: 90 },  // 3 → input, typing
  { dwell: 450, cx: 94, cy: 90 },   // 4 → send
  { dwell: 400, cx: 94, cy: 90 },   // 5 click send (user msg)
  { dwell: 1100, cx: 70, cy: 45 },  // 6 thinking
  { dwell: 2800, cx: 70, cy: 45 },  // 7 answer
  { dwell: 1500, cx: 70, cy: 45 },  // 8 hold
] as const;

export default function DashboardReel({ lang, className = "" }: { lang: Lang; className?: string }) {
  const reduce = useReducedMotion();
  const r = COPY[lang];
  const [phase, setPhase] = useState(reduce ? 7 : 0);
  const [typed, setTyped] = useState(reduce ? r.question : "");

  // advance the timeline (loops); static at "answer" under reduced-motion
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setPhase((p) => (p + 1) % STEPS.length), STEPS[phase].dwell);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  // typewriter during the typing phase (3)
  useEffect(() => {
    if (reduce) return;
    if (phase < 3) { setTyped(""); return; }
    if (phase > 3) { setTyped(r.question); return; }
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(r.question.slice(0, i));
      if (i >= r.question.length) clearInterval(iv);
    }, 45);
    return () => clearInterval(iv);
  }, [phase, reduce, r.question]);

  const fileAttached = phase >= 2;
  const userSent = phase >= 5;
  const thinking = phase === 6;
  const answered = phase >= 7;
  const step = STEPS[phase];

  return (
    <div className={`relative rounded-2xl border border-[#1e1e3a] bg-[#0a0a14] shadow-2xl shadow-black/60 overflow-hidden ${className}`}>
      {/* window bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e3a] bg-[#0d0d1a]">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <div className="flex-1 ml-3 text-xs text-[#4a4a6a] font-mono">sigmabrain — dashboard</div>
        <span className="text-[10px] brand-text font-medium">{lang === "de" ? "live" : "live"}</span>
      </div>

      <div className="grid grid-cols-[120px_1fr] h-[330px]">
        {/* mini sidebar */}
        <div className="border-r border-[#1e1e3a] bg-[#0b0b16] p-3 hidden sm:flex flex-col gap-1.5">
          {[
            { t: lang === "de" ? "Brain fragen" : "Ask brain", active: true },
            { t: lang === "de" ? "Akten" : "Matters" },
            { t: lang === "de" ? "Fristen" : "Deadlines" },
            { t: "Upload" },
            { t: lang === "de" ? "Konnektoren" : "Connectors" },
          ].map((it) => (
            <div key={it.t} className={`text-[11px] px-2 py-1.5 rounded-md ${it.active ? "brand-soft brand-text" : "text-[#8888aa]"}`}>{it.t}</div>
          ))}
        </div>

        {/* chat panel */}
        <div className="relative flex flex-col p-4 overflow-hidden">
          <div className="flex-1 space-y-3 overflow-hidden">
            {userSent && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-[#13132a] border border-[#1e1e3a] px-3 py-2">
                  <p className="text-xs text-[#e8e8f0]">{r.question}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] brand-text">
                    <FileText size={10} /> {r.file}
                  </span>
                </div>
              </motion.div>
            )}
            {thinking && (
              <div className="flex items-center gap-1.5 text-[#8888aa] text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-secondary)] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-secondary)] animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-secondary)] animate-bounce [animation-delay:0.3s]" />
              </div>
            )}
            {answered && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                <div className="w-6 h-6 rounded-md brand-soft border brand-border flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="brand-text" />
                </div>
                <div className="max-w-[85%]">
                  <p className="text-xs text-[#c8c8d8] leading-relaxed">{r.answer}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.sources.map((s) => (
                      <span key={s} className="text-[9px] font-mono brand-text brand-soft px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* input bar */}
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#1e1e3a] bg-[#0b0b16] px-2 py-2">
            <div className={`flex items-center gap-1 rounded-lg px-1.5 py-1 ${fileAttached ? "brand-soft" : ""}`}>
              <Paperclip size={14} className={fileAttached ? "brand-text" : "text-[#4a4a6a]"} />
            </div>
            <div className="flex-1 text-xs text-[#e8e8f0] min-h-[16px]">
              {fileAttached && !userSent && (
                <span className="mr-1 inline-flex items-center gap-1 text-[10px] brand-text align-middle">
                  <FileText size={10} /> {r.file}
                </span>
              )}
              <span>{userSent ? "" : typed}</span>
              {!userSent && phase === 3 && <span className="inline-block w-0.5 h-3 bg-[var(--brand-secondary)] align-middle ml-0.5 animate-pulse" />}
            </div>
            <div className="rounded-lg brand-bg p-1.5"><Send size={13} className="text-white" /></div>
          </div>

          {/* animated cursor */}
          {!reduce && (
            <motion.div
              className="absolute z-20"
              animate={{ left: `${step.cx}%`, top: `${step.cy}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <motion.div
                animate={{ scale: phase === 2 || phase === 5 ? [1, 0.8, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                <MousePointer2 size={18} className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] fill-white/20" />
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
