"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { caseFrontmatter } from "@/lib/legal-types";
import type { TimeEntry, ExpenseEntry } from "@/lib/legal-types";
import { BarChart3, Clock, Euro, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LawyerStats {
  name: string;
  totalHours: number;
  totalRevenue: number;
  caseCount: number;
  billedHours: number;
  targetHours: number;
}

export default function ControllingPage() {
  const [stats, setStats] = useState<LawyerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  useEffect(() => {
    async function load() {
      try {
        const pages = await api.brain.listPages({ type: "legal_case", limit: 500 });
        const lawyerMap = new Map<string, LawyerStats>();

        pages.forEach((p) => {
          const fm = caseFrontmatter(p);
          const lawyer = fm.own_lawyer_name || "Unbekannt";
          if (!lawyerMap.has(lawyer)) {
            lawyerMap.set(lawyer, {
              name: lawyer,
              totalHours: 0,
              totalRevenue: 0,
              caseCount: 0,
              billedHours: 0,
              targetHours: 150, // Standard-Ziel pro Monat
            });
          }
          const s = lawyerMap.get(lawyer)!;
          s.caseCount += 1;

          const entries = (fm.time_entries || []) as TimeEntry[];
          entries.forEach((entry) => {
            if (!entry.date) return;
            const d = new Date(entry.date);
            const now = new Date();
            const match =
              period === "month"
                ? d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                : period === "quarter"
                ? Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear()
                : d.getFullYear() === now.getFullYear();
            if (!match) return;

            const hours = (entry.minutes || 0) / 60;
            s.totalHours += hours;
            if (entry.billed) s.billedHours += hours;
            s.totalRevenue += hours * (entry.rate || 200);
          });
        });

        setStats(Array.from(lawyerMap.values()));
      } catch (e) {
        console.error("[controlling] load failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period]);

  const totalRevenue = stats.reduce((s, l) => s + l.totalRevenue, 0);
  const totalHours = stats.reduce((s, l) => s + l.totalHours, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8e8f0]">Leistungscontrolling</h1>
          <p className="text-sm text-[#8888aa]">Übersicht über Anwälte, Stunden und Umsatz</p>
        </div>
        <div className="flex gap-2">
          {(["month", "quarter", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  : "bg-[#12122a] text-[#8888aa] border border-[#1e1e3a] hover:border-[#3a3a6a]"
              }`}
            >
              {p === "month" ? "Monat" : p === "quarter" ? "Quartal" : "Jahr"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[#8888aa]">Lade Daten …</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4">
              <div className="flex items-center gap-2 text-[#8888aa] mb-2">
                <Users size={14} />
                <span className="text-xs">Anwälte</span>
              </div>
              <div className="text-2xl font-semibold text-[#e8e8f0]">{stats.length}</div>
            </div>
            <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4">
              <div className="flex items-center gap-2 text-[#8888aa] mb-2">
                <Clock size={14} />
                <span className="text-xs">Gesamtstunden</span>
              </div>
              <div className="text-2xl font-semibold text-[#e8e8f0]">{totalHours.toFixed(1)} h</div>
            </div>
            <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4">
              <div className="flex items-center gap-2 text-[#8888aa] mb-2">
                <Euro size={14} />
                <span className="text-xs">Gesamtumsatz</span>
              </div>
              <div className="text-2xl font-semibold text-emerald-400">{totalRevenue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div>
            </div>
            <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4">
              <div className="flex items-center gap-2 text-[#8888aa] mb-2">
                <TrendingUp size={14} />
                <span className="text-xs">Ø Stundensatz</span>
              </div>
              <div className="text-2xl font-semibold text-[#e8e8f0]">
                {totalHours > 0 ? Math.round(totalRevenue / totalHours) : 0} €
              </div>
            </div>
          </div>

          {/* Lawyer Table */}
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e3a] text-[#8888aa]">
                  <th className="text-left px-4 py-3 font-medium">Anwalt</th>
                  <th className="text-right px-4 py-3 font-medium">Akten</th>
                  <th className="text-right px-4 py-3 font-medium">Stunden</th>
                  <th className="text-right px-4 py-3 font-medium">Abrechenbar</th>
                  <th className="text-right px-4 py-3 font-medium">Auslastung</th>
                  <th className="text-right px-4 py-3 font-medium">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const utilization = Math.min(100, Math.round((s.totalHours / s.targetHours) * 100));
                  return (
                    <tr key={s.name} className="border-b border-[#1e1e3a]/50 hover:bg-[#0a0a18] transition-colors">
                      <td className="px-4 py-3 text-[#e8e8f0]">{s.name}</td>
                      <td className="px-4 py-3 text-right text-[#8888aa]">{s.caseCount}</td>
                      <td className="px-4 py-3 text-right text-[#e8e8f0]">{s.totalHours.toFixed(1)} h</td>
                      <td className="px-4 py-3 text-right text-[#e8e8f0]">{s.billedHours.toFixed(1)} h</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-[#1e1e3a] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                utilization >= 80 ? "bg-emerald-400" : utilization >= 50 ? "bg-amber-400" : "bg-red-400"
                              }`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#8888aa]">{utilization}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-400">
                        {s.totalRevenue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
