"use client";

import { useState, useRef, useEffect } from "react";
import {
  Brain,
  Send,
  Trash2,
  Settings2,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { slug: string; title: string; quote: string }[];
  gaps?: string[];
  isStreaming?: boolean;
  createdAt: Date;
}

// Default examples + vertical-tuned sets. The signup industry (User.industry)
// picks the set — the same account drives web, PWA and the future store apps,
// so personalization follows the user to every device automatically.
const EXAMPLE_QUERIES = [
  "Was muss ich vor dem nächsten Meeting wissen?",
  "Welche offenen Punkte gibt es mit Kunde X?",
  "Zeige mir alle Entscheidungen aus dem letzten Quartal",
  "Wer arbeitet an Projekt Y und was ist der Status?",
  "Was sind die wichtigsten Risiken in meinem Brain?",
];

const INDUSTRY_QUERIES: Record<string, string[]> = {
  legal: [
    "Wo widersprechen sich die Aussagen der Gegenseite in dieser Akte?",
    "Welche Fristen stehen in den zuletzt hochgeladenen Schriftsätzen?",
    "Was wissen wir über den Sachverhalt im Mandat X — mit Fundstellen?",
    "Welche Zusagen haben wir dem Mandanten zuletzt gemacht?",
    "Was fehlt in dieser Akte noch für die Klageerwiderung?",
  ],
  tax: [
    "Welche Mandanten betrifft die E-Rechnungs-Pflicht — und was haben wir kommuniziert?",
    "Warum haben wir die Holding-Struktur von Mandant X 2022 so aufgesetzt?",
    "Welche offenen Punkte gibt es vor dem Jahresgespräch mit Mandant Y?",
    "Welche Fristen stehen in den zuletzt abgelegten Bescheiden?",
    "Welche Besonderheiten gelten bei Mandant Z laut unseren Notizen?",
  ],
  vc: [
    "Was ist mit den Foundern dieser Woche noch offen?",
    "Bei welchen Deals haben wir gepasst, die danach geraised haben?",
    "Wer hat uns Founder X vorgestellt — und was versprachen wir?",
    "Welche LPs haben nach Climate-Deals gefragt?",
    "Was muss ich vor dem Partner-Meeting morgen wissen?",
  ],
  consulting: [
    "Haben wir so ein Projekt schon mal gemacht? Was haben wir gelernt?",
    "Welche wiederverwendbaren Assets gibt es zu Pricing-Studien?",
    "Was lief im letzten Projekt mit Kunde X — inklusive Post-Mortem?",
    "Welche Pitches haben wir zu diesem Thema schon geschrieben?",
    "Was muss ein neuer Kollege über Kunde Y wissen?",
  ],
  recruiting: [
    "Wer in unserem Netzwerk passt auf ein CFO-Mandat im Fintech?",
    "Welche Kandidaten sagten uns, dass sie wechselbereit sind?",
    "Wer kann uns bei Kandidatin X vorstellen?",
    "Welche Platzierungen haben wir in dieser Branche gemacht?",
    "Welche Gehaltsvorstellungen wurden zuletzt besprochen?",
  ],
  insurance: [
    "Welche Renewals stehen in den nächsten 60 Tagen an?",
    "Was wissen wir über die Schadenhistorie von Kunde X?",
    "Welche Carrier-Konditionen haben wir zuletzt verhandelt?",
    "Welche Zusagen haben wir Kunde Y im letzten Gespräch gemacht?",
    "Was fehlt in der Akte für das nächste Kundengespräch?",
  ],
  medical: [
    "Was steht in den letzten Notizen zu diesem Behandlungsfall?",
    "Welche Wiedervorlagen sind diese Woche fällig?",
    "Welche Besonderheiten sind bei Patient X dokumentiert?",
    "Was wurde im letzten Teammeeting entschieden?",
    "Welche offenen Punkte gibt es mit dem Labor?",
  ],
};

const MODE_LABELS = {
  conservative: { label: "Präzise", desc: "Weniger Tokens, höhere Präzision" },
  balanced: { label: "Balanced", desc: "Optimal für die meisten Queries" },
  tokenmax: { label: "Deep", desc: "Mehr Kontext, mehr Vollständigkeit" },
};

