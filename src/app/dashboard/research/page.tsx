"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Loader2,
  Landmark,
  Save,
  Trash2,
  Sparkles,
  Globe,
  Scale,
  Clock,
  ChevronRight,
  X,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import type { BrainPage } from "@/lib/types";
import { OFFLINE_KEYS, enqueueMutation, getCache, isOnline, setCache } from "@/lib/offline-store";

interface ResearchSession {
  id: string;
  query: string;
  answer: string;
  citations: Array<{ slug: string; title: string }>;
  gaps: string[];
  jurisdiction: string;
  createdAt: string;
}

export default function ResearchPage() {
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [jurisdiction, setJurisdiction] = useState("de");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentCitations, setCurrentCitations] = useState<Array<{ slug: string; title: string }>>([]);
  const [currentGaps, setCurrentGaps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedPages, setSavedPages] = useState<BrainPage[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"new" | "saved">("new");
  const [savedSearch, setSavedSearch] = useState("");
  const [savedJurisdiction, setSavedJurisdiction] = useState<"all" | "at" | "de" | "ch" | "eu">("all");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => { loadSavedResearch(); }, []);

  async function loadSavedResearch() {
    setSavedLoading(true);
    try {
      const pages = await api.brain.listPages({ type: "legal_research", limit: 50 });
      setSavedPages(pages);
      await setCache(OFFLINE_KEYS.research, pages);
    } catch {
      const cached = await getCache<BrainPage[]>(OFFLINE_KEYS.research);
      if (cached) {
        setSavedPages(cached);
        setError("Cloud-Brain gerade nicht erreichbar. Es werden zwischengespeicherte Recherchen angezeigt.");
      }
    } finally { setSavedLoading(false); }
  }

  async function runResearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setCurrentAnswer("");
    setCurrentCitations([]);
    setCurrentGaps([]);

    try {
      const prompt = `Recherchiere präzise zur folgenden Rechtsfrage unter Berücksichtigung des ${jurisdiction.toUpperCase()}-Rechts (Gesetze, Rechtsprechung, Literatur). Zitiere immer mit §, Absatz und Gesetzesabkürzung. Gib am Ende an: "Diese Information ersetzt keine anwaltliche Prüfung."\n\nRECHTSFRAGE: ${query}`;
      const result = await api.query.think(prompt, "balanced", (chunk) => {
        setCurrentAnswer((prev) => prev + chunk);
      });
      setCurrentAnswer(result.answer);
      setCurrentCitations(result.citations || []);
      setCurrentGaps(result.gaps || []);

      const session: ResearchSession = {
        id: crypto.randomUUID(),
        query,
        answer: result.answer,
        citations: result.citations || [],
        gaps: result.gaps || [],
        jurisdiction,
        createdAt: new Date().toISOString(),
      };
      setSessions((s) => [session, ...s]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function saveResearch() {
    if (!currentAnswer) return;
    try {
      const slug = `legal/research/${query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now()}`;
      const payload = {
        slug,
        title: `Recherche: ${query.slice(0, 80)}`,
        type: "legal_research",
        content: currentAnswer,
        frontmatter: {
          jurisdiction,
          query,
          citations: currentCitations.map((c) => c.title),
          gaps: currentGaps,
          research_date: new Date().toISOString(),
        },
      };
      if (isOnline()) {
        await api.brain.createPage(payload);
      } else {
        await enqueueMutation({ type: "createPage", payload });
      }
      const page = {
        ...payload,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BrainPage;
      const nextPages = [page, ...savedPages];
      setSavedPages(nextPages);
      await setCache(OFFLINE_KEYS.research, nextPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function syncJudgements() {
    setLoading(true); setError(null);
    try {
      await api.legal.judgementsSync({ jurisdiction: jurisdiction as "at" | "de" | "all", query });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync fehlgeschlagen.");
    } finally { setLoading(false); }
  }

  async function deleteResearch(slug: string) {
    if (!confirm("Recherche löschen?")) return;
    try {
      if (isOnline()) {
        await api.brain.deletePage(slug);
      } else {
        await enqueueMutation({ type: "deletePage", payload: { slug } });
      }
      const nextPages = savedPages.filter((page) => page.slug !== slug);
      setSavedPages(nextPages);
      await setCache(OFFLINE_KEYS.research, nextPages);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen."); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <Globe size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#15151d]">Legal Research</h1>
            <p className="text-sm text-[#585866]">KI-gestützte Rechtsrecherche mit Zitation und Quellenangabe</p>
          </div>
        </div>
      </div>

      {/* Research Input */}
      <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50">
            <option value="de">🇩🇪 Deutschland</option>
            <option value="at">🇦🇹 Österreich</option>
            <option value="ch">🇨🇭 Schweiz</option>
            <option value="eu">🇪🇺 EU-Recht</option>
          </select>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#585866]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runResearch()}
              placeholder="Rechtsfrage eingeben… (z.B. 'Wann ist eine AGB-Klausel nach § 307 BGB unwirksam?')"
              className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg pl-9 pr-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <Button onClick={runResearch} disabled={loading || !query.trim()} className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "Recherchiert…" : "Recherchieren"}
          </Button>
          <Button variant="secondary" onClick={syncJudgements} disabled={loading} className="bg-[#eceef3] border border-[#e2e4ec] text-[#15151d] hover:bg-[#1a1a3a] gap-2">
            <Landmark size={14} /> Urteile-Sync
          </Button>
        </div>
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>

      {/* Current Result */}
      {currentAnswer && (
        <div className="rounded-xl border border-violet-500/20 bg-[#ffffff] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-[#15151d]">Ergebnis</h3>
              <Badge variant="default" className="text-[10px] border border-violet-500/20 bg-violet-500/10 text-violet-700">{jurisdiction.toUpperCase()}</Badge>
            </div>
            <Button onClick={saveResearch} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-xs">
              <Save size={14} /> Als Brain-Page speichern
            </Button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-[#c8c8e0] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(currentAnswer) }}
          />
          {currentCitations.length > 0 && (
            <div className="pt-3 border-t border-[#e2e4ec]">
              <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider mb-2">Zitierte Quellen</h4>
              <div className="flex flex-wrap gap-2">
                {currentCitations.map((c) => (
                  <span key={c.slug} className="text-[10px] px-2 py-1 rounded-lg bg-[#eceef3] border border-[#e2e4ec] text-violet-600">
                    {c.title}
                  </span>
                ))}
              </div>
            </div>
          )}
          {currentGaps.length > 0 && (
            <div className="pt-3 border-t border-[#e2e4ec]">
              <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider mb-2">Erkannte Lücken</h4>
              <ul className="space-y-1">
                {currentGaps.map((gap, i) => (
                  <li key={i} className="text-xs text-amber-600 flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span> {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#e2e4ec]">
        <button
          onClick={() => setActiveTab("new")}
          className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
            activeTab === "new"
              ? "border-violet-500 text-violet-600"
              : "border-transparent text-[#585866] hover:text-[#15151d]"
          }`}
        >
          <span className="flex items-center gap-1.5"><Sparkles size={14} /> Neue Recherche</span>
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
            activeTab === "saved"
              ? "border-violet-500 text-violet-600"
              : "border-transparent text-[#585866] hover:text-[#15151d]"
          }`}
        >
          <span className="flex items-center gap-1.5"><FolderOpen size={14} /> Gespeicherte Recherchen {savedPages.length > 0 && <span className="text-[10px] bg-[#e2e4ec] px-1.5 py-0.5 rounded">{savedPages.length}</span>}</span>
        </button>
      </div>

      {activeTab === "new" && (
        <>
          {/* Current Result */}
          {currentAnswer && (
            <div className="rounded-xl border border-violet-500/20 bg-[#ffffff] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-violet-600" />
                  <h3 className="text-sm font-semibold text-[#15151d]">Ergebnis</h3>
                  <Badge variant="default" className="text-[10px] border border-violet-500/20 bg-violet-500/10 text-violet-700">{jurisdiction.toUpperCase()}</Badge>
                </div>
                <Button onClick={saveResearch} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-xs">
                  <Save size={14} /> Als Brain-Page speichern
                </Button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-[#c8c8e0] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(currentAnswer) }}
              />
              {currentCitations.length > 0 && (
                <div className="pt-3 border-t border-[#e2e4ec]">
                  <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider mb-2">Zitierte Quellen</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentCitations.map((c) => (
                      <a
                        key={c.slug}
                        href={`/dashboard/brain/${c.slug.split("/").map(encodeURIComponent).join("/")}`}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-[#eceef3] border border-[#e2e4ec] text-violet-600 hover:text-violet-700 hover:border-violet-500/30 transition-all"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {c.title}
                        <ExternalLink size={8} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {currentGaps.length > 0 && (
                <div className="pt-3 border-t border-[#e2e4ec]">
                  <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider mb-2">Erkannte Lücken</h4>
                  <ul className="space-y-1">
                    {currentGaps.map((gap, i) => (
                      <li key={i} className="text-xs text-amber-600 flex items-start gap-2">
                        <span className="mt-0.5">⚠️</span> {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Recent Sessions */}
          {sessions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#15151d] flex items-center gap-2">
                <Clock size={16} className="text-violet-600" />
                Sitzungs-Verlauf
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sessions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#15151d] truncate">{s.query}</span>
                      <Badge variant="default" className="text-[10px] border border-violet-500/20 bg-violet-500/10 text-violet-700">{s.jurisdiction.toUpperCase()}</Badge>
                    </div>
                    <div className="text-xs text-[#585866] line-clamp-2">{s.answer.slice(0, 150)}…</div>
                    <div className="flex items-center justify-between text-[10px] text-[#585866]">
                      <span>{new Date(s.createdAt).toLocaleString("de-DE")}</span>
                      {s.citations.length > 0 && <span>{s.citations.length} Quellen</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "saved" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#585866]" />
              <input
                value={savedSearch}
                onChange={(e) => setSavedSearch(e.target.value)}
                placeholder="Gespeicherte Recherchen durchsuchen…"
                className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg pl-9 pr-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "at", "de", "ch", "eu"] as const).map((j) => (
                <button
                  key={j}
                  onClick={() => setSavedJurisdiction(j)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                    savedJurisdiction === j
                      ? "bg-violet-600/15 border-violet-500/30 text-violet-600"
                      : "bg-[#ffffff] border-[#e2e4ec] text-[#585866] hover:border-[#b4b9c8]"
                  }`}
                >
                  {j === "all" ? "Alle" : j === "at" ? "🇦🇹 AT" : j === "de" ? "🇩🇪 DE" : j === "ch" ? "🇨🇭 CH" : "🇪🇺 EU"}
                </button>
              ))}
            </div>
          </div>

          {savedLoading ? (
            <div className="text-center py-8 text-[#585866]">Lade…</div>
          ) : savedPages.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <FolderOpen size={40} className="mx-auto text-[#e2e4ec]" />
              <p className="text-sm text-[#585866]">Noch keine Recherchen gespeichert.</p>
              <p className="text-xs text-[#585866]">Starte eine neue Recherche und speichere das Ergebnis.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                let filtered = savedPages;
                if (savedJurisdiction !== "all") {
                  filtered = filtered.filter((p) => (p.frontmatter?.jurisdiction as string) === savedJurisdiction);
                }
                if (savedSearch.trim()) {
                  const q = savedSearch.toLowerCase();
                  filtered = filtered.filter((p) =>
                    p.title.toLowerCase().includes(q) ||
                    ((p.frontmatter?.query as string) || "").toLowerCase().includes(q) ||
                    (p.content || "").toLowerCase().includes(q)
                  );
                }
                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-[#585866] text-sm">Keine Recherchen passen zu den Filtern.</div>
                  );
                }
                return filtered.map((page) => {
                  const fm = page.frontmatter ?? {};
                  const j = (fm.jurisdiction as string) || "";
                  const q = (fm.query as string) || "";
                  const isExpanded = expandedSlug === page.slug;
                  return (
                    <div key={page.slug} className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#15151d] truncate">{page.title}</span>
                            {j && (
                              <Badge variant="default" className={`text-[10px] border ${
                                j === "at" ? "bg-red-500/10 border-red-500/20 text-red-600" :
                                j === "ch" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                                j === "eu" ? "bg-amber-500/10 border-amber-500/20 text-amber-600" :
                                "bg-blue-500/10 border-blue-500/20 text-blue-600"
                              }`}>{j.toUpperCase()}</Badge>
                            )}
                          </div>
                          {q && <p className="text-xs text-[#585866] mt-1 truncate">{q}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setExpandedSlug(isExpanded ? null : page.slug)}
                            className="p-1.5 rounded-lg text-[#585866] hover:text-violet-600 hover:bg-violet-500/10 transition-all"
                            title={isExpanded ? "Zuklappen" : "Aufklappen"}
                          >
                            {isExpanded ? <X size={13} /> : <ChevronRight size={13} />}
                          </button>
                          <button onClick={() => deleteResearch(page.slug)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#585866] hover:text-red-600 hover:bg-red-500/10 transition-all" title="Löschen">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="prose prose-invert prose-sm max-w-none text-[#c8c8e0] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content || "") }}
                        />
                      ) : (
                        <div className="text-xs text-[#585866] line-clamp-2">{page.content?.slice(0, 200)}…</div>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-[#585866]">
                        <span className="flex items-center gap-1"><Clock size={9} />{new Date((page as unknown as Record<string, unknown>).createdAt as string || (page as unknown as Record<string, unknown>).created_at as string || page.created_at || new Date().toISOString()).toLocaleDateString("de-DE")}</span>
                        <div className="flex items-center gap-2">
                          {Array.isArray(fm.citations) && fm.citations.length > 0 && <span>{fm.citations.length} Quellen</span>}
                          {Array.isArray(fm.gaps) && fm.gaps.length > 0 && <span className="text-amber-600">{fm.gaps.length} Lücken</span>}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
