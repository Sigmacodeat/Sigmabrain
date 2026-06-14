"use client";

import { useState } from "react";
import { BarChart3, Play, Loader2, CheckCircle2, AlertTriangle, XCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { scoreGrade, type EvalSummary, type EvalResult } from "@/lib/rag-eval";

export default function RagEvalPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runEval() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rag-eval", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eval fehlgeschlagen");
      setResult(data as EvalSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eval fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  const grade = result ? scoreGrade(result.overallPrecision, result.overallRecall, result.overallMrr) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <BarChart3 size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e8e8f0]">RAG-Eval</h1>
            <p className="text-sm text-[#8888aa]">Retrieval-Qualitäts-Benchmark</p>
          </div>
        </div>
        <Button
          variant="primary"
          className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
          onClick={runEval}
          disabled={loading}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {loading ? "Laufe…" : "Eval starten"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && grade && (
        <>
          {/* Overall Score */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className={cn("rounded-xl border p-4 text-center", `border-${grade.color}-500/20 bg-${grade.color}-500/5`)}>
              <div className={cn("text-2xl font-bold", `text-${grade.color}-400`)}>{grade.label}</div>
              <div className="text-xs text-[#8888aa] mt-1">Gesamtbewertung</div>
            </div>
            <div className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{(result.overallPrecision * 100).toFixed(1)}%</div>
              <div className="text-xs text-[#8888aa] mt-1">Precision@10</div>
            </div>
            <div className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{(result.overallRecall * 100).toFixed(1)}%</div>
              <div className="text-xs text-[#8888aa] mt-1">Recall@10</div>
            </div>
            <div className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{result.overallMrr.toFixed(3)}</div>
              <div className="text-xs text-[#8888aa] mt-1">MRR</div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4">
            <h2 className="text-sm font-semibold text-[#e8e8f0] mb-3">Nach Kategorie</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(result.byCategory).map(([cat, stats]) => (
                <div key={cat} className="rounded-lg border border-[#1e1e3a] bg-[#0a0a18] p-3">
                  <div className="text-xs text-[#8a8aa8] uppercase tracking-wider mb-2">{cat}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#8888aa]">Precision</span>
                      <span className="text-[#e8e8f0]">{(stats.precision * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8888aa]">Recall</span>
                      <span className="text-[#e8e8f0]">{(stats.recall * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8888aa]">MRR</span>
                      <span className="text-[#e8e8f0]">{stats.mrr.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-Query Results */}
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4">
            <h2 className="text-sm font-semibold text-[#e8e8f0] mb-3">Einzelergebnisse</h2>
            <div className="space-y-2">
              {result.results.map((r: EvalResult) => {
                const pass = r.precision >= 0.5 || r.recall >= 0.5;
                return (
                  <div key={r.queryId} className="flex items-center gap-3 p-3 rounded-lg border border-[#1e1e3a] bg-[#0a0a18]">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", pass ? "bg-emerald-500/10" : "bg-red-500/10")}>
                      {pass ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#e8e8f0] truncate">{r.query}</span>
                        <Badge variant="default" className="text-[10px] border border-violet-500/20 bg-violet-500/10 text-violet-300 shrink-0">{r.category}</Badge>
                      </div>
                      <div className="text-xs text-[#8a8aa8] mt-0.5">
                        P={(r.precision * 100).toFixed(0)}% · R={(r.recall * 100).toFixed(0)}% · MRR={r.mrr.toFixed(2)} · {r.retrievedSlugs.length} Treffer
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-[#8a8aa8]">Eval-Lauf: {new Date(result.timestamp).toLocaleString("de-DE")}</p>
        </>
      )}

      {!result && !error && !loading && (
        <div className="text-center py-20 space-y-4">
          <Target size={48} className="mx-auto text-[#1e1e3a]" />
          <div>
            <p className="text-[#8888aa]">Noch kein Eval durchgeführt.</p>
            <p className="text-[#8a8aa8] text-sm mt-1">
              Klicke „Eval starten“, um die Retrieval-Qualität Ihres Brains zu benchmarken.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
