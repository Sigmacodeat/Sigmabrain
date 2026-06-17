"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Tag,
  Edit3,
  Eye,
  Network,
  FileText,
  Users,
  Building2,
  Lightbulb,
  Calendar,
  MapPin,
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { BrainPage, Entity } from "@/lib/types";
import { GobdIntegrityPanel } from "@/components/gobd-integrity-panel";

// Erweiterte Felder, die die Detail-API zusätzlich zur BrainPage liefert.
interface PageGraphExtras {
  links?: Array<{ target: string; type: string }>;
  related?: Array<{ slug: string; title: string; type: string; relevance: number }>;
  entities?: Array<Entity & { salience?: number }>;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  person: Users,
  company: Building2,
  idea: Lightbulb,
  document: FileText,
  event: Calendar,
  place: MapPin,
};

const TYPE_COLOR: Record<string, string> = {
  person: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  company: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  idea: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  document: "text-violet-600 bg-violet-500/10 border-violet-500/20",
  event: "text-rose-600 bg-rose-500/10 border-rose-500/20",
  place: "text-teal-600 bg-teal-500/10 border-teal-500/20",
};

export default function BrainDetailPage() {
  const params = useParams();
  const slug = decodeURIComponent((params.slug as string) || "");
  const [page, setPage] = useState<BrainPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.brain.getPage(slug)
      .then((p) => {
        setPage(p);
        setContent(p.content || "");
      })
      .catch(() => setPage(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const pageType = page?.source || "document";
  const TypeIcon = TYPE_ICON[pageType] || FileText;
  const typeStyle = TYPE_COLOR[pageType] || TYPE_COLOR.document;

  const copySlug = async () => {
    await navigator.clipboard.writeText(slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown renderer
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-1 mb-4 ml-4 list-disc marker:text-violet-500">
            {listItems}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("# ")) {
        flushList();
        elements.push(
          <h1 key={i} className="text-2xl font-bold text-[#15151d] mb-4 mt-2">{trimmed.slice(2)}</h1>
        );
      } else if (trimmed.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={i} className="text-lg font-semibold text-violet-600 mb-3 mt-6 pb-2 border-b border-[#e2e4ec]">
            {trimmed.slice(3)}
          </h2>
        );
      } else if (trimmed.startsWith("- ")) {
        listItems.push(
          <li key={i} className="text-sm text-[#585866] leading-relaxed">
            {trimmed.slice(2)}
          </li>
        );
      } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        flushList();
        elements.push(
          <p key={i} className="text-sm text-[#15151d] font-semibold mb-2">{trimmed.slice(2, -2)}</p>
        );
      } else if (trimmed === "") {
        flushList();
      } else {
        flushList();
        elements.push(
          <p key={i} className="text-sm text-[#585866] leading-relaxed mb-3">{trimmed}</p>
        );
      }
    });
    flushList();
    return elements;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        {/* Breadcrumb + Actions */}
        <div className="sticky top-0 z-10 bg-[#f5f6f9] border-b border-[#e2e4ec] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/brain" className="text-[#585866] hover:text-[#585866] transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <span className="text-xs text-[#585866]">Brain</span>
            <span className="text-xs text-[#e2e4ec]">/</span>
            <span className="text-xs text-[#585866] font-mono truncate max-w-[200px]">{slug}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copySlug}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#585866] hover:text-[#585866] hover:bg-[#eceef3] transition-all"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              {copied ? "Kopiert" : "Slug"}
            </button>
            <button
              onClick={() => setEditMode(!editMode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                editMode
                  ? "bg-violet-600/20 text-violet-600 border border-violet-500/30"
                  : "text-[#585866] hover:text-[#585866] hover:bg-[#eceef3]"
              )}
            >
              {editMode ? <Eye size={12} /> : <Edit3 size={12} />}
              {editMode ? "Ansehen" : "Bearbeiten"}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#585866]">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">Seite wird geladen…</p>
          </div>
        )}
        {!loading && !page && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-600">
            <p className="text-sm font-medium">Seite nicht gefunden</p>
            <p className="text-xs text-[#585866]">{slug}</p>
          </div>
        )}
        {page && (
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", typeStyle)}>
                  <TypeIcon size={18} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#15151d]">{page.title}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="document">{page.source}</Badge>
                    <span className="text-xs text-[#585866]">·</span>
                    <span className="text-xs text-[#585866] font-mono">{page.word_count} Wörter</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {page.tags && page.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-3">
                  <Tag size={12} className="text-[#585866] mr-1" />
                  {page.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-mono text-violet-600 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center gap-4 mt-3 text-xs text-[#585866]">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  Erstellt: {page.created_at}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  Aktualisiert: {page.updated_at}
                </span>
              </div>
            </div>

            {/* Content */}
            {editMode ? (
              <div className="space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-[400px] bg-[#ffffff] border border-[#e2e4ec] rounded-xl p-4 text-sm text-[#15151d] font-mono leading-relaxed focus:outline-none focus:border-violet-500/50 resize-y"
                  spellCheck={false}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="glow">
                    Speichern
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="prose-dark">
                {renderContent(content)}
              </div>
            )}

            {/* GoBD-Beleg: Aufbewahrung + Hash-Verifikation (nur wenn gestempelt) */}
            {!editMode && <GobdIntegrityPanel page={page} />}

            {/* Graph Links */}
            {!editMode && ((page as PageGraphExtras).links?.length ?? 0) > 0 && (
              <div className="mt-10">
                <h3 className="text-sm font-semibold text-[#15151d] mb-4 flex items-center gap-2">
                  <Network size={14} className="text-violet-600" />
                  Verknüpfungen im Graph
                </h3>
                <div className="space-y-2">
                  {((page as PageGraphExtras).links ?? []).map((link) => (
                    <Link
                      key={link.target}
                      href={`/dashboard/brain/${encodeURIComponent(link.target)}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#e2e4ec] bg-[#ffffff] hover:border-[#b4b9c8] hover:bg-[#eceef3] transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                          {link.type}
                        </span>
                        <span className="text-xs text-[#585866]">→</span>
                      </div>
                      <span className="text-sm text-[#15151d] group-hover:text-violet-700 transition-colors flex-1">
                        {link.target}
                      </span>
                      <ExternalLink size={12} className="text-[#585866] group-hover:text-violet-600 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar: Related */}
      {page && (
        <div className="w-72 shrink-0 border-l border-[#e2e4ec] bg-[#ffffff] overflow-y-auto p-5 space-y-6">
          {/* Related pages */}
          {((page as PageGraphExtras).related?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-[#585866] uppercase tracking-wider font-medium mb-3">Verwandte Seiten</p>
              <div className="space-y-2">
                {((page as PageGraphExtras).related ?? []).map((rel) => {
                  const RelIcon = TYPE_ICON[rel.type] || FileText;
                  return (
                    <Link
                      key={rel.slug}
                      href={`/dashboard/brain/${encodeURIComponent(rel.slug)}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-[#eceef3] transition-colors group"
                    >
                      <RelIcon size={14} className="text-[#585866] group-hover:text-violet-600 transition-colors shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#15151d] truncate">{rel.title}</p>
                        <p className="text-[10px] text-[#585866] font-mono">{rel.slug}</p>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600">{(rel.relevance * 100).toFixed(0)}%</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Entities */}
          {((page as PageGraphExtras).entities?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-[#585866] uppercase tracking-wider font-medium mb-3">Erkannte Entitäten</p>
              <div className="space-y-2">
                {((page as PageGraphExtras).entities ?? []).map((ent) => {
                  const EntIcon = TYPE_ICON[ent.type] || FileText;
                  const entStyle = TYPE_COLOR[ent.type] || TYPE_COLOR.document;
                  return (
                    <div
                      key={ent.slug}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#e2e4ec] bg-[#ffffff]"
                    >
                      <div className={cn("w-7 h-7 rounded-md border flex items-center justify-center", entStyle)}>
                        <EntIcon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#15151d]">{ent.name}</p>
                        <p className="text-[10px] text-[#585866] font-mono">{ent.type}</p>
                      </div>
                      {ent.salience !== undefined && (
                        <span className="text-[10px] font-mono text-violet-600">{(ent.salience * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div>
            <p className="text-xs text-[#585866] uppercase tracking-wider font-medium mb-3">Aktionen</p>
            <div className="space-y-1.5">
              <Button variant="secondary" size="sm" className="w-full justify-start">
                <BookOpen size={12} /> Im Brain suchen
              </Button>
              <Button variant="secondary" size="sm" className="w-full justify-start">
                <Network size={12} /> Graph ansehen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
