"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Network,
  MessageSquare,
  TrendingUp,
  Clock,
  Upload,
  ArrowRight,
  Zap,
  FileText,
  Users,
  Link2,
  Loader2,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { BrainStats, RecentQuery } from "@/lib/types";

const QUICK_ACTIONS = [
  { href: "/dashboard/upload", icon: Upload, label: "Dokument hochladen", desc: "PDF, Markdown oder Text" },
  { href: "/dashboard/query", icon: MessageSquare, label: "Brain fragen", desc: "KI-Synthese starten" },
  { href: "/dashboard/brain", icon: BookOpen, label: "Brain erkunden", desc: "Seiten & Entitäten" },
  { href: "/dashboard/graph", icon: Network, label: "Graph ansehen", desc: "Wissensstruktur" },
];

function formatStat(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function DashboardPage() {
  const [stats, setStats] = useState<BrainStats | null>(null);
  const [recent, setRecent] = useState<RecentQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineOnline, setEngineOnline] = useState(false);
  const [statutesCount, setStatutesCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, r, pages] = await Promise.all([
          api.brain.stats(),
          api.brain.recentQueries(5),
          api.brain.listPages({ limit: 300 }).catch(() => []),
        ]);
        if (!cancelled) {
          setStats(s);
          setRecent(r);
          setEngineOnline(s.total_pages > 0 || s.total_edges > 0 || s.total_queries > 0 || r.length > 0);
          const statutes = pages.filter((p) => p.type === "statute" || p.slug.startsWith("legal/statutes/") || p.slug.startsWith("law-corpus/"));
          setStatutesCount(statutes.length);
        }
      } catch {
        if (!cancelled) setEngineOnline(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const statCards = [
    { label: "Seiten", value: stats ? formatStat(stats.total_pages) : "—", icon: BookOpen, color: "violet" },
    { label: "Entitäten", value: stats ? formatStat(stats.total_entities) : "—", icon: Users, color: "blue" },
    { label: "Graph-Kanten", value: stats ? formatStat(stats.total_edges) : "—", icon: Link2, color: "emerald" },
    { label: "Queries heute", value: stats ? formatStat(stats.total_queries) : "—", icon: MessageSquare, color: "amber" },
    { label: "Gesetze", value: statutesCount > 0 ? String(statutesCount) : "—", icon: Scale, color: "emerald" },
  ];

  const gettingStarted = [
    { step: 1, done: (stats?.total_pages ?? 0) > 0, label: "Erste Akte hochladen", desc: "PDF/Dokument wird geparst, indexiert und embedded", action: "Hochladen", href: "/dashboard/upload" },
    { step: 2, done: (stats?.total_queries ?? 0) > 0, label: "Erste Frage stellen", desc: "Belegte KI-Antwort mit Fundstellen", action: "Fragen", href: "/dashboard/query" },
    { step: 3, done: (stats?.total_edges ?? 0) > 0, label: "Wissensgraph erkunden", desc: "Verbindungen zwischen Akten, Personen, Fristen", action: "Graph öffnen", href: "/dashboard/graph" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#15151d]">Dashboard</h1>
          <p className="text-sm text-[#585866] mt-0.5">
            {loading ? "Lade Brain-Status…" : engineOnline ? "Verbunden — frag dein Brain oder lade Akten hoch" : "Engine nicht erreichbar — Verbindung prüfen"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <Badge variant={engineOnline ? "success" : "warning"} className="text-xs">
              {engineOnline ? "Verbunden" : "Offline"}
            </Badge>
          )}
          <Link href="/dashboard/upload">
            <Button size="sm" variant="glow">
              <Upload size={14} /> Dokument hinzufügen
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colorMap: Record<string, string> = {
            violet: "text-violet-600 bg-violet-500/10",
            blue: "text-blue-600 bg-blue-500/10",
            emerald: "text-emerald-600 bg-emerald-500/10",
            amber: "text-amber-600 bg-amber-500/10",
          };
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[#585866] uppercase tracking-wider font-medium mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-[#15151d] font-mono">
                    {loading ? <Loader2 size={20} className="animate-spin text-[#585866]" /> : stat.value}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[stat.color]}`}>
                  <Icon size={17} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6 pb-4 border-b border-[#e2e4ec]">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-violet-600" />
                <h2 className="text-sm font-semibold text-[#15151d]">Erste Schritte</h2>
              </div>
            </div>
            <div className="divide-y divide-[#e2e4ec]">
              {gettingStarted.map((item) => (
                <div key={item.step} className="flex items-center gap-4 p-4 hover:bg-[#eceef3] transition-colors">
                  <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                    item.done
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                      : "bg-[#e2e4ec] border-[#b4b9c8] text-[#585866]"
                  }`}>
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.done ? "line-through text-[#585866]" : "text-[#15151d]"}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-[#585866] font-mono mt-0.5">{item.desc}</p>
                  </div>
                  <Link href={item.href}>
                    <Button variant="ghost" size="sm" className="shrink-0 text-violet-600 hover:text-violet-700">
                      {item.action} <ArrowRight size={12} />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="p-4 pb-3 border-b border-[#e2e4ec]">
              <h2 className="text-sm font-semibold text-[#15151d]">Schnellzugriff</h2>
            </div>
            <div className="p-3 space-y-1">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#eceef3] transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#15151d] group-hover:text-violet-700 transition-colors">{action.label}</p>
                      <p className="text-xs text-[#585866]">{action.desc}</p>
                    </div>
                    <ArrowRight size={12} className="text-[#585866] group-hover:text-violet-600 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="border-amber-500/20">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-amber-600" />
                <span className="text-sm font-semibold text-[#15151d]">Dream Cycle</span>
                <Badge variant="warning" className="ml-auto text-xs">Inaktiv</Badge>
              </div>
              <p className="text-xs text-[#585866] leading-relaxed mb-4">
                Der Dream Cycle läuft nachts und konsolidiert dein Wissen, fixiert Zitate und findet Widersprüche.
              </p>
              <Link href="/dashboard/settings">
                <Button variant="outline" size="sm" className="w-full text-amber-600 border-amber-500/30 hover:bg-amber-500/10">
                  Dream Cycle einrichten
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <div className="p-4 pb-3 border-b border-[#e2e4ec]">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#585866]" />
                <h2 className="text-sm font-semibold text-[#15151d]">Letzte Aktivität</h2>
              </div>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={20} className="animate-spin text-[#585866]" />
              </div>
            ) : recent.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={24} className="text-[#e2e4ec] mx-auto mb-2" />
                <p className="text-sm text-[#585866]">Noch keine Aktivität</p>
                <p className="text-xs text-[#585866] mt-1">Lade ein Dokument hoch um zu starten</p>
              </div>
            ) : (
              <div className="divide-y divide-[#e2e4ec]">
                {recent.map((q) => (
                  <div key={q.id} className="px-4 py-3">
                    <p className="text-sm text-[#15151d] truncate">{q.query}</p>
                    <p className="text-xs text-[#585866] font-mono mt-0.5">
                      {new Date(q.created_at).toLocaleString("de-DE")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
