"use client";

import { useState } from "react";
import {
  Landmark,
  Search,
  Loader2,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { frontmatterOf, type DecisionFrontmatter } from "@/lib/legal-types";

interface JudgementResult {
  id: string;
  title: string;
  court: string;
  date: string;
  ecli?: string;
  az?: string;
  legalArea: string;
  keywords: string[];
  summary: string;
  url: string;
  source: string;
}

export default function RechtsprechungPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<JudgementResult[]>([]);
  const [jurisdiction, setJurisdiction] = useState<"at" | "de" | "all">("at");
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    setResults([]);

    try {
      const judgements: JudgementResult[] = [];

      // 1. Search brain for existing court decisions
      const brainResults = await api.brain.search(query, 20);
      for (const page of brainResults) {
        const fm = frontmatterOf<DecisionFrontmatter>(page);
        if (fm.type === "court_decision" || (page as { type?: string }).type === "court_decision") {
          judgements.push({
            id: page.slug,
            title: page.title,
            court: fm.court || "Unbekannt",
            date: fm.date || page.created_at || "",
            ecli: fm.ecli || undefined,
            az: fm.case_number || undefined,
            legalArea: fm.legal_area || "Allgemein",
            keywords: fm.keywords || [],
            summary: page.snippet || "",
            url: fm.source_url || "#",
            source: "brain",
          });
        }
      }

      // 2. Live-Suche: RIS-OGD (AT) + openlegaldata (DE) je nach Jurisdiktion
      try {
        const liveRes = await fetch(
          `/api/legal/judgements-search?q=${encodeURIComponent(query)}&jurisdiction=${jurisdiction}&limit=20`,
        );
        if (liveRes.ok) {
          const liveData = (await liveRes.json()) as { results?: Array<Record<string, string>> };
          for (const r of liveData.results ?? []) {
            judgements.push({
              id: `${r.source || "live"}-${r.ecli || r.caseNumber || Math.random().toString(36)}`,
              title: r.title || "Urteil",
              court: r.court || "Unbekannt",
              date: r.date || "",
              ecli: r.ecli || undefined,
              az: r.caseNumber || undefined,
              legalArea: "Allgemein",
              keywords: [],
              summary: r.snippet || "",
              url: r.url || "#",
              source: r.source || "live",
            });
          }
        }
      } catch {
        // Externe Quellen können offline sein — Brain-Treffer + AI-Fallback bleiben
      }

      // 3. AI fallback if no results at all
      if (judgements.length === 0) {
        const thinkResult = await api.query.think(
          `Suche nach Rechtsprechung zu "${query}" in ${jurisdiction === "at" ? "Österreich" : jurisdiction === "de" ? "Deutschland" : "Deutschland und Österreich"}. Liste relevante Urteile mit Gericht, Datum, Aktenzeichen und Leitsatz.`
        );
        const lines = thinkResult.answer.split("\n").filter((l) => l.trim());
        let current: Partial<JudgementResult> = {};
        for (const line of lines) {
          if (line.startsWith("##") || line.match(/^\d+\.\s/)) {
            if (current.title) {
              judgements.push({
                id: String(judgements.length),
                title: current.title || line.replace(/^\d+\.\s*/, "").replace(/^##\s*/, ""),
                court: current.court || "Unbekannt",
                date: current.date || new Date().toISOString(),
                ecli: current.ecli,
                az: current.az,
                legalArea: current.legalArea || "Allgemein",
                keywords: [],
                summary: current.summary || "",
                url: current.url || "#",
                source: "ai",
              });
            }
            current = { title: line.replace(/^\d+\.\s*/, "").replace(/^##\s*/, "") };
          } else if (line.toLowerCase().includes("gericht") || line.toLowerCase().includes("court")) {
            current.court = line.split(":")[1]?.trim() || line;
          } else if (line.toLowerCase().includes("datum") || line.toLowerCase().includes("date")) {
            current.date = line.split(":")[1]?.trim() || line;
          } else if (line.toLowerCase().includes("aktenzeichen") || line.toLowerCase().includes("az")) {
            current.az = line.split(":")[1]?.trim() || line;
          } else if (line.toLowerCase().includes("ecli")) {
            current.ecli = line.split(":")[1]?.trim() || line;
          } else {
            current.summary = (current.summary || "") + " " + line;
          }
        }
        if (current.title) {
          judgements.push({
            id: String(judgements.length),
            title: current.title,
            court: current.court || "Unbekannt",
            date: current.date || new Date().toISOString(),
            ecli: current.ecli,
            az: current.az,
            legalArea: current.legalArea || "Allgemein",
            keywords: [],
            summary: current.summary || "",
            url: current.url || "#",
            source: "ai",
          });
        }
      }

      setResults(judgements);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
          <Landmark size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#15151d]">Rechtsprechung</h1>
          <p className="text-sm text-[#585866]">Urteile und Entscheidungen durchsuchen</p>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-4">
        <div className="flex gap-2">
          {(["at", "de", "all"] as const).map((j) => (
            <button
              key={j}
              onClick={() => setJurisdiction(j)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                jurisdiction === j
                  ? "bg-violet-600/10 border-violet-500/30 text-violet-600"
                  : "bg-[#ffffff] border-[#e2e4ec] text-[#585866] hover:text-[#585866]"
              )}
            >
              {j === "at" ? "🇦🇹 Österreich" : j === "de" ? "🇩🇪 Deutschland" : "🌍 Beide"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#585866]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Urteil suchen… z.B. Haftung, Vertragsbruch, Datenschutz"
              aria-label="Urteil suchen… z.B. Haftung, Vertragsbruch, Datenschutz"
              className="pl-9 bg-[#ffffff] border-[#e2e4ec] text-[#15151d] placeholder:text-[#585866] focus:border-violet-500/50"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            variant="primary"
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Suchen
          </Button>
        </div>
      </div>

      {/* Results */}
      {searched && results.length === 0 && !searching && (
        <div className="text-center py-20 space-y-4">
          <Landmark size={48} className="mx-auto text-[#e2e4ec]" />
          <div>
            <p className="text-[#585866]">Keine Urteile im Brain gefunden.</p>
            <p className="text-[#585866] text-sm mt-1">
              Nutze den <code className="font-mono text-xs bg-[#eceef3] px-1.5 py-0.5 rounded">legal-judgements</code> Konnektor um Rechtsprechung zu importieren.
            </p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#585866]">{results.length} Ergebnisse</p>
          </div>
          {results.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 hover:border-violet-500/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#15151d]">{r.title}</span>
                    <Badge variant="default" className={cn(
                      "text-[10px] border",
                      r.source === "brain" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" :
                      r.source === "ris-ogd" ? "bg-blue-500/5 border-blue-500/20 text-blue-600" :
                      "bg-[#eceef3] border-[#e2e4ec] text-[#585866]"
                    )}>
                      {r.source === "brain" ? "Brain" : r.source === "ris-ogd" ? "RIS-OGD" : "KI"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#585866] mb-2">
                    <span className="flex items-center gap-1"><Landmark size={10} />{r.court}</span>
                    <span className="flex items-center gap-1"><Calendar size={10} />{new Date(r.date).toLocaleDateString("de-DE")}</span>
                    {r.az && <span className="font-mono">{r.az}</span>}
                    {r.ecli && <span className="font-mono text-[10px]">{r.ecli}</span>}
                  </div>
                  <p className="text-sm text-[#585866] line-clamp-3">{r.summary}</p>
                  {r.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.keywords.map((k) => (
                        <Badge key={k} variant="default" className="text-[10px] bg-violet-600/5 border-violet-500/10 text-violet-600">
                          {k}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {r.url !== "#" && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 w-8 h-8 rounded-lg bg-[#eceef3] border border-[#e2e4ec] flex items-center justify-center text-[#585866] hover:text-violet-600 hover:border-violet-500/30 transition-all"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
