"use client";

import { useEffect, useState } from "react";
import { Radar, Plus, X, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const WATCHLIST_SLUG = "monitoring/case-law-watchlist";

interface WatchTerm { query: string; jurisdiction: "at" | "de" | "all"; }

export default function MonitoringPage() {
  const [terms, setTerms] = useState<WatchTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newQuery, setNewQuery] = useState("");
  const [newJur, setNewJur] = useState<WatchTerm["jurisdiction"]>("all");

  useEffect(() => {
    (async () => {
      try {
        const page = await api.brain.getPage(WATCHLIST_SLUG);
        const fmTerms = (page?.frontmatter?.terms ?? []) as unknown;
        if (Array.isArray(fmTerms)) {
          setTerms(fmTerms
            .map((t) => (t && typeof t === "object" ? t as Record<string, unknown> : {}))
            .map((t) => ({
              query: String(t.query ?? ""),
              jurisdiction: (["at", "de", "all"].includes(String(t.jurisdiction)) ? String(t.jurisdiction) : "all") as WatchTerm["jurisdiction"],
            }))
            .filter((t) => t.query));
        }
      } catch {
        // Seite existiert noch nicht — leere Watchlist
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persist(next: WatchTerm[]) {
    setSaving(true);
    setError(null);
    try {
      await api.brain.updatePage({
        slug: WATCHLIST_SLUG,
        title: "Rechtsprechungs-Watchlist",
        type: "monitoring",
        frontmatter: { terms: next },
      });
      setTerms(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  function addTerm() {
    if (!newQuery.trim()) return;
    persist([...terms, { query: newQuery.trim(), jurisdiction: newJur }]);
    setNewQuery("");
  }
  function removeTerm(i: number) {
    persist(terms.filter((_, idx) => idx !== i));
  }

  const JUR_LABEL = { at: "Österreich", de: "Deutschland", all: "DE + AT" };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
          <Radar size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--ds-text)]">Rechtsprechungs-Monitoring</h1>
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Themen beobachten — neue Urteile kommen täglich per E-Mail (DE: openlegaldata/BGH, AT: RIS-OGD)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">Suchbegriff / Rechtsgebiet</label>
            <input
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTerm()}
              placeholder="z. B. Mietminderung Schimmel, § 543 BGB, Gewährleistung Kfz …"
              className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">Jurisdiktion</label>
            <select
              value={newJur}
              onChange={(e) => setNewJur(e.target.value as WatchTerm["jurisdiction"])}
              className="bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">DE + AT</option>
              <option value="de">Deutschland</option>
              <option value="at">Österreich</option>
            </select>
          </div>
          <Button onClick={addTerm} disabled={saving || !newQuery.trim()} className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-white">
            <Plus size={15} /> Hinzufügen
          </Button>
        </div>
        {saved && <p className="text-xs text-emerald-600 flex items-center gap-1"><Check size={12} /> Gespeichert</p>}
        {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[color:var(--ds-text-muted)]"><Loader2 size={15} className="animate-spin" /> Lade Watchlist…</div>
      ) : terms.length === 0 ? (
        <div className="text-center py-12 text-[color:var(--ds-text-muted)]">
          <Radar size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Noch keine Themen beobachtet. Füge oben einen Suchbegriff hinzu.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {terms.map((t, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] px-4 py-3">
              <div>
                <p className="text-sm text-[color:var(--ds-text)]">{t.query}</p>
                <p className="text-xs text-[color:var(--ds-text-muted)]">{JUR_LABEL[t.jurisdiction]}</p>
              </div>
              <button onClick={() => removeTerm(i)} disabled={saving} className="text-[color:var(--ds-text-muted)] hover:text-red-600 p-2"><X size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[color:var(--ds-text-muted)]">
        Der tägliche Lauf meldet nur <strong>neue</strong> Entscheidungen (Dedup pro Treffer). Voraussetzung:
        gesetztes <code className="text-[color:var(--ds-text-muted)]">CRON_SECRET</code> und ein E-Mail-Versanddienst.
      </p>
    </div>
  );
}
