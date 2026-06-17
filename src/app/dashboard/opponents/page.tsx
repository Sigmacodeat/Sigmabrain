"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { caseFrontmatter } from "@/lib/legal-types";

interface OpponentStats {
  name: string;
  caseCount: number;
  wins: number;
  losses: number;
  settlements: number;
  winRate: number;
  settlementRate: number;
  avgCaseValue?: number;
  preferredAreas: string[];
  recentCases: Array<{ slug: string; title: string; status: string; date: string }>;
}

export default function OpponentsPage() {
  const [opponents, setOpponents] = useState<OpponentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pages = await api.brain.listPages({ type: "legal_case", limit: 200 });
        if (cancelled) return;

        // Aggregate opponent data from cases
        const opponentMap: Record<string, OpponentStats> = {};

        for (const page of pages) {
          const fm = caseFrontmatter(page);
          const opponentName = fm.opponent_name;
          if (!opponentName) continue;

          if (!opponentMap[opponentName]) {
            opponentMap[opponentName] = {
              name: opponentName,
              caseCount: 0,
              wins: 0,
              losses: 0,
              settlements: 0,
              winRate: 0,
              settlementRate: 0,
              preferredAreas: [],
              recentCases: [],
            };
          }

          const stats = opponentMap[opponentName];
          stats.caseCount++;

          const status = fm.status || "open";
          if (status === "won") stats.wins++;
          else if (status === "lost") stats.losses++;
          else if (status === "settled") stats.settlements++;

          if (fm.legal_area && !stats.preferredAreas.includes(fm.legal_area)) {
            stats.preferredAreas.push(fm.legal_area);
          }

          stats.recentCases.push({
            slug: page.slug,
            title: page.title,
            status,
            date: page.updated_at,
          });
        }

        // Calculate rates and sort
        for (const stats of Object.values(opponentMap)) {
          const decided = stats.wins + stats.losses;
          stats.winRate = decided > 0 ? stats.wins / decided : 0;
          stats.settlementRate = stats.caseCount > 0 ? stats.settlements / stats.caseCount : 0;
          stats.recentCases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        setOpponents(Object.values(opponentMap).sort((a, b) => b.caseCount - a.caseCount));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Daten konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-600/15 border border-red-500/20 flex items-center justify-center">
          <ShieldAlert size={20} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#15151d]">Gegner-Analyse</h1>
          <p className="text-sm text-[#585866]">Intelligence über Gegner aus allen Akten</p>
        </div>
      </div>

      {/* Stats summary */}
      {opponents.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
            <div className="text-xs text-[#585866]">Gegner gesamt</div>
            <div className="text-xl font-bold text-[#15151d]">{opponents.length}</div>
          </div>
          <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
            <div className="text-xs text-[#585866]">Häufigster Gegner</div>
            <div className="text-sm font-bold text-[#15151d] truncate">{opponents[0]?.name}</div>
          </div>
          <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
            <div className="text-xs text-[#585866]">Gesamt-Akten</div>
            <div className="text-xl font-bold text-[#15151d]">{opponents.reduce((s, o) => s + o.caseCount, 0)}</div>
          </div>
          <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
            <div className="text-xs text-[#585866]">Gewonnen</div>
            <div className="text-xl font-bold text-emerald-400">{opponents.reduce((s, o) => s + o.wins, 0)}</div>
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {/* Opponent list */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Wird geladen">
          <Loader2 size={24} className="text-violet-400 animate-spin" />
        </div>
      ) : opponents.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <ShieldAlert size={48} className="mx-auto text-[#e2e4ec]" />
          <p className="text-[#585866]">Noch keine Gegner in den Akten erfasst.</p>
          <p className="text-[#585866] text-sm">Füge Gegner bei der Akten-Erstellung hinzu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {selectedOpponent ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedOpponent(null)}
                className="text-sm text-[#585866] hover:text-[#15151d] transition-colors"
              >
                ← Zurück zur Übersicht
              </button>

              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                <h2 className="text-lg font-bold text-[#15151d]">{selectedOpponent.name}</h2>
                <div className="flex items-center gap-3 text-sm text-[#585866] mt-1">
                  <span>{selectedOpponent.caseCount} Akten</span>
                  <span className={selectedOpponent.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"}>
                    {Math.round(selectedOpponent.winRate * 100)}% Siegquote
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <div className="text-xl font-bold text-emerald-400">{selectedOpponent.wins}</div>
                  <div className="text-xs text-[#585866]">Gewonnen</div>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{selectedOpponent.losses}</div>
                  <div className="text-xs text-[#585866]">Verloren</div>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                  <div className="text-xl font-bold text-blue-400">{selectedOpponent.settlements}</div>
                  <div className="text-xs text-[#585866]">Erledigt</div>
                </div>
              </div>

              {selectedOpponent.preferredAreas.length > 0 && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                  <h3 className="text-sm font-semibold text-[#15151d] mb-2">Rechtsgebiete</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOpponent.preferredAreas.map((area) => (
                      <Badge key={area} variant="default" className="text-[10px] bg-violet-600/5 border-violet-500/10 text-violet-400">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                <h3 className="text-sm font-semibold text-[#15151d] mb-2">Akten</h3>
                <div className="space-y-2">
                  {selectedOpponent.recentCases.map((c) => {
                    const statusColor =
                      c.status === "won" ? "text-emerald-400" :
                      c.status === "lost" ? "text-red-400" :
                      c.status === "settled" ? "text-blue-400" :
                      "text-amber-400";
                    return (
                      <Link
                        key={c.slug}
                        href={`/dashboard/cases/${encodeURIComponent(c.slug)}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#eceef3] transition-colors group"
                      >
                        <span className="text-sm text-[#15151d]">{c.title}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${statusColor}`}>
                            {c.status === "won" ? "Gewonnen" : c.status === "lost" ? "Verloren" : c.status === "settled" ? "Erledigt" : c.status}
                          </span>
                          <ChevronRight size={12} className="text-[#585866] group-hover:text-violet-400" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {opponents.map((o) => (
                <button
                  key={o.name}
                  onClick={() => setSelectedOpponent(o)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-[#e2e4ec] bg-[#ffffff] hover:border-violet-500/30 hover:bg-violet-600/5 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#eceef3] border border-[#e2e4ec] flex items-center justify-center shrink-0">
                    <ShieldAlert size={18} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#15151d]">{o.name}</div>
                    <div className="text-xs text-[#585866]">
                      {o.caseCount} Akten · {o.preferredAreas.slice(0, 2).join(", ")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn("text-sm font-medium", o.winRate >= 0.5 ? "text-emerald-400" : "text-red-400")}>
                      {Math.round(o.winRate * 100)}%
                    </div>
                    <div className="text-xs text-[#585866]">Siegquote</div>
                  </div>
                  <ChevronRight size={16} className="text-[#585866] group-hover:text-violet-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