function CitationPill({ slug, title }: { slug: string; title: string }) {
  return (
    <a
      href={`/dashboard/brain/${encodeURIComponent(slug)}`}
      title={title}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-violet-500/20 bg-violet-500/10 text-xs text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all font-mono"
    >
      <FileText size={10} />
      {slug}
    </a>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-3 group">
      <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0 mt-0.5 relative">
        <Brain size={14} className="text-white" />
        {msg.isStreaming && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#06060f] animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-violet-400">Sigmabrain</span>
          {msg.isStreaming && <span className="text-xs text-[#4a4a6a]">antwortet…</span>}
        </div>

        <div className="text-sm text-[#e8e8f0] leading-relaxed whitespace-pre-wrap bg-[#0d0d1a] border border-[#1e1e3a] rounded-xl p-4">
          {msg.content}
          {msg.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>

        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#4a4a6a]">Quellen:</span>
            {msg.citations.map((c) => (
              <CitationPill key={c.slug} slug={c.slug} title={c.title} />
            ))}
          </div>
        )}

        {/* Gaps */}
        {msg.gaps && msg.gaps.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle size={13} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400">Lücken im Brain</span>
            </div>
            <ul className="space-y-1">
              {msg.gaps.map((gap, i) => (
                <li key={i} className="text-xs text-[#8888aa]">• {gap}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {!msg.isStreaming && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-1 text-xs text-[#4a4a6a] hover:text-[#8888aa] transition-colors"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QueryPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [examples, setExamples] = useState<string[]>(EXAMPLE_QUERIES);

  useEffect(() => {
    // Industry-tuned example prompts; deferred fetch keeps the effect body
    // free of synchronous setState (lint rule) and the default list shows
    // instantly either way.
    const timer = setTimeout(() => {
      fetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const industry: string | undefined = data?.user?.industry;
          if (industry && INDUSTRY_QUERIES[industry]) setExamples(INDUSTRY_QUERIES[industry]);
        })
        .catch(() => null);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const [queryMode, setQueryMode] = useState<"conservative" | "balanced" | "tokenmax">("balanced");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/think", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg.content, mode: queryMode }),
      });

      if (!res.ok || !res.body) {
        throw new Error("API nicht verfügbar — stelle sicher, dass die Sigmabrain Engine läuft.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                fullContent += parsed.chunk;
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m)
                );
              }
              if (parsed.citations || parsed.gaps) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, citations: parsed.citations, gaps: parsed.gaps }
                      : m
                  )
                );
              }
            } catch {}
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m)
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unbekannter Fehler";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `❌ Fehler: ${errMsg}\n\nStarte die Sigmabrain Engine mit: \`gbrain init && gbrain serve\``,
                isStreaming: false,
                gaps: ["Sigmabrain Engine nicht erreichbar (localhost:3001)"],
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e3a] shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#e8e8f0]">Brain Query</h1>
          <p className="text-xs text-[#4a4a6a] mt-0.5">KI-Synthese mit Wissensgraph</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode selector */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1e1e3a] bg-[#0d0d1a] text-xs text-[#8888aa] hover:border-[#3a3a6a] hover:text-[#e8e8f0] transition-all"
            >
              <Settings2 size={12} />
              {MODE_LABELS[queryMode].label}
              <ChevronDown size={11} />
            </button>
            {showModeMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-[#0d0d1a] border border-[#1e1e3a] rounded-xl shadow-xl z-50 overflow-hidden">
                {(Object.entries(MODE_LABELS) as [typeof queryMode, typeof MODE_LABELS[typeof queryMode]][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => { setQueryMode(key); setShowModeMenu(false); }}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#12122a] transition-colors",
                      queryMode === key && "bg-violet-500/10"
                    )}
                  >
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", queryMode === key ? "text-violet-400" : "text-[#e8e8f0]")}>
                        {val.label}
                      </p>
                      <p className="text-xs text-[#4a4a6a] mt-0.5">{val.desc}</p>
                    </div>
                    {queryMode === key && <Check size={14} className="text-violet-400 shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessages([])}
              title="Chat leeren"
            >
              <Trash2 size={14} className="text-[#4a4a6a]" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center mb-6">
              <Brain size={28} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-[#e8e8f0] mb-2">Was möchtest du wissen?</h2>
            <p className="text-sm text-[#8888aa] mb-8 leading-relaxed">
              Stelle natürlichsprachliche Fragen. Sigmabrain synthesiert Antworten aus deinem Brain mit Quellen-Zitaten und zeigt dir, was es noch nicht weiß.
            </p>

            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={13} className="text-amber-400" />
                <span className="text-xs text-[#4a4a6a] font-medium uppercase tracking-wider">Beispiel-Queries</span>
              </div>
              {examples.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] text-sm text-[#8888aa] hover:border-[#3a3a6a] hover:text-[#e8e8f0] hover:bg-[#12122a] transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex items-start gap-3 justify-end">
                  <div className="max-w-[80%] px-4 py-3 rounded-xl bg-violet-600/15 border border-violet-500/20 text-sm text-[#e8e8f0]">
                    {msg.content}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#1e1e3a] flex items-center justify-center shrink-0 mt-0.5 text-xs text-[#8888aa] font-semibold">
                    Du
                  </div>
                </div>
              ) : (
                <AssistantMessage msg={msg} />
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 pb-6 pt-3 border-t border-[#1e1e3a]">
        <div className="relative flex items-end gap-3 bg-[#0d0d1a] border border-[#1e1e3a] rounded-2xl p-3 focus-within:border-violet-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage dein Brain…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#e8e8f0] placeholder:text-[#4a4a6a] resize-none focus:outline-none leading-relaxed min-h-[24px] max-h-36"
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 144) + "px";
            }}
          />
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 text-xs text-[#4a4a6a]">
              <Badge variant="default" className="text-xs">
                {MODE_LABELS[queryMode].label}
              </Badge>
            </div>
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              variant="glow"
              size="icon"
              className="shrink-0"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-[#4a4a6a] mt-2 text-center">
          Enter zum Senden · Shift+Enter für Zeilenumbruch
        </p>
      </div>
    </div>
  );
}
