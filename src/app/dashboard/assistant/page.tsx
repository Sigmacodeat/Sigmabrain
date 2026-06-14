"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Bot,
  Upload,
  X,
  FileText,
  Trash2,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ slug: string; title: string }>;
  timestamp: string;
  attachments?: Array<{ name: string; slug: string }>;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<{ name: string; slug: string; content: string }>>([]);
  const [assistantJurisdiction, setAssistantJurisdiction] = useState<"de" | "at" | "ch" | "eu">("de");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-scroll only if user is already near the bottom (within 150px)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() && attachments.length === 0) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
      attachments: attachments.map((a) => ({ name: a.name, slug: a.slug })),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const contextParts: string[] = [];
      if (attachments.length > 0) {
        contextParts.push("--- ANGEHÄNGTE DOKUMENTE ---");
        for (const att of attachments) {
          contextParts.push(`\nDOKUMENT: ${att.name}\n${att.content.slice(0, 8000)}\n`);
        }
        contextParts.push("--- ENDE DOKUMENTE ---\n");
      }

      const jurisdictionLabel = { de: "deutsches", at: "österreichisches", ch: "schweizerisches", eu: "EU-" }[assistantJurisdiction];
      const prompt = `${contextParts.join("\n")}NUTZERFRAGE:\n${input}\n\nDu bist ein intelligenter legaler Assistent für eine Kanzlei im ${jurisdictionLabel.toUpperCase()} Rechtsraum. Beantworte präzise unter Berücksichtigung des ${jurisdictionLabel} Rechts. Zitiere Gesetze mit § und Absatz, und gib am Ende an: "Diese Information ersetzt keine anwaltliche Prüfung."`;

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);

      const result = await api.query.think(prompt, "balanced", (chunk) => {
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last.role !== "assistant") return m;
          return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      });

      setMessages((m) => {
        const last = m[m.length - 1];
        if (last.role !== "assistant") return m;
        return [...m.slice(0, -1), { ...last, content: result.answer, citations: result.citations }];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anfrage fehlgeschlagen.");
    } finally {
      setLoading(false);
      setAttachments([]);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.upload.file(file, { title: file.name, source: "assistant", tags: ["assistant-upload"] });
      // Try to fetch page content for context
      let content = "";
      try {
        const page = await api.brain.getPage(res.slug);
        content = page.content || "";
      } catch {}
      setAttachments((a) => [...a, { name: file.name, slug: res.slug, content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    }
  }

  function clearChat() {
    if (!confirm("Chat-Verlauf löschen?")) return;
    setMessages([]);
    setAttachments([]);
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#1e1e3a] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <Bot size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#e8e8f0]">Legal Assistant</h1>
            <p className="text-xs text-[#8888aa]">KI-gestützter Rechtsassistent mit Dokumenten-Analyse</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={assistantJurisdiction}
            onChange={(e) => setAssistantJurisdiction(e.target.value as "de" | "at" | "ch" | "eu")}
            className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-2 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-violet-500/50"
            title="Rechtsraum auswählen"
          >
            <option value="de">🇩🇪 DE</option>
            <option value="at">🇦🇹 AT</option>
            <option value="ch">🇨🇭 CH</option>
            <option value="eu">🇪🇺 EU</option>
          </select>
          <button onClick={clearChat} className="p-1.5 rounded-lg text-[#8a8aa8] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Chat löschen">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-[#8888aa]">
            <Bot size={48} className="text-[#1e1e3a]" />
            <p className="text-sm">Wie kann ich dir heute helfen?</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg">
              {[
                "Analysiere diesen Vertrag auf Haftungsrisiken.",
                "Welche Fristen laufen in meinen offenen Akten?",
                "Entwirf eine Klageschrift zu § 823 BGB.",
                "Prüfe den Sachverhalt auf Anspruchsgrundlagen.",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-[#0d0d1a] border border-[#1e1e3a] text-[#8a8aa8] hover:border-violet-500/30 hover:text-[#e8e8f0] transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-violet-400" />
              </div>
            )}
            <div className={`max-w-[80%] space-y-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600/15 border border-violet-500/20 text-[#e8e8f0]"
                  : "bg-[#0d0d1a] border border-[#1e1e3a] text-[#c8c8e0]"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ) : (
                  msg.content
                )}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#1e1e3a] space-y-1">
                    {msg.attachments.map((att) => (
                      <div key={att.slug} className="flex items-center gap-1 text-[10px] text-[#8a8aa8]">
                        <FileText size={10} /> {att.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {msg.citations && msg.citations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {msg.citations.map((c) => (
                    <a
                      key={c.slug}
                      href={`/dashboard/brain/${c.slug.split("/").map(encodeURIComponent).join("/")}`}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#12122a] border border-[#1e1e3a] text-violet-400 hover:text-violet-300 hover:border-violet-500/30 transition-all"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c.title}
                      <ExternalLink size={8} />
                    </a>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-[#8a8aa8] flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Clock size={8} />
                  {new Date(msg.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {msg.role === "assistant" && msg.content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      setCopiedId(msg.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="flex items-center gap-1 hover:text-violet-400 transition-colors"
                    title="Antwort kopieren"
                  >
                    {copiedId === msg.id ? <Check size={8} className="text-emerald-400" /> : <Copy size={8} />}
                    {copiedId === msg.id ? "Kopiert" : "Kopieren"}
                  </button>
                )}
              </div>
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-[#12122a] border border-[#1e1e3a] flex items-center justify-center shrink-0">
                <User size={14} className="text-[#8a8aa8]" />
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Loader2 size={14} className="text-violet-400 animate-spin" />
            </div>
            <div className="text-sm text-[#8a8aa8]">Denke nach…</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#1e1e3a] space-y-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div key={att.slug} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300">
                <FileText size={10} /> {att.name}
                <button onClick={() => setAttachments((a) => a.filter((x) => x.slug !== att.slug))} className="text-violet-400 hover:text-red-400"><X size={10} /></button>
              </div>
            ))}
          </div>
        )}
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex items-end gap-2">
          <label className="shrink-0 p-2 rounded-lg bg-[#12122a] border border-[#1e1e3a] text-[#8a8aa8] hover:text-violet-400 hover:border-violet-500/30 cursor-pointer transition-all">
            <Upload size={16} />
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            rows={1}
            placeholder="Frage stellen oder Dokument analysieren…"
            className="flex-1 bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50 resize-none min-h-[40px] max-h-[120px]"
          />
          <Button onClick={sendMessage} disabled={loading || (!input.trim() && attachments.length === 0)} className="bg-violet-600 hover:bg-violet-500 text-white shrink-0 h-10 w-10 p-0">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
