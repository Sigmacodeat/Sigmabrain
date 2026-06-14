"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Search,
  Loader2,
  ArrowLeft,
  ChevronRight,
  Scale,
  Globe,
  Copy,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { frontmatterOf, type NormFrontmatter } from "@/lib/legal-types";

interface NormItem {
  slug: string;
  title: string;
  code: string; // BGB, BRAO, ABGB, etc.
  section: string; // § number
  content: string;
  jurisdiction: string;
}

const CODE_LABELS: Record<string, string> = {
  bgb: "Bürgerliches Gesetzbuch (BGB)",
  brao: "Bundesrechtsanwaltsordnung (BRAO)",
  zpo: "Zivilprozessordnung (ZPO)",
  "zpo-de": "Zivilprozessordnung (ZPO)",
  stgb: "Strafgesetzbuch (StGB)",
  "stgb-de": "Strafgesetzbuch (StGB)",
  "stgb-at": "Strafgesetzbuch (AT)",
  "stgb-ch": "Strafgesetzbuch (CH)",
  stpo: "Strafprozessordnung (StPO)",
  "stpo-de": "Strafprozessordnung (StPO)",
  "stpo-at": "Strafprozessordnung (AT)",
  abgb: "Allgemeines bürgerliches Gesetzbuch (ABGB)",
  ao: "Abgabenordnung (AO)",
  estg: "Einkommensteuergesetz (EStG)",
  ugb: "Unternehmensgesetzbuch (UGB)",
  eo: "Exekutionsordnung (EO)",
  ahg: "Arbeits- und Sozialversicherungsgesetz (ASVG/AHG)",
  bao: "Bundesabgabenordnung (BAO)",
  famfg: "Gesetz über das Verfahren in Familiensachen (FamFG)",
  gg: "Grundgesetz (GG)",
  gmbhg: "GmbH-Gesetz (GmbHG)",
  hgb: "Handelsgesetzbuch (HGB)",
  inso: "Insolvenzordnung (InsO)",
  ustg: "Umsatzsteuergesetz (UStG)",
  uwg: "Gesetz gegen unlauteren Wettbewerb (UWG)",
  or: "Obligationenrecht (OR)",
  zgb: "Zivilgesetzbuch (ZGB)",
};

// useSearchParams() braucht eine Suspense-Grenze, sonst scheitert das
// Prerendering der Seite im Production-Build.
export default function NormsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20" role="status" aria-label="Wird geladen">
          <Loader2 size={24} className="text-violet-400 animate-spin" aria-hidden="true" />
        </div>
      }
    >
      <NormsPageInner />
    </Suspense>
  );
}

function NormsPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("citation") || "";
  const [initialSearchQuery] = useState(initialQuery);

  const [query, setQuery] = useState(initialQuery);
  const [norms, setNorms] = useState<NormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNorm, setSelectedNorm] = useState<NormItem | null>(null);
  const [jurisdiction, setJurisdiction] = useState<"all" | "at" | "de" | "ch">("all");
  const [copied, setCopied] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Search for norm pages in the brain
        const pages = await api.brain.search(initialSearchQuery || "§ Gesetz", 50);
        if (cancelled) return;

        const items: NormItem[] = [];
        for (const page of pages) {
          const fm = frontmatterOf<NormFrontmatter>(page);
          // Erkenne Gesetze: type=statute, legal/statutes/..., law-corpus/..., norms/...
          const isStatute = fm.type === "statute" || fm.type === "norm" ||
            page.slug.includes("/law-corpus/") || page.slug.includes("/norms/") ||
            page.slug.startsWith("legal/statutes/");
          if (isStatute) {
            const codeMatch = page.slug.match(/\/([a-z-]+)$/);
            const codeFromSlug = codeMatch?.[1] || "";
            items.push({
              slug: page.slug,
              title: page.title,
              code: fm.code || codeFromSlug || "allg",
              section: fm.section || fm.paragraph || "",
              content: page.snippet || "",
              jurisdiction: (fm.jurisdiction as string) ||
                (page.slug.includes("/at/") ? "at" :
                 page.slug.includes("/ch/") ? "ch" : "de"),
            });
          }
        }

        // Also check all pages for statutes
        const lawPages = await api.brain.listPages({ limit: 300 });
        for (const page of lawPages) {
          const isLawPage = page.slug.startsWith("law-corpus/") ||
            page.slug.startsWith("legal/statutes/") ||
            page.slug.includes("-gesetz") ||
            page.slug.includes("-recht");
          if (isLawPage && !items.find((i) => i.slug === page.slug)) {
            const fm = frontmatterOf<NormFrontmatter>(page);
            const codeMatch = page.slug.match(/\/([a-z-]+)$/);
            items.push({
              slug: page.slug,
              title: page.title,
              code: fm.code || codeMatch?.[1] || page.slug.split("/").pop() || "allg",
              section: "",
              content: page.content?.slice(0, 2000) || "",
              jurisdiction: (fm.jurisdiction as string) ||
                (page.slug.includes("/at/") ? "at" :
                 page.slug.includes("/ch/") ? "ch" : "de"),
            });
          }
        }

        setNorms(items);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Normen konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialSearchQuery]);

  useEffect(() => {
    if (!selectedNorm) {
      setFullContent(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      try {
        const page = await api.brain.getPage(selectedNorm.slug);
        if (!cancelled) setFullContent(page.content || "");
      } catch {
        if (!cancelled) setFullContent(selectedNorm.content);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedNorm]);

  const filtered = norms.filter((n) => {
    const jMatch = jurisdiction === "all" || n.jurisdiction === jurisdiction;
    if (!query) return jMatch;
    const q = query.toLowerCase();
    return jMatch && (
      n.title.toLowerCase().includes(q) ||
      n.code.toLowerCase().includes(q) ||
      n.section.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );
  });

  // Group by code
  const byCode = filtered.reduce((acc, n) => {
    if (!acc[n.code]) acc[n.code] = [];
    acc[n.code].push(n);
    return acc;
  }, {} as Record<string, NormItem[]>);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
          <BookOpen size={20} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Normen</h1>
          <p className="text-sm text-[#8888aa]">Gesetze und Rechtsvorschriften durchsuchen</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-lg">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8aa8]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Norm suchen… z.B. § 823 BGB, Art. 5 GG"
            aria-label="Norm suchen… z.B. § 823 BGB, Art. 5 GG"
            className="pl-9 bg-[#0d0d1a] border-[#1e1e3a] text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Jurisdiction Tabs */}
      <div className="flex gap-2">
        {(["all", "at", "de", "ch"] as const).map((j) => {
          const counts = norms.filter((n) => n.jurisdiction === j).length;
          return (
            <button
              key={j}
              onClick={() => setJurisdiction(j)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                jurisdiction === j
                  ? "bg-violet-600/15 border-violet-500/30 text-violet-400"
                  : "bg-[#0d0d1a] border-[#1e1e3a] text-[#8a8aa8] hover:border-[#3a3a6a] hover:text-[#e8e8f0]"
              }`}
            >
              {j === "all" ? "Alle" : j === "at" ? "🇦🇹 AT" : j === "de" ? "🇩🇪 DE" : "🇨🇭 CH"}
              {j !== "all" && counts > 0 && (
                <span className="ml-1.5 px-1 py-0.5 rounded bg-[#1e1e3a] text-[10px]">{counts}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected norm detail */}
      {selectedNorm && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNorm(null)}
                className="text-[#8888aa] hover:text-[#e8e8f0]"
              >
                <ArrowLeft size={16} />
              </Button>
              <div>
                <h2 className="text-lg font-bold text-[#e8e8f0]">{selectedNorm.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="text-[10px] bg-blue-600/10 border-blue-500/20 text-blue-400">
                    {CODE_LABELS[selectedNorm.code] || selectedNorm.code.toUpperCase()}
                  </Badge>
                  <Badge variant="default" className={`text-[10px] border ${
                    selectedNorm.jurisdiction === "at" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                    selectedNorm.jurisdiction === "ch" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  }`}>
                    {selectedNorm.jurisdiction === "at" ? "🇦🇹 Österreich" :
                     selectedNorm.jurisdiction === "ch" ? "🇨🇭 Schweiz" : "🇩🇪 Deutschland"}
                  </Badge>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(fullContent || selectedNorm.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#12122a] border border-[#1e1e3a] text-[#8a8aa8] hover:text-violet-400 hover:border-violet-500/30 transition-all"
              title="Text kopieren"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
          </div>
          <div className="text-sm text-[#8888aa] whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto bg-[#0a0a18] rounded-lg p-4 border border-[#1e1e3a]">
            {detailLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 size={14} className="animate-spin text-violet-400" />
                <span className="text-xs text-[#8a8aa8]">Gesetzestext wird geladen…</span>
              </div>
            ) : (
              fullContent || selectedNorm.content
            )}
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {/* Stats bar */}
      {!loading && norms.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-[#8a8aa8]">
          <span className="flex items-center gap-1"><Scale size={12} /> <strong className="text-[#e8e8f0]">{norms.length}</strong> Gesetze</span>
          <span className="flex items-center gap-1"><Globe size={12} /> AT: {norms.filter(n => n.jurisdiction === "at").length}</span>
          <span className="flex items-center gap-1"><Globe size={12} /> DE: {norms.filter(n => n.jurisdiction === "de").length}</span>
          <span className="flex items-center gap-1"><Globe size={12} /> CH: {norms.filter(n => n.jurisdiction === "ch").length}</span>
        </div>
      )}

      {/* Norm list grouped by code */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Wird geladen">
          <Loader2 size={24} className="text-violet-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookOpen size={40} className="mx-auto text-[#1e1e3a]" />
          <p className="text-sm text-[#8888aa]">Keine Gesetze gefunden.</p>
          <p className="text-xs text-[#8a8aa8]">{norms.length > 0 ? "Passe den Filter oder die Suche an." : "Importiere Gesetze über das CLI."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byCode).map(([code, items]) => (
            <div key={code} className="space-y-2">
              <h3 className="text-xs font-semibold text-[#8a8aa8] uppercase tracking-wider flex items-center gap-2">
                <BookOpen size={12} />
                {CODE_LABELS[code] || code.toUpperCase()}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e3a] text-[#8a8aa8]">{items.length}</span>
              </h3>
              <div className="space-y-1">
                {items.map((n) => (
                  <button
                    key={n.slug}
                    onClick={() => setSelectedNorm(n)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#12122a] transition-colors group border border-transparent hover:border-[#1e1e3a]"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      n.jurisdiction === "at" ? "bg-red-400" :
                      n.jurisdiction === "ch" ? "bg-emerald-400" :
                      "bg-blue-400"
                    }`} />
                    <span className="text-sm text-[#8888aa] group-hover:text-[#e8e8f0] flex-1 truncate">{n.title}</span>
                    {n.jurisdiction && (
                      <span className="text-[10px] text-[#8a8aa8] bg-[#1e1e3a] px-1.5 py-0.5 rounded uppercase">{n.jurisdiction}</span>
                    )}
                    <ChevronRight size={12} className="text-[#8a8aa8] group-hover:text-violet-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
