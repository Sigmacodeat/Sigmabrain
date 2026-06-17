"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Copy, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
  createdBy?: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadKeys() {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      if (res.ok) setKeys(data.keys || []);
    } catch {
      setError("Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadKeys(); }, []);

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: ["read", "write"] }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKeyPlaintext(data.plaintextKey);
        setNewKeyName("");
        await loadKeys();
      } else {
        setError(data.error || "Erstellen fehlgeschlagen");
      }
    } catch {
      setError("Erstellen fehlgeschlagen");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: string) {
    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
          <Key size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--ds-text)]">API-Keys</h1>
          <p className="text-sm text-[color:var(--ds-text-muted)]">Drittanbieter-Integration (Zapier, beA, DATEV)</p>
        </div>
      </div>

      {/* Create Key */}
      <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[color:var(--ds-text)]">Neuen API-Key erstellen</h2>
        <div className="flex gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="z. B. Zapier-Integration"
            className="flex-1 bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-violet-500/50"
            onKeyDown={(e) => e.key === "Enter" && createKey()}
          />
          <Button
            variant="primary"
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
            onClick={createKey}
            disabled={creating || !newKeyName.trim()}
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Erstellen
          </Button>
        </div>

        {newKeyPlaintext && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-600">Key wird nur EINMAL angezeigt</span>
            </div>
            <div className="flex items-center gap-2 bg-[color:var(--ds-surface)] rounded-lg px-3 py-2 border border-[color:var(--ds-border)]">
              <code className="text-sm text-[color:var(--ds-text)] font-mono flex-1 break-all">{newKeyPlaintext}</code>
              <button
                onClick={() => copyKey(newKeyPlaintext)}
                className="p-1.5 rounded-lg text-[color:var(--ds-text-muted)] hover:text-violet-600 hover:bg-violet-500/10 transition-all"
              >
                {copied ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Keys List */}
      <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--ds-border)] text-[color:var(--ds-text-muted)]">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Prefix</th>
              <th className="text-left px-4 py-3 font-medium">Scopes</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Erstellt</th>
              <th className="text-right px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--ds-text-muted)]"><Loader2 size={16} className="animate-spin inline mr-2" />Lade…</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--ds-text-muted)]">Noch keine API-Keys vorhanden.</td></tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className="border-b border-[color:var(--ds-border)]/50 hover:bg-[color:var(--ds-surface)] transition-colors">
                  <td className="px-4 py-3 text-[color:var(--ds-text)]">{k.name}</td>
                  <td className="px-4 py-3 text-[color:var(--ds-text-muted)] font-mono">{k.prefix}…</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="default" className="text-[10px] bg-violet-500/10 border-violet-500/20 text-violet-600">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {k.active ? (
                      <span className="text-xs text-emerald-600">Aktiv</span>
                    ) : (
                      <span className="text-xs text-red-600">Inaktiv</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--ds-text-muted)]">{new Date(k.createdAt).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteKey(k.id)}
                      className="p-1.5 rounded-lg text-[color:var(--ds-text-muted)] hover:text-red-600 hover:bg-red-500/10 transition-all"
                      title="Löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Webhook Info */}
      <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-2">
        <h2 className="text-sm font-semibold text-[color:var(--ds-text)]">Webhook-Endpoint</h2>
        <code className="block text-xs text-[color:var(--ds-text-muted)] font-mono bg-[color:var(--ds-surface)] rounded-lg px-3 py-2 border border-[color:var(--ds-border)]">
          POST https://ihre-domain.de/api/webhook/incoming
        </code>
        <p className="text-xs text-[color:var(--ds-text-muted)]">
          Header: <code className="text-violet-600">X-API-Key: sk_live_…</code><br />
          Events: <code className="text-violet-600">case.created</code>, <code className="text-violet-600">deadline.due</code>, <code className="text-violet-600">invoice.paid</code>, <code className="text-violet-600">email.received</code>
        </p>
      </div>
    </div>
  );
}
