"use client";

import { useEffect, useState } from "react";
import {
  Plug,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Landmark,
  FileText,
  Calendar,
  Mail,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type ConnectorStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const CONNECTOR_ICONS: Record<string, React.ElementType> = {
  "google-drive": Folder,
  "gmail": Mail,
  "notion": FileText,
  "github": FileText,
  "slack": FileText,
  "calendar": Calendar,
  "dropbox": Folder,
  "asana": FileText,
  "jira": FileText,
  "legal-judgements": Landmark,
  "bea-import": FileText,
};

const CONNECTOR_LABELS: Record<string, string> = {
  "google-drive": "Google Drive",
  "gmail": "Gmail",
  "notion": "Notion",
  "github": "GitHub",
  "slack": "Slack",
  "calendar": "Kalender",
  "dropbox": "Dropbox",
  "asana": "Asana",
  "jira": "Jira",
  "legal-judgements": "Rechtsprechung",
  "bea-import": "beA Import",
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadConnectors() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.connectors.list();
      setConnectors(res.connectors);
    } catch (e) {
      setConnectors([]);
      setError(e instanceof Error ? e.message : "Connector-Status konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnectors();
  }, []);

  async function handleSync(service: string) {
    setSyncing(service);
    setMessage(null);
    setError(null);
    try {
      await api.connectors.sync(service);
      setMessage(`Sync für ${CONNECTOR_LABELS[service] ?? service} gestartet.`);
      await loadConnectors();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Sync für ${service} fehlgeschlagen.`);
    } finally {
      setSyncing(null);
    }
  }

  async function handleToggle(service: string) {
    setToggling(service);
    setMessage(null);
    setError(null);
    try {
      const res = await api.connectors.toggle(service);
      setMessage(`${CONNECTOR_LABELS[service] ?? service} ist jetzt ${res.enabled ? "aktiviert" : "deaktiviert"}.`);
      await loadConnectors();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Status für ${service} konnte nicht geändert werden.`);
    } finally {
      setToggling(null);
    }
  }

  function lastSyncLabel(value: number | null) {
    if (!value) return "Noch nie synchronisiert";
    return `Letzter Sync: ${new Date(value).toLocaleString("de-DE")}`;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
            <Plug size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e8e8f0]">Konnektoren</h1>
            <p className="text-sm text-[#8888aa]">Externe Systeme verbinden und synchronisieren</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-400">
          Zugangsdaten werden weiterhin über die CLI eingerichtet: <code className="font-mono text-xs bg-amber-500/10 px-1.5 py-0.5 rounded">gbrain connector add &lt;service&gt;</code>. 
          Status, Aktivierung und manuelle Syncs laufen hier direkt über die Engine.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-violet-500/20 bg-violet-500/5 text-violet-400 text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
          <XCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Wird geladen">
          <Loader2 size={24} className="text-violet-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {connectors.map((c) => {
            const Icon = CONNECTOR_ICONS[c.service] || Plug;
            const label = CONNECTOR_LABELS[c.service] || c.service;
            const isLegal = c.service === "legal-judgements" || c.service === "bea-import";

            return (
              <div
                key={c.service}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl border transition-all",
                  isLegal
                    ? "border-violet-500/20 bg-violet-600/5"
                    : "border-[#1e1e3a] bg-[#0a0a18]"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border",
                  isLegal ? "bg-violet-600/10 border-violet-500/20" : "bg-[#12122a] border-[#1e1e3a]"
                )}>
                  <Icon size={18} className={isLegal ? "text-violet-400" : "text-[#8a8aa8]"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#e8e8f0]">{label}</span>
                    {isLegal && (
                      <Badge variant="default" className="text-[10px] bg-violet-600/10 border-violet-500/20 text-violet-400">
                        Kanzlei
                      </Badge>
                    )}
                    {!c.configured && (
                      <Badge variant="default" className="text-[10px] bg-[#12122a] border-[#1e1e3a] text-[#8a8aa8]">
                        Nicht eingerichtet
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#8a8aa8] mt-0.5">
                    <span className={cn("flex items-center gap-1", c.enabled ? "text-emerald-400" : "text-[#8a8aa8]")}>
                      {c.enabled ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {c.enabled ? "Aktiviert" : "Deaktiviert"}
                    </span>
                    <span className={cn("flex items-center gap-1", c.connected ? "text-emerald-400" : "text-[#8a8aa8]")}>
                      {c.connected ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {c.connected ? "Verbunden" : "Getrennt"}
                    </span>
                    <span>{lastSyncLabel(c.last_sync_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!c.configured || toggling === c.service}
                    onClick={() => handleToggle(c.service)}
                    className="text-[#8888aa] hover:text-[#e8e8f0] hover:bg-[#12122a] gap-1.5 text-xs"
                  >
                    {toggling === c.service ? <Loader2 size={12} className="animate-spin" /> : c.enabled ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                    {c.enabled ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!c.configured || !c.enabled || syncing === c.service}
                    onClick={() => handleSync(c.service)}
                    className="text-[#8888aa] hover:text-[#e8e8f0] hover:bg-[#12122a] gap-1.5 text-xs"
                  >
                    {syncing === c.service ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Sync
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLI reference */}
      <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#e8e8f0]">CLI-Kommandos</h2>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a18] border border-[#1e1e3a]">
            <span className="text-violet-400">$</span>
            <span className="text-[#8888aa]">gbrain connector add legal-judgements --query &quot;Haftung&quot; --jurisdiction at</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a18] border border-[#1e1e3a]">
            <span className="text-violet-400">$</span>
            <span className="text-[#8888aa]">gbrain connector add bea-import --watch-dir ~/Downloads/bea</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a18] border border-[#1e1e3a]">
            <span className="text-violet-400">$</span>
            <span className="text-[#8888aa]">gbrain connector sync legal-judgements</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a18] border border-[#1e1e3a]">
            <span className="text-violet-400">$</span>
            <span className="text-[#8888aa]">gbrain connector list</span>
          </div>
        </div>
      </div>
    </div>
  );
}
