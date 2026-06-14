"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BookOpen,
  Users,
  Building2,
  Lightbulb,
  FileText,
  Calendar,
  MapPin,
  Filter,
  SortAsc,
  ChevronRight,
  Clock,
  Hash,
  Loader2,
  Briefcase,
  CalendarClock,
  Scale,
  Landmark,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { BrainPage, Entity, SearchResult } from "@/lib/types";

type FilterType = "all" | Entity["type"] | "document" | "legal_case" | "legal_actor" | "legal_deadline" | "court" | "statute" | "norm";
type PageItem = BrainPage & { type: string; words: number; updated: string };

const TYPE_FILTERS: { key: FilterType; label: string; icon: React.ElementType; color: string }[] = [
  { key: "all", label: "Alle", icon: BookOpen, color: "default" },
  { key: "person", label: "Personen", icon: Users, color: "person" },
  { key: "company", label: "Unternehmen", icon: Building2, color: "company" },
  { key: "idea", label: "Ideen", icon: Lightbulb, color: "idea" },
  { key: "document", label: "Dokumente", icon: FileText, color: "document" },
  { key: "event", label: "Events", icon: Calendar, color: "event" },
  { key: "place", label: "Orte", icon: MapPin, color: "place" },
  { key: "legal_case", label: "Akten", icon: Briefcase, color: "accent" },
  { key: "legal_actor", label: "Entitäten", icon: Scale, color: "accent" },
  { key: "legal_deadline", label: "Fristen", icon: CalendarClock, color: "accent" },
  { key: "court", label: "Gerichte", icon: Landmark, color: "accent" },
  { key: "statute", label: "Gesetze", icon: BookOpen, color: "accent" },
  { key: "norm", label: "Normen", icon: BookOpen, color: "accent" },
];

