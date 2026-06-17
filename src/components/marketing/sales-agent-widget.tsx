"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  LockKeyhole,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { SigmaLogo, SigmaMark } from "@/components/brand/logo";
import { SubsumioLogo, SubsumioMark } from "@/components/brand/subsumio-logo";
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
  const labels: Record<FieldKey, string> =
    lang === "de"
      ? { industry: "Branche", teamSize: "Team", useCase: "Use Case", hosting: "Hosting", timeline: "Timeline", email: "Kontakt" }
      : { industry: "Industry", teamSize: "Team", useCase: "Use case", hosting: "Hosting", timeline: "Timeline", email: "Contact" };
  return (Object.entries(fields) as Array<[FieldKey, string]>).map(([key, value]) => ({
    label: labels[key],
    value,
  }));
}

/* Brand lockup reuses the exact same marks the chrome nav displays */
function BrandHeader({ brand, label }: { brand: string; label: string }) {
  const isLegal = brand === "Subsumio";
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="shrink-0">
        {isLegal ? <SubsumioMark size={34} /> : <SigmaMark size={34} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold tracking-tight [color:var(--mk-text)] truncate">
          {brand}{" "}
          <span className="font-normal text-[13px] [color:var(--mk-text-muted)]">Advisor</span>
        </p>
        <p className="text-[11px] [color:var(--mk-text-muted)] truncate">{label}</p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full [background:var(--brand-text)]"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
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

  const isLegal = routeIndustry === "legal";
  const brandName = activeProfile?.brand ?? (isLegal ? "Subsumio" : "Sigmabrain");

  return (
    <div className="fixed bottom-5 right-5 z-[80]" style={wrapperStyle}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.94, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(2px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mb-4 w-[calc(100vw-1.5rem)] max-w-[440px] overflow-hidden rounded-[28px] border [border-color:var(--mk-border-strong)] shadow-2xl shadow-black/50"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--mk-surface) 92%, transparent) 0%, color-mix(in srgb, var(--mk-surface) 96%, transparent) 100%)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b [border-color:var(--mk-border)] px-5 py-4">
              <BrandHeader brand={brandName} label={t.subtitle} />
              <button
                onClick={() => setOpen(false)}
                className="ml-auto shrink-0 flex h-8 w-8 items-center justify-center rounded-full [color:var(--mk-text-muted)] hover:[color:var(--mk-text)] hover:bg-white/[0.04] transition-colors"
                aria-label="Close advisor"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto px-5 py-5 space-y-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="mr-2.5 mt-2 shrink-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg [background:var(--mk-surface-2)] border [border-color:var(--mk-border)]">
                        <Sparkles size={13} className="brand-text" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`max-w-[84%] rounded-[18px] px-4 py-3 text-[13px] leading-[1.65] whitespace-pre-line shadow-sm ${
                      msg.role === "user"
                        ? "brand-bg text-white rounded-br-[6px]"
                        : "[background:var(--mk-surface-2)] border [border-color:var(--mk-border)] [color:var(--mk-text-muted)] rounded-bl-[6px]"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="mr-2.5 mt-2 shrink-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg [background:var(--mk-surface-2)] border [border-color:var(--mk-border)]">
                      <Sparkles size={13} className="brand-text animate-pulse" />
                    </div>
                  </div>
                  <div className="rounded-[18px] rounded-bl-[6px] border [border-color:var(--mk-border)] [background:var(--mk-surface-2)] px-4 py-3 text-[13px] [color:var(--mk-text-muted)] flex items-center gap-2 shadow-sm">
                    <TypingDots />
                    <span className="text-[11px] tracking-wide opacity-60">
                      {lang === "de" ? "qualifiziert" : "qualifying"}
                    </span>
                  </div>
                </motion.div>
              )}

              {agent?.recommendation && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border brand-border brand-soft p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)]/8">
                      <Sparkles size={15} className="brand-text" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold tracking-tight [color:var(--mk-text)]">
                        {agent.recommendation.product} · <span className="brand-text">{agent.recommendation.label}</span>
                      </p>
                      <p className="text-[11px] [color:var(--mk-text-muted)] mt-0.5">{t.score}: <span className="text-emerald-400 font-medium">{agent.leadScore}</span></p>
                    </div>
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={agent.recommendation.href}>
                      <Button size="sm" variant="glow">{agent.recommendation.cta}</Button>
                    </Link>
                    <Link href={agent.recommendation.compareHref}>
                      <Button size="sm" variant="outline">{lang === "de" ? "Vergleich" : "Compare"}</Button>
                    </Link>
                  </div>
                </motion.div>
              )}

              {agent?.capture && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-4 ${
                    agent.capture.saved
                      ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                      : "[border-color:var(--mk-border)] [background:var(--mk-surface-2)]"
                  }`}
                >
                  <p className={agent.capture.saved ? "text-[12px] text-emerald-300 leading-relaxed" : "text-[12px] [color:var(--mk-text-muted)] leading-relaxed"}>
                    {agent.capture.message}
                  </p>
                  {agent.capture.saved && agent.capture.leadId && (
                    <p className="mt-2 text-[10px] font-mono text-emerald-400/60 tracking-wide">lead/{agent.capture.leadId.slice(0, 8)}</p>
                  )}
                </motion.div>
              )}

              {formatFields(fields, lang).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border [border-color:var(--mk-border)] [background:var(--mk-surface-2)] p-4"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider [color:var(--mk-text-subtle)] mb-2.5">{t.fields}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formatFields(fields, lang).map((field) => (
                      <span
                        key={field.label}
                        className="inline-flex items-center rounded-full border [border-color:var(--mk-border)] [background:var(--mk-bg)] px-2.5 py-1 text-[11px] [color:var(--mk-text-muted)]"
                      >
                        <span className="[color:var(--mk-text-subtle)] mr-1">{field.label}:</span>
                        <span className="[color:var(--mk-text)] font-medium">{field.value}</span>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Input area ── */}
            <div className="border-t [border-color:var(--mk-border)] [background:var(--mk-bg)] p-4">
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 ">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    disabled={loading}
                    className="shrink-0 rounded-full border [border-color:var(--mk-border)] [background:var(--mk-surface)] px-3 py-1.5 text-[12px] [color:var(--mk-text-muted)] hover:border-[color:var(--brand-primary)] hover:[color:var(--brand-text)] hover:[background:var(--mk-surface-2)] transition-all disabled:opacity-40"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 rounded-[16px] border [border-color:var(--mk-border)] [background:var(--mk-surface)] px-3.5 py-2.5 transition-all focus-within:border-[color:var(--brand-primary)] focus-within:shadow-[0_0_0_3px_var(--brand-glow)]">
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
                  className="min-h-[24px] max-h-24 flex-1 resize-none bg-transparent text-[13px] leading-relaxed [color:var(--mk-text)] placeholder:[color:var(--mk-text-subtle)] focus:outline-none"
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="rounded-[10px] brand-bg p-2.5 text-white shadow-lg shadow-[var(--brand-glow)] disabled:opacity-40 disabled:shadow-none transition-all hover:brightness-110"
                  aria-label="Send"
                >
                  {loading ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles size={15} />
                    </motion.span>
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[11px] [color:var(--mk-text-subtle)] cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="accent-[var(--brand-primary)] h-3.5 w-3.5 rounded"
                  />
                  <span className="group-hover:[color:var(--mk-text-muted)] transition-colors">{t.consent}</span>
                </label>
                <p className="flex items-center gap-1.5 text-[11px] [color:var(--mk-text-subtle)]">
                  <LockKeyhole size={11} /> {t.privacy}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trigger button ── */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="ml-auto flex items-center gap-3 rounded-full border [border-color:var(--mk-border-strong)] px-5 py-3.5 text-[14px] font-semibold [color:var(--mk-text)] shadow-2xl shadow-black/50 backdrop-blur-xl transition-colors"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--mk-surface) 90%, transparent) 0%, color-mix(in srgb, var(--mk-surface-2) 88%, transparent) 100%)",
        }}
        aria-expanded={open}
        aria-label={activeProfile ? `${activeProfile.brand} Advisor` : t.open}
      >
        <div className="shrink-0">
          {routeIndustry === "legal" ? (
            <SubsumioLogo size={24} subtitle="" />
          ) : (
            <SigmaLogo size={24} wordmarkClassName="text-[14px] font-bold tracking-tight [color:var(--mk-text)]" />
          )}
        </div>
        <span className="hidden sm:inline [color:var(--mk-text-muted)]">
          {activeProfile ? `${activeProfile.brand} Advisor` : t.open}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="[color:var(--mk-text-subtle)]"
        >
          <ChevronDown size={16} strokeWidth={2.5} />
        </motion.span>
      </motion.button>
    </div>
  );
}
