"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CheckCircle2, ChevronDown, Loader2, LockKeyhole, Send, Sparkles, X } from "lucide-react";
import { SigmaMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { type Lang } from "@/content/site";
import { profileForIndustry } from "@/lib/industry-pack";
import { styleForIndustry } from "@/lib/industry-theme";

type Role = "user" | "assistant";
type FieldKey = "industry" | "teamSize" | "useCase" | "hosting" | "timeline" | "email";

interface ChatMessage {
  role: Role;
  content: string;
}

interface AgentResponse {
  reply: string;
  fields: Partial<Record<FieldKey, string>>;
  industry: string | null;
  leadScore: "low" | "medium" | "high" | "enterprise";
  recommendation: {
    plan: "free" | "pro" | "team" | "enterprise";
    label: string;
    product: string;
    cta: string;
    href: string;
    compareHref: string;
  };
  chips: string[];
  capture?: {
    eligible: boolean;
    saved: boolean;
    leadId: string | null;
    summary: string;
    message: string;
  };
}

const ROUTE_INDUSTRY: Record<string, string> = {
  "/subsumio": "legal",
  "/taxumio": "tax",
  "/compliance": "compliance",
  "/insurance": "insurance",
  "/realestate": "realestate",
  "/vc": "vc",
  "/consulting": "consulting",
  "/recruiting": "recruiting",
};

const intro = {
  en: {
    title: "Ask Sigmabrain",
    subtitle: "Product advisor · answers, qualifies, routes",
    starter: "Hi, I can help you choose the right Sigmabrain product and plan. What are you trying to solve?",
    placeholder: "Ask about pricing, security, product fit…",
    open: "Ask Sigmabrain",
    privacy: "No confidential client data here",
    consent: "Send this conversation to the Sigmabrain team",
    score: "Lead fit",
    fields: "Qualification",
    empty: "Start with one of these:",
    chips: ["Which product fits us?", "Pricing?", "Self-hosting?", "Compare to ChatGPT"],
  },
  de: {
    title: "Sigmabrain fragen",
    subtitle: "Produktberater · qualifiziert · routet",
    starter: "Hi, ich helfe dir, das richtige Sigmabrain-Produkt und den passenden Plan zu wählen. Was wollt ihr lösen?",
    placeholder: "Frag zu Preisen, Sicherheit, Produkt-Fit…",
    open: "Sigmabrain fragen",
    privacy: "Keine vertraulichen Mandantendaten hier",
    consent: "Diesen Verlauf ans Sigmabrain-Team übergeben",
    score: "Lead-Fit",
    fields: "Qualifikation",
    empty: "Starte hiermit:",
    chips: ["Welches Produkt passt?", "Preise?", "Self-hosting?", "Vergleich mit ChatGPT"],
  },
} as const;

function inferIndustryFromPath(pathname: string): string | null {
  const path = pathname.replace(/^\/de/, "") || "/";
  for (const [prefix, industry] of Object.entries(ROUTE_INDUSTRY)) {
    if (path.startsWith(prefix)) return industry;
  }
  if (path.includes("industry=medical")) return "medical";
  return null;
}

function formatFields(fields: Partial<Record<FieldKey, string>>, lang: Lang) {
  const labels: Record<FieldKey, string> = lang === "de"
    ? { industry: "Branche", teamSize: "Team", useCase: "Use Case", hosting: "Hosting", timeline: "Timeline", email: "Kontakt" }
    : { industry: "Industry", teamSize: "Team", useCase: "Use case", hosting: "Hosting", timeline: "Timeline", email: "Contact" };
  return (Object.entries(fields) as Array<[FieldKey, string]>).map(([key, value]) => ({ label: labels[key], value }));
}

export default function SalesAgentWidget({ lang }: { lang: Lang }) {
  const pathname = usePathname() || "/";
  const routeIndustry = inferIndustryFromPath(pathname);
  const routeProfile = routeIndustry ? profileForIndustry(routeIndustry) : null;
  const t = intro[lang];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Partial<Record<FieldKey, string>>>(routeIndustry ? { industry: routeIndustry } : {});
  const [consent, setConsent] = useState(false);
  const [industry, setIndustry] = useState<string | null>(routeIndustry);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: routeProfile ? `${t.starter}\n\n${routeProfile.brand}: ${routeProfile.signature.title[lang]}` : t.starter },
  ]);
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const chips = agent?.chips?.length ? agent.chips : t.chips;
  const activeProfile = industry ? profileForIndustry(industry) : routeProfile;
  const wrapperStyle = useMemo(() => industry ? styleForIndustry(industry) : undefined, [industry]);

  async function send(text = input) {
    const content = text.trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/marketing-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, path: pathname, industry, fields, messages: nextMessages, consent }),
      });
      if (res.status === 429) {
        const limited = lang === "de" ? "Kurz zu viele Anfragen. Versuch es gleich nochmal." : "Too many requests for a moment. Try again shortly.";
        setMessages((prev) => [...prev, { role: "assistant", content: limited }]);
        return;
      }
      const data = await res.json() as AgentResponse;
      setAgent(data);
      setFields(data.fields ?? {});
      setIndustry(data.industry ?? industry);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: lang === "de" ? "Ich konnte gerade nicht antworten. Die wichtigste Abkürzung: starte über Signup oder schau in den Vergleich." : "I couldn’t answer right now. The shortcut: start via signup or check the comparison.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80]" style={wrapperStyle}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mb-3 w-[calc(100vw-2.5rem)] max-w-[420px] overflow-hidden rounded-2xl border border-[#2a2a4a] bg-[#080812] shadow-2xl shadow-black/60"
          >
            <div className="flex items-center gap-3 border-b border-[#1e1e3a] bg-[#0d0d1a] px-4 py-3">
              <div className="w-9 h-9 rounded-xl brand-soft border brand-border flex items-center justify-center">
                <Bot size={18} className="brand-text" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#e8e8f0]">{activeProfile?.brand ?? t.title}</p>
                <p className="text-xs text-[#8888aa] truncate">{t.subtitle}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-[#8888aa] hover:text-[#e8e8f0] hover:bg-white/5" aria-label="Close advisor">
                <X size={17} />
              </button>
            </div>

            <div className="max-h-[410px] overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "brand-bg text-white"
                      : "border border-[#1e1e3a] bg-[#0d0d1a] text-[#c8c8d8]"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1a] px-3.5 py-2.5 text-sm text-[#8888aa] flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin brand-text" />
                    {lang === "de" ? "qualifiziert…" : "qualifying…"}
                  </div>
                </div>
              )}

              {agent?.recommendation && (
                <div className="rounded-xl border brand-border brand-soft p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles size={15} className="brand-text mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-wider brand-text font-semibold">{agent.recommendation.product} · {agent.recommendation.label}</p>
                      <p className="text-xs text-[#aaaac4] mt-1">{t.score}: {agent.leadScore}</p>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={agent.recommendation.href}>
                      <Button size="sm" variant="glow">{agent.recommendation.cta}</Button>
                    </Link>
                    <Link href={agent.recommendation.compareHref}>
                      <Button size="sm" variant="outline">{lang === "de" ? "Vergleich" : "Compare"}</Button>
                    </Link>
                  </div>
                </div>
              )}

              {agent?.capture && (
                <div className={`rounded-xl border p-3 ${
                  agent.capture.saved
                    ? "border-emerald-500/25 bg-emerald-500/10"
                    : "border-[#1e1e3a] bg-[#0d0d1a]"
                }`}>
                  <p className={agent.capture.saved ? "text-xs text-emerald-300" : "text-xs text-[#8888aa]"}>
                    {agent.capture.message}
                  </p>
                  {agent.capture.saved && agent.capture.leadId && (
                    <p className="mt-1 text-[10px] font-mono text-emerald-400/70">lead/{agent.capture.leadId.slice(0, 8)}</p>
                  )}
                </div>
              )}

              {formatFields(fields, lang).length > 0 && (
                <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#666684] mb-2">{t.fields}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formatFields(fields, lang).map((field) => (
                      <span key={field.label} className="rounded-full border border-[#2a2a4a] bg-[#111124] px-2 py-1 text-[11px] text-[#aaaac4]">
                        {field.label}: <span className="text-[#e8e8f0]">{field.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#1e1e3a] bg-[#0a0a18] p-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    disabled={loading}
                    className="shrink-0 rounded-full border border-[#2a2a4a] bg-[#111124] px-3 py-1.5 text-xs text-[#c8c8d8] hover:brand-border hover:brand-text disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 rounded-xl border border-[#1e1e3a] bg-[#06060f] px-3 py-2 focus-within:brand-border-strong">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={t.placeholder}
                  className="min-h-[24px] max-h-24 flex-1 resize-none bg-transparent text-sm text-[#e8e8f0] placeholder:text-[#666684] focus:outline-none"
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="rounded-lg brand-bg p-2 text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <label className="mt-2 flex items-start gap-2 text-[11px] text-[#777795] cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-[var(--brand-primary)]"
                />
                <span>{t.consent}</span>
              </label>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#666684]">
                <LockKeyhole size={11} /> {t.privacy}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-auto flex items-center gap-2 rounded-full border brand-border-strong bg-[#0d0d1a]/95 px-4 py-3 text-sm font-semibold text-[#e8e8f0] shadow-2xl shadow-black/50 backdrop-blur hover:brand-soft"
        aria-expanded={open}
        aria-label={activeProfile ? `${activeProfile.brand} Advisor` : t.open}
      >
        <SigmaMark size={21} tile={false} />
        <span className="hidden sm:inline">{activeProfile ? `${activeProfile.brand} Advisor` : t.open}</span>
        <ChevronDown size={16} className={open ? "" : "rotate-180"} />
      </button>
    </div>
  );
}
