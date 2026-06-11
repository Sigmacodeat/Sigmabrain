"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Hash,
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
  AlertTriangle,
  BookOpen,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BrainPage, Entity } from "@/lib/types";

const TYPE_ICON: Record<string, React.ElementType> = {
  person: Users,
  company: Building2,
  idea: Lightbulb,
  document: FileText,
  event: Calendar,
  place: MapPin,
};

const TYPE_COLOR: Record<string, string> = {
  person: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  company: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  idea: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  document: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  event: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  place: "text-teal-400 bg-teal-500/10 border-teal-500/20",
};

const MOCK_PAGE: BrainPage = {
  slug: "people/alice",
  title: "Alice",
  content: `Alice leitet Engineering bei Acme Inc. (Series-B Fintech). Sie hat einen Hintergrund in Distributed Systems und Security.

## Kontakt
- Email: alice@acme.example
- LinkedIn: linkedin.com/in/alice-example

## Timeline
- **2024-01**: CTO bei Acme
- **2022-06**: Senior Eng bei TechCorp
- **2019-03**: BSc CS an der TU München

## Notizen
Wichtige Gesprächspartnerin für Security Reviews. Hat den 500-Seat Deal im Blick.`,
  tags: ["engineering", "acme", "cto", "security"],
  source: "people",
  created_at: "2024-01-15",
  updated_at: "2026-04-22",
  word_count: 340,
};

const MOCK_ENTITIES: (Entity & { salience?: number })[] = [
  { slug: "people/alice", name: "Alice", type: "person", salience: 0.95 },
  { slug: "companies/acme", name: "Acme Inc.", type: "company", salience: 0.88 },
  { slug: "companies/techcorp", name: "TechCorp", type: "company", salience: 0.72 },
];

const MOCK_RELATED = [
  { slug: "meetings/alice-q1", title: "Q1 Review mit Alice", type: "document", relevance: 0.92 },
  { slug: "companies/acme", title: "Acme Inc.", type: "company", relevance: 0.88 },
  { slug: "ideas/brain-arch", title: "Brain Architecture", type: "idea", relevance: 0.65 },
];

const MOCK_LINKS = [
  { target: "companies/acme", type: "works_at", direction: "out" as const },
  { target: "companies/techcorp", type: "worked_at", direction: "out" as const },
  { target: "ideas/brain-arch", type: "interested_in", direction: "out" as const },
];

