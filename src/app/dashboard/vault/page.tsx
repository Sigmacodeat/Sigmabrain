"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Search,
  Loader2,
  FileText,
  X,
  Trash2,
  Download,
  Sparkles,
  Table2,
  Filter,
  Clock,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { BrainPage, TabularReviewResponse } from "@/lib/types";
import { OFFLINE_KEYS, enqueueMutation, getCache, isOnline, setCache } from "@/lib/offline-store";

interface VaultDoc {
  slug: string;
  title: string;
  type: string;
  source?: string;
  tags: string[];
  size?: number;
  createdAt: string;
  content: string;
}

const TYPE_LABELS: Record<string, string> = {
  legal_case: "Akte",
  legal_contract: "Vertrag",
  legal_document: "Dokument",
  bea_message: "beA-Nachricht",
  court_decision: "Urteil",
  invoice: "Rechnung",
  contact: "Kontakt",
  evidence: "Beweismittel",
};

const TYPE_COLORS: Record<string, string> = {
  legal_case: "bg-violet-500/10 border-violet-500/20 text-violet-700",
  legal_contract: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
  legal_document: "bg-blue-500/10 border-blue-500/20 text-blue-600",
  bea_message: "bg-amber-500/10 border-amber-500/20 text-amber-600",
  court_decision: "bg-red-500/10 border-red-500/20 text-red-600",
  invoice: "bg-cyan-500/10 border-cyan-500/20 text-cyan-600",
  contact: "bg-pink-500/10 border-pink-500/20 text-pink-600",
  evidence: "bg-orange-500/10 border-orange-500/20 text-orange-600",
};

function parseDoc(page: BrainPage): VaultDoc {
  const fm = page.frontmatter ?? {};
  return {
    slug: page.slug,
    title: page.title,
    type: page.type || "legal_document",
    source: (fm.source as string) || undefined,
    tags: page.tags || [],
    size: (fm.size as number) || undefined,
    createdAt: (page as unknown as Record<string, unknown>).createdAt as string || (page as unknown as Record<string, unknown>).created_at as string || new Date().toISOString(),
    content: page.content || "",
  };
}

