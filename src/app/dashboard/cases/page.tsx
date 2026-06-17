"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Search,
  Loader2,
  ChevronRight,
  Calendar,
  Users,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { BrainPage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_TEXT, type StatusColor } from "@/lib/status-colors";
import { caseFrontmatter } from "@/lib/legal-types";
import { OFFLINE_KEYS, enqueueMutation, getCache, isOnline, setCache } from "@/lib/offline-store";

interface LegalCaseItem {
  slug: string;
  title: string;
  caseNumber: string;
  status: string;
  legalArea: string;
  priority: string;
  opponentName?: string;
  clientName?: string;
  courtName?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: StatusColor }> = {
  open: { label: "Offen", icon: Clock, color: "blue" },
  pending: { label: "Anhängig", icon: PauseCircle, color: "amber" },
  settled: { label: "Erledigt", icon: CheckCircle2, color: "emerald" },
  won: { label: "Gewonnen", icon: CheckCircle2, color: "emerald" },
  lost: { label: "Verloren", icon: XCircle, color: "red" },
  appealed: { label: "Berufung", icon: AlertTriangle, color: "orange" },
  dormant: { label: "Ruhend", icon: PauseCircle, color: "gray" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

function parseCase(page: BrainPage): LegalCaseItem {
  const fm = caseFrontmatter(page);
  return {
    slug: page.slug,
    title: page.title,
    caseNumber: fm.case_number || page.slug,
    status: fm.status || "open",
    legalArea: fm.legal_area || "",
    priority: fm.priority || "medium",
    opponentName: fm.opponent_name || undefined,
    clientName: fm.client_name || undefined,
    courtName: fm.court_name || undefined,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    tags: fm.tags || [],
  };
}

export default function CasesPage() {
  const [cases, setCases] = useState<LegalCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pages = await api.brain.listPages({ type: "legal_case", limit: 200 });
        if (cancelled) return;
        const items = pages.map(parseCase).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        await setCache(OFFLINE_KEYS.cases, items);
        setCases(items);
      } catch (err) {
        const cached = await getCache<LegalCaseItem[]>(OFFLINE_KEYS.cases);
        if (!cancelled && cached) {
          setCases(cached);
          setLoadError("Cloud-Brain gerade nicht erreichbar. Es werden zwischengespeicherte Akten angezeigt.");
        } else if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Akten konnten nicht geladen werden.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function deleteCase(slug: string) {
    if (!confirm("Akte wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    try {
      if (isOnline()) {
        await api.brain.deletePage(slug);
      } else {
        await enqueueMutation({ type: "deletePage", payload: { slug } });
      }
      const next = cases.filter((c) => c.slug !== slug);
      setCases(next);
      await setCache(OFFLINE_KEYS.cases, next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  const filtered = cases.filter((c) => {
    const matchesSearch =
      search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.legalArea.toLowerCase().includes(search.toLowerCase()) ||
      (c.opponentName || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = cases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <Briefcase size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#15151d]">Akten</h1>
            <p className="text-sm text-[#585866]">{cases.length} Akten im Brain</p>
          </div>
        </div>
        <Link href="/dashboard/cases/new">
          <Button className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
            <Plus size={16} />
            Neue Akte
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = statusCounts[key] || 0;
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                statusFilter === key
                  ? "bg-violet-600/10 border-violet-500/30"
                  : "bg-[#ffffff] border-[#e2e4ec] hover:border-[#2a2a4a]"
              )}
            >
              <Icon size={18} className={cn("shrink-0", STATUS_TEXT[cfg.color])} aria-hidden="true" />
              <div>
                <div className="text-lg font-bold text-[#15151d]">{count}</div>
                <div className="text-xs text-[#585866]">{cfg.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#585866]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Akten suchen…"
            aria-label="Akten suchen"
            className="pl-9 bg-[#ffffff] border-[#e2e4ec] text-[#15151d] placeholder:text-[#585866] focus:border-violet-500/50"
          />
        </div>
        {statusFilter !== "all" && (
          <Badge
            variant="default"
            className="cursor-pointer bg-violet-600/10 border border-violet-500/30 text-violet-400"
            onClick={() => setStatusFilter("all")}
          >
            {STATUS_CONFIG[statusFilter]?.label} ×
          </Badge>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Wird geladen">
          <Loader2 size={24} className="text-violet-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Briefcase size={48} className="mx-auto text-[#e2e4ec]" />
          <div>
            <p className="text-[#585866] text-lg">Keine Akten gefunden</p>
            <p className="text-[#585866] text-sm mt-1">
              {cases.length === 0
                ? "Erstelle deine erste Akte oder importiere bestehende Fälle."
                : "Passe deine Filter an."}
            </p>
          </div>
          {cases.length === 0 && (
            <Link href="/dashboard/cases/new">
              <Button className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
                <Plus size={16} />
                Neue Akte
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={c.slug}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#e2e4ec] bg-[#ffffff] hover:border-violet-500/30 hover:bg-violet-600/5 transition-all group"
              >
                <Link href={`/dashboard/cases/${encodeURIComponent(c.slug)}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#eceef3] border border-[#e2e4ec] flex items-center justify-center shrink-0">
                    <StatusIcon size={18} className={STATUS_TEXT[statusCfg.color]} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#15151d] truncate">{c.title}</span>
                      <Badge variant="default" className={cn("text-[10px] border", PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.medium)}>
                        {c.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#585866] mt-0.5">
                      <span className="font-mono">{c.caseNumber}</span>
                      {c.legalArea && <span className="flex items-center gap-1"><Scale size={10} />{c.legalArea}</span>}
                      {c.opponentName && <span className="flex items-center gap-1"><Users size={10} />{c.opponentName}</span>}
                      {c.courtName && <span className="flex items-center gap-1"><Briefcase size={10} />{c.courtName}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-[#585866]">
                      <Calendar size={10} className="inline mr-1" />
                      {new Date(c.updatedAt).toLocaleDateString("de-DE")}
                    </div>
                    <Badge variant="default" className="text-[10px] mt-1 bg-[#eceef3] border border-[#e2e4ec] text-[#585866]">
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <ChevronRight size={16} className="text-[#585866] group-hover:text-violet-400 transition-colors shrink-0" />
                </Link>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCase(c.slug); }}
                  className="p-1.5 rounded-lg text-[#585866] hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                  title="Akte löschen"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