export default function BrainPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<"updated" | "title" | "words">("updated");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [stats, setStats] = useState({ pages: 0, entities: 0, edges: 0 });
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, brainStats] = await Promise.all([
          api.brain.listPages({ limit: 200 }),
          api.brain.stats(),
        ]);
        if (cancelled) return;
        const items: PageItem[] = list.map((p) => ({
          ...p,
          type: (p as PageItem).type ?? "document",
          words: p.word_count ?? 0,
          updated: p.updated_at ? p.updated_at.slice(0, 10) : "",
        }));
        setPages(items);
        setStats({
          pages: brainStats.total_pages,
          entities: brainStats.total_entities,
          edges: brainStats.total_edges,
        });
      } catch (err) {
        console.error("[brain] failed to load pages:", err instanceof Error ? err.message : String(err));
        if (!cancelled) setPages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // All state writes live inside the (deferred) timer callback so the
    // effect body itself never calls setState synchronously.
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      if (!trimmed) {
        setSearchResults(null);
        return;
      }
      setSearching(true);
      try {
        const results = await api.brain.search(trimmed, 20);
        setSearchResults(results);
      } catch (err) {
        console.error("[brain] search failed:", err instanceof Error ? err.message : String(err));
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, trimmed ? 350 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  const displayed = useMemo(() => {
    if (searchResults !== null) {
      return searchResults.map((r) => ({
        slug: r.slug,
        title: r.title,
        type: "document" as const,
        tags: [] as string[],
        words: 0,
        updated: r.created_at?.slice(0, 10) ?? "",
        snippet: r.snippet,
      }));
    }
    let list = [...pages];
    if (filter !== "all") {
      list = list.filter((p) => p.type === filter);
    }
    list.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "words") return b.words - a.words;
      return b.updated.localeCompare(a.updated);
    });
    return list;
  }, [pages, filter, sort, searchResults]);

  const isEmpty = !loading && pages.length === 0 && !query;

  const typeColorMap: Record<string, string> = {
    person: "person",
    company: "company",
    idea: "idea",
    document: "document",
    event: "event",
    place: "place",
  };

  const typeIconMap: Record<string, React.ElementType> = {
    person: Users,
    company: Building2,
    idea: Lightbulb,
    document: FileText,
    event: Calendar,
    place: MapPin,
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-52 shrink-0 border-r border-[#1e1e3a] bg-[#0a0a18] p-4 space-y-1 overflow-y-auto">
        <p className="text-xs text-[#8a8aa8] uppercase tracking-wider font-medium mb-3">Typ</p>
        {TYPE_FILTERS.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                filter === f.key
                  ? "bg-violet-600/15 text-violet-400 border border-violet-500/20"
                  : "text-[#8888aa] hover:text-[#e8e8f0] hover:bg-[#12122a]"
              )}
            >
              <Icon size={14} className="shrink-0" />
              {f.label}
            </button>
          );
        })}

        <div className="pt-4 pb-2">
          <p className="text-xs text-[#8a8aa8] uppercase tracking-wider font-medium mb-3">Sortierung</p>
          {[
            { key: "updated" as const, label: "Aktualisiert" },
            { key: "title" as const, label: "Titel A–Z" },
            { key: "words" as const, label: "Wortanzahl" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                sort === s.key
                  ? "bg-violet-600/15 text-violet-400 border border-violet-500/20"
                  : "text-[#8888aa] hover:text-[#e8e8f0] hover:bg-[#12122a]"
              )}
            >
              <SortAsc size={14} className="shrink-0" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#06060f] border-b border-[#1e1e3a] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                icon={<Search size={15} />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Brain durchsuchen… (Hybrid: Vector + BM25 + Graph)"
              />
            </div>
            <Button variant="secondary" size="md" className="shrink-0" disabled title="Nutze die Typfilter links.">
              <Filter size={14} />
              Filter
            </Button>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center gap-4 mb-6 text-sm text-[#8a8aa8]">
            <span>
              <strong className="text-[#e8e8f0]">{stats.pages}</strong> Seiten
            </span>
            <span>·</span>
            <span>
              <strong className="text-[#e8e8f0]">{stats.entities}</strong> Entitäten
            </span>
            <span>·</span>
            <span>
              <strong className="text-[#e8e8f0]">{stats.edges}</strong> Kanten
            </span>
            {searching && (
              <>
                <span>·</span>
                <Loader2 size={14} className="animate-spin text-violet-400" />
              </>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={28} className="animate-spin text-[#8a8aa8]" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen size={40} className="text-[#1e1e3a] mb-4" />
              <h3 className="text-lg font-semibold text-[#e8e8f0] mb-2">Brain ist leer</h3>
              <p className="text-sm text-[#8a8aa8] mb-6 max-w-sm">
                Lade Dokumente hoch oder verbinde Sigmabrain mit einem bestehenden Brain-Repo.
              </p>
              <div className="flex gap-3">
                <Button variant="glow" size="md" onClick={() => router.push("/dashboard/upload")}>
                  Dokument hochladen
                </Button>
                <Button variant="secondary" size="md" onClick={() => router.push("/dashboard/settings")}>
                  Setup öffnen
                </Button>
              </div>
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 text-[#8a8aa8] text-sm">Keine Treffer für „{query}“</div>
          ) : (
            <div className="space-y-2">
              {displayed.map((page) => {
                const TypeIcon = typeIconMap[page.type] || FileText;
                const tags = "tags" in page ? page.tags : [];
                return (
                  <a
                    key={page.slug}
                    href={`/dashboard/brain/${page.slug.split("/").map(encodeURIComponent).join("/")}`}
                    className="flex items-center gap-4 p-4 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a] hover:bg-[#12122a] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 bg-violet-500/10 border-violet-500/20">
                      <TypeIcon size={16} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[#e8e8f0] truncate">{page.title}</span>
                        <Badge variant={typeColorMap[page.type] as Parameters<typeof Badge>[0]["variant"]}>
                          {page.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#8a8aa8]">
                        <span className="font-mono">{page.slug}</span>
                        {page.words > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Hash size={10} />
                              {page.words} Wörter
                            </span>
                          </>
                        )}
                        {page.updated && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {page.updated}
                            </span>
                          </>
                        )}
                      </div>
                      {"snippet" in page && page.snippet && (
                        <p className="text-xs text-[#8888aa] mt-2 line-clamp-2">{page.snippet}</p>
                      )}
                      {tags && tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {tags.map((tag) => (
                            <span key={tag} className="text-xs font-mono text-[#8a8aa8] bg-[#1e1e3a] px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-[#8a8aa8] group-hover:text-violet-400 transition-colors shrink-0" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