export default function VaultPage() {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");

  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [showReview, setShowReview] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<string[]>([
    "Welche Fristen werden genannt?",
    "Welche Parteien sind beteiligt?",
    "Gibt es Haftungsklauseln?",
  ]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<TabularReviewResponse | null>(null);

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    setLoading(true); setLoadError(null);
    try {
      const pages = await api.brain.listPages({ limit: 200 });
      const nextDocs = pages.map(parseDoc);
      setDocs(nextDocs);
      await setCache(OFFLINE_KEYS.vault, nextDocs);
    } catch (err) {
      const cached = await getCache<VaultDoc[]>(OFFLINE_KEYS.vault);
      if (cached) {
        setDocs(cached);
        setLoadError("Cloud-Brain gerade nicht erreichbar. Es werden zwischengespeicherte Dokumente angezeigt.");
      } else {
        setLoadError(err instanceof Error ? err.message : "Dokumente konnten nicht geladen werden.");
      }
    } finally { setLoading(false); }
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    docs.forEach((d) => d.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [docs]);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    docs.forEach((d) => types.add(d.type));
    return Array.from(types).sort();
  }, [docs]);

  const filtered = useMemo(() => {
    let result = docs;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q));
    }
    if (typeFilter) result = result.filter((d) => d.type === typeFilter);
    if (tagFilter) result = result.filter((d) => d.tags.includes(tagFilter));
    return result;
  }, [docs, query, typeFilter, tagFilter]);

  async function runBulkReview() {
    if (selectedSlugs.size === 0) { setReviewError("Mindestens ein Dokument auswählen."); return; }
    const qs = reviewQuestions.map((q) => q.trim()).filter(Boolean);
    if (qs.length === 0) { setReviewError("Mindestens eine Frage angeben."); return; }
    setReviewLoading(true); setReviewError(null); setReviewResult(null);
    try {
      const res = await api.legal.tabularReview({ slugs: Array.from(selectedSlugs), questions: qs });
      setReviewResult(res);
      if (res.rows.length === 0) setReviewError("Keine Ergebnisse.");
    } catch (e) { setReviewError(e instanceof Error ? e.message : "Review fehlgeschlagen."); }
    finally { setReviewLoading(false); }
  }

  async function deleteDoc(slug: string) {
    if (!confirm("Dokument wirklich löschen?")) return;
    try {
      if (isOnline()) {
        await api.brain.deletePage(slug);
      } else {
        await enqueueMutation({ type: "deletePage", payload: { slug } });
      }
      const nextDocs = docs.filter((d) => d.slug !== slug);
      setDocs(nextDocs);
      await setCache(OFFLINE_KEYS.vault, nextDocs);
      setSelectedSlugs((s) => { const ns = new Set(s); ns.delete(slug); return ns; });
    }
    catch (err) { setLoadError(err instanceof Error ? err.message : "Löschen fehlgeschlagen."); }
  }

  function toggleSelect(slug: string) {
    setSelectedSlugs((s) => { const ns = new Set(s); if (ns.has(slug)) ns.delete(slug); else ns.add(slug); return ns; });
  }

  function selectAll() {
    setSelectedSlugs(new Set(filtered.map((d) => d.slug)));
  }

  function deselectAll() {
    setSelectedSlugs(new Set());
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <FolderOpen size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[color:var(--ds-text)]">Dokumenten-Vault</h1>
            <p className="text-sm text-[color:var(--ds-text-muted)]">Zentraler Dokumentenspeicher mit Bulk-Analyse und Review Tables</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedSlugs.size > 0 && (
            <Button variant="secondary" className="bg-[color:var(--ds-hover)] border border-[color:var(--ds-border)] text-[color:var(--ds-text)] hover:bg-[color:var(--ds-hover)] gap-2" onClick={() => setShowReview(!showReview)}>
              <Table2 size={14} /> Bulk-Review ({selectedSlugs.size})
            </Button>
          )}
        </div>
      </div>

      {showReview && (
        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[color:var(--ds-text)]">Bulk-Analyse über {selectedSlugs.size} ausgewählte Dokumente</h3>
            <button onClick={() => setShowReview(false)} className="text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)]"><X size={16} /></button>
          </div>
          <div className="space-y-2">
            {reviewQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={q} onChange={(e) => setReviewQuestions((qs) => qs.map((qq, idx) => (idx === i ? e.target.value : qq)))} placeholder={`Frage ${i + 1}`} className="flex-1 bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-violet-500/50" />
                <button onClick={() => setReviewQuestions((qs) => qs.filter((_, idx) => idx !== i))} className="text-[color:var(--ds-text-muted)] hover:text-red-600"><X size={14} /></button>
              </div>
            ))}
            {reviewQuestions.length < 8 && <button onClick={() => setReviewQuestions((qs) => [...qs, ""])} className="text-xs text-violet-600 hover:underline">+ Frage hinzufügen</button>}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={runBulkReview} disabled={reviewLoading} className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
              {reviewLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {reviewLoading ? "Wird analysiert…" : "Bulk-Review starten"}
            </Button>
            {reviewResult && reviewResult.rows.length > 0 && (
              <Button variant="secondary" className="bg-[color:var(--ds-hover)] border border-[color:var(--ds-border)] text-[color:var(--ds-text)] hover:bg-[color:var(--ds-hover)] gap-2" onClick={() => {
                const csv = [["Dokument", ...reviewResult.questions].join(";"), ...reviewResult.rows.map((r) => [r.title, ...r.cells.map((cell) => cell.answer.replace(/"/g, '""'))].join(";"))].join("\n");
                const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `vault-review-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
              }}><Download size={14} /> CSV Export</Button>
            )}
          </div>
          {reviewError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">{reviewError}</div>}
          {reviewResult && reviewResult.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[color:var(--ds-border)]"><th className="text-left px-3 py-2 text-[color:var(--ds-text-muted)] font-medium">Dokument</th>{reviewResult.questions.map((q, i) => <th key={i} className="text-left px-3 py-2 text-[color:var(--ds-text-muted)] font-medium min-w-[200px]">{q}</th>)}</tr></thead>
                <tbody>{reviewResult.rows.map((row, i) => <tr key={i} className="border-b border-[color:var(--ds-border)]/50 hover:bg-[color:var(--ds-hover)]"><td className="px-3 py-2 text-[color:var(--ds-text)] whitespace-nowrap">{row.title}</td>{row.cells.map((cell, j) => <td key={j} className="px-3 py-2 text-[color:var(--ds-text-muted)] max-w-xs truncate" title={cell.answer}>{cell.answer}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ds-text-muted)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Dokumente durchsuchen…" className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-violet-500/50" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[color:var(--ds-text-muted)]" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50">
            <option value="">Alle Typen</option>
            {allTypes.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
          </select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50">
            <option value="">Alle Tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {selectedSlugs.size > 0 && (
        <div className="flex items-center gap-3 text-xs text-[color:var(--ds-text-muted)]">
          <span>{selectedSlugs.size} ausgewählt</span>
          <button onClick={selectAll} className="text-violet-600 hover:underline">Alle auswählen</button>
          <button onClick={deselectAll} className="text-violet-600 hover:underline">Alle abwählen</button>
        </div>
      )}

      {loadError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">{loadError}</div>}

      {loading ? (
        <div className="text-center py-20 text-[color:var(--ds-text-muted)]">Lade Dokumente…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText size={44} className="mx-auto text-[color:var(--ds-border)]" />
          <p className="text-sm text-[color:var(--ds-text-muted)]">Keine Dokumente gefunden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doc) => (
            <div key={doc.slug} className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-2 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedSlugs.has(doc.slug)} onChange={() => toggleSelect(doc.slug)} className="accent-violet-500" />
                  <Badge variant="default" className={`text-[10px] border ${TYPE_COLORS[doc.type] || "bg-[color:var(--ds-hover)] border-[color:var(--ds-border)] text-[color:var(--ds-text-muted)]"}`}>
                    {TYPE_LABELS[doc.type] || doc.type}
                  </Badge>
                </div>
                <button onClick={() => deleteDoc(doc.slug)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[color:var(--ds-text-muted)] hover:text-red-600 hover:bg-red-500/10 transition-all" title="Löschen">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="text-sm font-medium text-[color:var(--ds-text)] truncate" title={doc.title}>{doc.title}</div>
              <div className="text-xs text-[color:var(--ds-text-muted)] line-clamp-2">{doc.content.slice(0, 120)}…</div>
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--ds-hover)] border border-[color:var(--ds-border)] text-[color:var(--ds-text-muted)]"><Tag size={9} />{t}</span>)}
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-[color:var(--ds-text-muted)]">
                <span className="flex items-center gap-1"><Clock size={10} />{new Date(doc.createdAt).toLocaleDateString("de-DE")}</span>
                {doc.size && <span>{(doc.size / 1024).toFixed(0)} KB</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
