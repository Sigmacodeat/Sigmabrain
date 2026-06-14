"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Search,
  Loader2,
  FileText,
  X,
  Trash2,
  Pencil,
  Save,
  Sparkles,
  Table2,
  Download,
  ChevronRight,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import type { BrainPage, TabularReviewResponse } from "@/lib/types";
import { OFFLINE_KEYS, enqueueMutation, getCache, isOnline, setCache } from "@/lib/offline-store";

interface ContractItem {
  slug: string;
  title: string;
  parties?: string;
  contractType?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  riskScore?: number;
  status?: "draft" | "reviewed" | "approved" | "signed";
  createdAt: string;
  content: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  medium: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  high: "bg-red-500/10 border-red-500/20 text-red-400",
  critical: "bg-red-600/20 border-red-500/30 text-red-300",
};

const RISK_LABELS: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[#12122a] border-[#1e1e3a] text-[#8888aa]",
  reviewed: "bg-violet-500/10 border-violet-500/20 text-violet-300",
  approved: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  signed: "bg-blue-500/10 border-blue-500/20 text-blue-400",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  reviewed: "Geprüft",
  approved: "Freigegeben",
  signed: "Unterzeichnet",
};

function parseContract(page: BrainPage): ContractItem {
  const fm = page.frontmatter ?? {};
  return {
    slug: page.slug,
    title: page.title,
    parties: (fm.parties as string) || undefined,
    contractType: (fm.contract_type as string) || undefined,
    riskLevel: (fm.risk_level as ContractItem["riskLevel"]) || undefined,
    riskScore: (fm.risk_score as number) || undefined,
    status: (fm.contract_status as ContractItem["status"]) || "draft",
    createdAt: (page as unknown as Record<string, unknown>).createdAt as string || (page as unknown as Record<string, unknown>).created_at as string || new Date().toISOString(),
    content: page.content || "",
  };
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("Kaufvertrag");
  const [newParties, setNewParties] = useState("");
  const [newContent, setNewContent] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [analyzingSlug, setAnalyzingSlug] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [showReview, setShowReview] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<string[]>([
    "Welche Haftungsklauseln enthält der Vertrag?",
    "Sind AGB-rechtliche Vorschriften beachtet?",
    "Gibt es Kündigungsfristen und sind diese angemessen?",
  ]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<TabularReviewResponse | null>(null);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editParties, setEditParties] = useState("");
  const [editStatus, setEditStatus] = useState<ContractItem["status"]>();
  const [editContent, setEditContent] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => { loadContracts(); }, []);

  async function loadContracts() {
    setLoading(true); setLoadError(null);
    try {
      const pages = await api.brain.listPages({ type: "legal_contract", limit: 100 });
      const nextContracts = pages.map(parseContract);
      setContracts(nextContracts);
      await setCache(OFFLINE_KEYS.contracts, nextContracts);
    } catch (err) {
      const cached = await getCache<ContractItem[]>(OFFLINE_KEYS.contracts);
      if (cached) {
        setContracts(cached);
        setLoadError("Cloud-Brain gerade nicht erreichbar. Es werden zwischengespeicherte Verträge angezeigt.");
      } else {
        setLoadError(err instanceof Error ? err.message : "Verträge konnten nicht geladen werden.");
      }
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return contracts;
    const q = query.toLowerCase();
    return contracts.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.parties?.toLowerCase().includes(q) ?? false) || (c.contractType?.toLowerCase().includes(q) ?? false)
    );
  }, [contracts, query]);

  async function createContract() {
    if (!newTitle.trim() || !newContent.trim()) { setCreateError("Titel und Vertragstext sind erforderlich."); return; }
    setCreateError(null);
    try {
      const slug = `legal/contracts/${newTitle.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      const payload = { slug, title: newTitle, type: "legal_contract", content: newContent,
        frontmatter: { contract_type: newType, parties: newParties, contract_status: "draft", risk_level: null, risk_score: null },
      };
      if (isOnline()) {
        await api.brain.createPage(payload);
      } else {
        await enqueueMutation({ type: "createPage", payload });
      }
      const nextContracts = [parseContract({
        slug,
        title: newTitle,
        type: "legal_contract",
        content: newContent,
        frontmatter: payload.frontmatter,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BrainPage), ...contracts];
      setContracts(nextContracts);
      await setCache(OFFLINE_KEYS.contracts, nextContracts);
      setNewTitle(""); setNewParties(""); setNewContent(""); setNewType("Kaufvertrag"); setCreating(false);
    } catch (err) { setCreateError(err instanceof Error ? err.message : "Erstellen fehlgeschlagen."); }
  }

  async function analyzeContract(contract: ContractItem) {
    setAnalyzingSlug(contract.slug); setAnalysisResult(null); setAnalysisLoading(true);
    try {
      const prompt = `Analysiere den folgenden Vertrag nach deutschem Recht (BGB, AGB-Recht, DSGVO). Erstelle eine strukturierte Analyse:\n\nVERTRAGSTEXT:\n${contract.content.slice(0, 12000)}\n\nGIB DEINE ANTWORT IN DIESER STRUKTUR:\n## Vertragsanalyse — ${contract.title}\n\n### Übersicht\n- **Vertragstyp:** [Typ]\n- **Parteien:** [Parteien]\n- **Gesamtrisiko:** 🟢 Niedrig / 🟡 Mittel / 🔴 Hoch / 🚨 Kritisch\n- **Risiko-Score:** [0-100]\n\n### Klauselmatrix\n| Klausel | Bewertung | Risiko | Empfehlung |\n|---------|-----------|--------|------------|\n| [Klausel 1] | [Zusammenfassung] | 🟢/🟡/🔴 | [Vorschlag] |\n\n### Rote Flaggen\n1. [Klausel]: [Problem] — [Rechtliche Grundlage]\n\n### Fehlende Standardklauseln\n- [ ] [Klausel]\n\n### Empfohlene Änderungen\n1. [Konkreter Textvorschlag]\n\nENDE DER ANALYSE.`;
      const result = await api.query.think(prompt, "balanced");
      setAnalysisResult(result.answer);
      const riskMatch = result.answer.match(/🟢|🟡|🔴|🚨/);
      const riskLevel: ContractItem["riskLevel"] = riskMatch
        ? riskMatch[0] === "🚨"
          ? "critical"
          : riskMatch[0] === "🔴"
            ? "high"
            : riskMatch[0] === "🟡"
              ? "medium"
              : "low"
        : undefined;
      const scoreMatch = result.answer.match(/Risiko-Score:\s*(\d+)/);
      const riskScore = scoreMatch ? parseInt(scoreMatch[1], 10) : undefined;
      const updatePayload = { slug: contract.slug, frontmatter: { risk_level: riskLevel, risk_score: riskScore, analysis_date: new Date().toISOString() } };
      await api.brain.updatePage(updatePayload);
      const nextContracts = contracts.map((c) => c.slug === contract.slug ? { ...c, riskLevel, riskScore } : c);
      setContracts(nextContracts);
      await setCache(OFFLINE_KEYS.contracts, nextContracts);
    } catch (err) { /* analysis shown inline */ }
    finally { setAnalysisLoading(false); }
  }

  async function runReview() {
    const qs = reviewQuestions.map((q) => q.trim()).filter(Boolean);
    if (qs.length === 0) { setReviewError("Mindestens eine Frage angeben."); return; }
    setReviewLoading(true); setReviewError(null); setReviewResult(null);
    try {
      const res = await api.legal.tabularReview({ type: "legal_contract", questions: qs, limit: 50 });
      setReviewResult(res);
      if (res.rows.length === 0) setReviewError("Keine Verträge für Review gefunden.");
    } catch (e) { setReviewError(e instanceof Error ? e.message : "Massen-Review fehlgeschlagen."); }
    finally { setReviewLoading(false); }
  }

  async function deleteContract(slug: string) {
    if (!confirm("Vertrag wirklich löschen?")) return;
    try {
      if (isOnline()) {
        await api.brain.deletePage(slug);
      } else {
        await enqueueMutation({ type: "deletePage", payload: { slug } });
      }
      const nextContracts = contracts.filter((c) => c.slug !== slug);
      setContracts(nextContracts);
      await setCache(OFFLINE_KEYS.contracts, nextContracts);
    }
    catch (err) { setLoadError(err instanceof Error ? err.message : "Löschen fehlgeschlagen."); }
  }

  function startEdit(contract: ContractItem) {
    setEditingSlug(contract.slug); setEditTitle(contract.title); setEditType(contract.contractType || "");
    setEditParties(contract.parties || ""); setEditStatus(contract.status); setEditContent(contract.content); setEditError(null);
  }

  async function saveEdit() {
    if (!editTitle.trim()) { setEditError("Titel ist erforderlich."); return; }
    try {
      const payload = { slug: editingSlug!, title: editTitle, content: editContent,
        frontmatter: { contract_type: editType, parties: editParties, contract_status: editStatus },
      };
      if (isOnline()) {
        await api.brain.updatePage(payload);
      } else {
        await enqueueMutation({ type: "updatePage", payload });
      }
      const nextContracts = contracts.map((contract) => contract.slug === editingSlug
        ? { ...contract, title: editTitle, content: editContent, contractType: editType, parties: editParties, status: editStatus }
        : contract);
      setContracts(nextContracts);
      await setCache(OFFLINE_KEYS.contracts, nextContracts);
      setEditingSlug(null);
    } catch (err) { setEditError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e8e8f0]">Vertrags-Intelligenz</h1>
            <p className="text-sm text-[#8888aa]">KI-gestützte Vertragsanalyse, Risikobewertung und Massen-Review</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="bg-[#12122a] border border-[#1e1e3a] text-[#e8e8f0] hover:bg-[#1a1a3a] gap-2" onClick={() => setShowReview(!showReview)}>
            <Table2 size={14} /> Massen-Review
          </Button>
          <Button onClick={() => setCreating(!creating)} className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
            <Plus size={14} /> Vertrag anlegen
          </Button>
        </div>
      </div>

      {creating && (
        <div className="rounded-xl border border-violet-500/20 bg-[#0d0d1a] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#e8e8f0]">Neuer Vertrag</h3>
            <button onClick={() => setCreating(false)} className="text-[#8a8aa8] hover:text-[#e8e8f0]"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Vertragsbezeichnung" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
            <input value={newParties} onChange={(e) => setNewParties(e.target.value)} placeholder="Parteien (z.B. Käufer A — Verkäufer B)" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
          </div>
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full md:w-auto bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50">
            {["Kaufvertrag","Dienstvertrag","Werkvertrag","Mietvertrag","NDA / Geheimhaltung","Arbeitsvertrag","Lizenzvertrag","GmbH-Vertrag","Sonstige"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={8} placeholder="Vertragstext hier einfügen…" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex justify-end">
            <Button onClick={createContract} disabled={!newTitle.trim()} className="bg-violet-600 hover:bg-violet-500 text-white gap-2"><Save size={14} /> Speichern</Button>
          </div>
        </div>
      )}

      {showReview && (
        <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#e8e8f0]">Massen-Review über alle Verträge</h3>
            <button onClick={() => setShowReview(false)} className="text-[#8a8aa8] hover:text-[#e8e8f0]"><X size={16} /></button>
          </div>
          <div className="space-y-2">
            {reviewQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={q} onChange={(e) => setReviewQuestions((qs) => qs.map((qq, idx) => (idx === i ? e.target.value : qq)))} placeholder={`Frage ${i + 1}`} className="flex-1 bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
                <button onClick={() => setReviewQuestions((qs) => qs.filter((_, idx) => idx !== i))} className="text-[#8a8aa8] hover:text-red-400"><X size={14} /></button>
              </div>
            ))}
            {reviewQuestions.length < 8 && <button onClick={() => setReviewQuestions((qs) => [...qs, ""])} className="text-xs text-violet-400 hover:underline">+ Frage hinzufügen</button>}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={runReview} disabled={reviewLoading} className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
              {reviewLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {reviewLoading ? "Wird analysiert…" : "Massen-Review starten"}
            </Button>
            {reviewResult && reviewResult.rows.length > 0 && (
              <Button variant="secondary" className="bg-[#12122a] border border-[#1e1e3a] text-[#e8e8f0] hover:bg-[#1a1a3a] gap-2" onClick={() => {
                const csv = [["Vertrag", ...reviewResult.questions].join(";"), ...reviewResult.rows.map((r) => [r.title, ...r.cells.map((cell) => cell.answer.replace(/"/g, '""'))].join(";"))].join("\n");
                const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `contract-review-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
              }}><Download size={14} /> CSV Export</Button>
            )}
          </div>
          {reviewError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{reviewError}</div>}
          {reviewResult && reviewResult.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#1e1e3a]"><th className="text-left px-3 py-2 text-[#8888aa] font-medium">Vertrag</th>{reviewResult.questions.map((q, i) => <th key={i} className="text-left px-3 py-2 text-[#8888aa] font-medium min-w-[200px]">{q}</th>)}</tr></thead>
                <tbody>{reviewResult.rows.map((row, i) => <tr key={i} className="border-b border-[#1e1e3a]/50 hover:bg-[#12122a]"><td className="px-3 py-2 text-[#e8e8f0] whitespace-nowrap">{row.title}</td>{row.cells.map((cell, j) => <td key={j} className="px-3 py-2 text-[#8a8aa8] max-w-xs truncate" title={cell.answer}>{cell.answer}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8aa8]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Verträge suchen…" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
      </div>

      {loadError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{loadError}</div>}

      {/* Summary stats */}
      {!loading && contracts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <BarChart3 size={14} className="text-violet-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#e8e8f0]">{contracts.length}</p>
              <p className="text-[10px] text-[#8a8aa8]">Verträge</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck size={14} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#e8e8f0]">{contracts.filter(c => c.status === "approved" || c.status === "signed").length}</p>
              <p className="text-[10px] text-[#8a8aa8]">Freigegeben</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle size={14} className="text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#e8e8f0]">{contracts.filter(c => c.riskLevel === "medium" || c.riskLevel === "high" || c.riskLevel === "critical").length}</p>
              <p className="text-[10px] text-[#8a8aa8]">Risiko</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#e8e8f0]">{contracts.filter(c => c.riskLevel === "critical").length}</p>
              <p className="text-[10px] text-[#8a8aa8]">Kritisch</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-[#8888aa]">Lade Verträge…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText size={44} className="mx-auto text-[#1e1e3a]" />
          <p className="text-sm text-[#8888aa]">Noch keine Verträge angelegt.</p>
          <p className="text-xs text-[#8a8aa8]">Nutze den „Vertrag anlegen“-Button um einen Vertrag einzufügen und analysieren zu lassen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((contract) => {
            const isEditing = editingSlug === contract.slug;
            const isAnalyzing = analyzingSlug === contract.slug;
            if (isEditing) {
              return (
                <div key={contract.slug} className="rounded-xl border border-violet-500/20 bg-[#0d0d1a] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#e8e8f0]">Vertrag bearbeiten</h3>
                    <button onClick={() => setEditingSlug(null)} className="text-[#8a8aa8] hover:text-[#e8e8f0]"><X size={16} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Titel" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50" />
                    <input value={editParties} onChange={(e) => setEditParties(e.target.value)} placeholder="Parteien" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input value={editType} onChange={(e) => setEditType(e.target.value)} placeholder="Vertragstyp" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50" />
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as ContractItem["status"])} className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50">
                      {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </div>
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} placeholder="Vertragstext" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50" />
                  {editError && <p className="text-xs text-red-400">{editError}</p>}
                  <div className="flex justify-end">
                    <Button onClick={saveEdit} disabled={!editTitle.trim()} className="bg-violet-600 hover:bg-violet-500 text-white gap-2"><Save size={14} /> Speichern</Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={contract.slug} className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#e8e8f0]">{contract.title}</span>
                      {contract.contractType && <Badge variant="default" className="text-[10px] border border-violet-500/20 bg-violet-500/10 text-violet-300">{contract.contractType}</Badge>}
                      <Badge variant="default" className={`text-[10px] border ${STATUS_COLORS[contract.status || "draft"]}`}>{STATUS_LABELS[contract.status || "draft"]}</Badge>
                    </div>
                    {contract.parties && <p className="text-xs text-[#8a8aa8] mt-1">{contract.parties}</p>}
                    {/* Risk score bar */}
                    {contract.riskLevel && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              contract.riskLevel === "low" ? "bg-emerald-400" :
                              contract.riskLevel === "medium" ? "bg-amber-400" :
                              contract.riskLevel === "high" ? "bg-red-400" :
                              "bg-red-500"
                            }`}
                            style={{ width: `${contract.riskScore ?? (contract.riskLevel === "low" ? 25 : contract.riskLevel === "medium" ? 50 : contract.riskLevel === "high" ? 75 : 95)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${
                          contract.riskLevel === "low" ? "text-emerald-400" :
                          contract.riskLevel === "medium" ? "text-amber-400" :
                          contract.riskLevel === "high" ? "text-red-400" :
                          "text-red-300"
                        }`}>
                          {contract.riskScore !== undefined ? `${contract.riskScore}/100` : RISK_LABELS[contract.riskLevel]} — {RISK_LABELS[contract.riskLevel]}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => analyzeContract(contract)} disabled={isAnalyzing} className="p-1.5 rounded-lg text-[#8a8aa8] hover:text-violet-400 hover:bg-violet-500/10 transition-all" title="KI-Analyse">
                      {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </button>
                    <button onClick={() => startEdit(contract)} className="p-1.5 rounded-lg text-[#8a8aa8] hover:text-violet-400 hover:bg-violet-500/10 transition-all" title="Bearbeiten"><Pencil size={14} /></button>
                    <button onClick={() => deleteContract(contract.slug)} className="p-1.5 rounded-lg text-[#8a8aa8] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Löschen"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="text-xs text-[#8a8aa8] line-clamp-2">{contract.content.slice(0, 200)}…</div>
                {isAnalyzing && <div className="flex items-center gap-2 text-xs text-violet-400"><Loader2 size={14} className="animate-spin" /> KI analysiert Vertrag…</div>}
                {analyzingSlug === contract.slug && analysisResult && (
                  <div className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[#e8e8f0]">KI-Analyse</h4>
                      <button onClick={() => { setAnalysisResult(null); setAnalyzingSlug(null); }} className="text-[#8a8aa8] hover:text-[#e8e8f0]"><X size={14} /></button>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-[#c8c8e0] overflow-auto max-h-[400px]"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisResult) }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