export default function BrainDetailPage() {
  const params = useParams();
  const slug = decodeURIComponent((params.slug as string) || "");
  const [page] = useState<BrainPage>({ ...MOCK_PAGE, slug });
  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState(MOCK_PAGE.content);
  const [copied, setCopied] = useState(false);

  const TypeIcon = TYPE_ICON["person"] || FileText;
  const typeStyle = TYPE_COLOR["person"] || TYPE_COLOR.document;

  const copySlug = async () => {
    await navigator.clipboard.writeText(slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown renderer
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-1 mb-4 ml-4 list-disc marker:text-violet-500">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("# ")) {
        flushList();
        elements.push(
          <h1 key={i} className="text-2xl font-bold text-[#e8e8f0] mb-4 mt-2">{trimmed.slice(2)}</h1>
        );
      } else if (trimmed.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={i} className="text-lg font-semibold text-violet-400 mb-3 mt-6 pb-2 border-b border-[#1e1e3a]">
            {trimmed.slice(3)}
          </h2>
        );
      } else if (trimmed.startsWith("- ")) {
        inList = true;
        listItems.push(
          <li key={i} className="text-sm text-[#8888aa] leading-relaxed">
            {trimmed.slice(2)}
          </li>
        );
      } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        flushList();
        elements.push(
          <p key={i} className="text-sm text-[#e8e8f0] font-semibold mb-2">{trimmed.slice(2, -2)}</p>
        );
      } else if (trimmed === "") {
        flushList();
      } else {
        flushList();
        elements.push(
          <p key={i} className="text-sm text-[#8888aa] leading-relaxed mb-3">{trimmed}</p>
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
        <div className="sticky top-0 z-10 bg-[#06060f] border-b border-[#1e1e3a] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/brain" className="text-[#4a4a6a] hover:text-[#8888aa] transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <span className="text-xs text-[#4a4a6a]">Brain</span>
            <span className="text-xs text-[#1e1e3a]">/</span>
            <span className="text-xs text-[#8888aa] font-mono truncate max-w-[200px]">{slug}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copySlug}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#4a4a6a] hover:text-[#8888aa] hover:bg-[#12122a] transition-all"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "Kopiert" : "Slug"}
            </button>
            <button
              onClick={() => setEditMode(!editMode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                editMode
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                  : "text-[#4a4a6a] hover:text-[#8888aa] hover:bg-[#12122a]"
              )}
            >
              {editMode ? <Eye size={12} /> : <Edit3 size={12} />}
              {editMode ? "Ansehen" : "Bearbeiten"}
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", typeStyle)}>
                <TypeIcon size={18} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#e8e8f0]">{page.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="document">{page.source}</Badge>
                  <span className="text-xs text-[#4a4a6a]">·</span>
                  <span className="text-xs text-[#4a4a6a] font-mono">{page.word_count} Wörter</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {page.tags && page.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                <Tag size={12} className="text-[#4a4a6a] mr-1" />
                {page.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 mt-3 text-xs text-[#4a4a6a]">
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
                className="w-full h-[400px] bg-[#0d0d1a] border border-[#1e1e3a] rounded-xl p-4 text-sm text-[#e8e8f0] font-mono leading-relaxed focus:outline-none focus:border-violet-500/50 resize-y"
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

          {/* Graph Links */}
          {!editMode && MOCK_LINKS.length > 0 && (
            <div className="mt-10">
              <h3 className="text-sm font-semibold text-[#e8e8f0] mb-4 flex items-center gap-2">
                <Network size={14} className="text-violet-400" />
                Verknüpfungen im Graph
              </h3>
              <div className="space-y-2">
                {MOCK_LINKS.map((link) => (
                  <Link
                    key={link.target}
                    href={`/dashboard/brain/${encodeURIComponent(link.target)}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:border-[#3a3a6a] hover:bg-[#12122a] transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                        {link.type}
                      </span>
                      <span className="text-xs text-[#4a4a6a]">→</span>
                    </div>
                    <span className="text-sm text-[#e8e8f0] group-hover:text-violet-300 transition-colors flex-1">
                      {link.target}
                    </span>
                    <ExternalLink size={12} className="text-[#4a4a6a] group-hover:text-violet-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar: Related */}
      <div className="w-72 shrink-0 border-l border-[#1e1e3a] bg-[#0a0a18] overflow-y-auto p-5 space-y-6">
        {/* Salience Score */}
        <div>
          <p className="text-xs text-[#4a4a6a] uppercase tracking-wider font-medium mb-3">Salience</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[#1e1e3a] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full" style={{ width: "95%" }} />
            </div>
            <span className="text-sm font-mono font-bold text-violet-400">0.95</span>
          </div>
          <p className="text-xs text-[#4a4a6a] mt-1">Wie zentral diese Seite im Brain ist</p>
        </div>

        {/* Related pages */}
        <div>
          <p className="text-xs text-[#4a4a6a] uppercase tracking-wider font-medium mb-3">Verwandte Seiten</p>
          <div className="space-y-2">
            {MOCK_RELATED.map((rel) => {
              const RelIcon = TYPE_ICON[rel.type] || FileText;
              return (
                <Link
                  key={rel.slug}
                  href={`/dashboard/brain/${encodeURIComponent(rel.slug)}`}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-[#12122a] transition-colors group"
                >
                  <RelIcon size={14} className="text-[#4a4a6a] group-hover:text-violet-400 transition-colors shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#e8e8f0] truncate">{rel.title}</p>
                    <p className="text-[10px] text-[#4a4a6a] font-mono">{rel.slug}</p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">{(rel.relevance * 100).toFixed(0)}%</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Entities */}
        <div>
          <p className="text-xs text-[#4a4a6a] uppercase tracking-wider font-medium mb-3">Erkannte Entitäten</p>
          <div className="space-y-2">
            {MOCK_ENTITIES.map((ent) => {
              const EntIcon = TYPE_ICON[ent.type] || FileText;
              const entStyle = TYPE_COLOR[ent.type] || TYPE_COLOR.document;
              return (
                <div
                  key={ent.slug}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#1e1e3a] bg-[#0d0d1a]"
                >
                  <div className={cn("w-7 h-7 rounded-md border flex items-center justify-center", entStyle)}>
                    <EntIcon size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#e8e8f0]">{ent.name}</p>
                    <p className="text-[10px] text-[#4a4a6a] font-mono">{ent.type}</p>
                  </div>
                  {ent.salience !== undefined && (
                    <span className="text-[10px] font-mono text-violet-400">{(ent.salience * 100).toFixed(0)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <p className="text-xs text-[#4a4a6a] uppercase tracking-wider font-medium mb-3">Aktionen</p>
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
    </div>
  );
}
