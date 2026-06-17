"use client";

import { useEffect, useState } from "react";
import {
  FileSignature,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PenTool,
  Settings,
  ExternalLink,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface SignatureRequest {
  id: string;
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  status: "draft" | "sent" | "signed" | "declined" | "expired";
  sentAt?: string;
  signedAt?: string;
  expiresAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; iconClass: string; badgeClass: string; tileClass: string }> = {
  draft: {
    label: "Entwurf",
    icon: PenTool,
    iconClass: "text-gray-400",
    badgeClass: "bg-gray-500/5 border-gray-500/20 text-gray-400",
    tileClass: "bg-gray-500/10",
  },
  sent: {
    label: "Versendet",
    icon: Send,
    iconClass: "text-blue-600",
    badgeClass: "bg-blue-500/5 border-blue-500/20 text-blue-600",
    tileClass: "bg-blue-500/10",
  },
  signed: {
    label: "Unterschrieben",
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    badgeClass: "bg-emerald-500/5 border-emerald-500/20 text-emerald-600",
    tileClass: "bg-emerald-500/10",
  },
  declined: {
    label: "Abgelehnt",
    icon: XCircle,
    iconClass: "text-red-600",
    badgeClass: "bg-red-500/5 border-red-500/20 text-red-600",
    tileClass: "bg-red-500/10",
  },
  expired: {
    label: "Abgelaufen",
    icon: Clock,
    iconClass: "text-amber-600",
    badgeClass: "bg-amber-500/5 border-amber-500/20 text-amber-600",
    tileClass: "bg-amber-500/10",
  },
};

export default function SignaturePage() {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    documentName: "",
    recipientName: "",
    recipientEmail: "",
    expiresDays: "14",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pages = await api.brain.listPages({ type: "signature_request", limit: 100 });
        if (cancelled) return;
        setRequests(pages.map((p) => {
          const fm = (p.frontmatter ?? {}) as Record<string, unknown>;
          return {
            id: p.slug,
            documentName: String(fm.document_name ?? p.title),
            recipientName: String(fm.recipient_name ?? "—"),
            recipientEmail: String(fm.recipient_email ?? "—"),
            status: String(fm.status ?? "draft") as SignatureRequest["status"],
            sentAt: fm.sent_at ? String(fm.sent_at) : undefined,
            signedAt: fm.signed_at ? String(fm.signed_at) : undefined,
            expiresAt: String(fm.expires_at ?? p.created_at),
          };
        }));
      } catch {
        setNotice("Signatur-Anfragen konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function createRequest() {
    if (!form.documentName.trim() || !form.recipientEmail.trim()) return;
    setSaving(true);
    setNotice(null);
    const now = new Date();
    const slug = `legal/signatures/${now.toISOString().split("T")[0]}-${form.documentName.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").slice(0, 60)}`;
    const req: SignatureRequest = {
      id: slug,
      documentName: form.documentName,
      recipientName: form.recipientName,
      recipientEmail: form.recipientEmail,
      status: "draft",
      expiresAt: new Date(Date.now() + parseInt(form.expiresDays) * 86400000).toISOString(),
    };
    try {
      await api.brain.createPage({
        slug,
        title: `Signatur: ${form.documentName.trim()}`,
        type: "signature_request",
        content: `Empfänger: ${form.recipientName} <${form.recipientEmail}>`,
        frontmatter: {
          type: "signature_request",
          document_name: form.documentName.trim(),
          recipient_name: form.recipientName.trim(),
          recipient_email: form.recipientEmail.trim(),
          status: "draft",
          expires_at: req.expiresAt,
          created_at: now.toISOString(),
          provider: "external",
        },
      });
      setRequests([req, ...requests]);
      setForm({ documentName: "", recipientName: "", recipientEmail: "", expiresDays: "14" });
      setShowCreate(false);
      setNotice("Signatur-Entwurf im Brain gespeichert.");
    } catch (e) {
      setNotice(e instanceof Error ? `Speichern fehlgeschlagen: ${e.message}` : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function markPrepared(req: SignatureRequest) {
    const sentAt = new Date().toISOString();
    const updated = { ...req, status: "sent" as const, sentAt };
    setRequests(requests.map((r) => r.id === req.id ? updated : r));
    try {
      await api.brain.updatePage({
        slug: req.id,
        frontmatter: {
          type: "signature_request",
          document_name: req.documentName,
          recipient_name: req.recipientName,
          recipient_email: req.recipientEmail,
          status: "sent",
          sent_at: sentAt,
          expires_at: req.expiresAt,
          provider: "external",
        },
      });
      setNotice("Als extern versendet markiert. Der tatsächliche Versand erfolgt im Signatur-Provider.");
    } catch (e) {
      setNotice(e instanceof Error ? `Status konnte nicht gespeichert werden: ${e.message}` : "Status konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center">
            <FileSignature size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[color:var(--ds-text)]">e-Signatur</h1>
            <p className="text-sm text-[color:var(--ds-text-muted)]">Dokumente digital unterschreiben lassen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/settings"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-600 hover:bg-amber-500/10 transition-all"
          >
            <Settings size={14} />
            Anbieter konfigurieren
          </a>
          <Button
            variant="primary"
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 text-sm"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? <XCircle size={14} /> : <Plus size={14} />}
            {showCreate ? "Abbrechen" : "Unterschrift anfordern"}
          </Button>
        </div>
      </div>

      {/* Setup hint */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-600 font-medium">Externer Signatur-Provider erforderlich</p>
            <p className="text-xs text-[color:var(--ds-text-muted)] mt-1">
              Sigmabrain speichert Signatur-Anfragen revisionsfähig im Brain und verfolgt Status.
              Der rechtlich wirksame Versand erfolgt über einen Anbieter wie{" "}
              <a href="https://developers.docusign.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Docusign</a>
              {" "}oder ein Kanzlei-Signaturportal. Kein Demo-Versand wird vorgetäuscht.
            </p>
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-700" role="status">
          {notice}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-indigo-600">Unterschriften-Anfrage erstellen</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">Dokument</label>
              <input
                value={form.documentName}
                onChange={(e) => setForm({ ...form, documentName: e.target.value })}
                placeholder="z.B. Mandatsvereinbarung Muster GmbH"
                className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">Empfänger-Name</label>
              <input
                value={form.recipientName}
                onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                placeholder="Max Mustermann"
                className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">E-Mail</label>
              <input
                type="email"
                value={form.recipientEmail}
                onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })}
                placeholder="max@example.com"
                className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">Gültigkeit (Tage)</label>
              <input
                type="number"
                value={form.expiresDays}
                onChange={(e) => setForm({ ...form, expiresDays: e.target.value })}
                className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 text-sm"
              onClick={createRequest}
              disabled={saving || !form.documentName.trim() || !form.recipientEmail.trim()}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}
              Entwurf speichern
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <FileSignature size={48} className="mx-auto text-[color:var(--ds-border)]" />
          <div>
            <p className="text-[color:var(--ds-text-muted)]">Noch keine Unterschriften-Anfragen.</p>
            <p className="text-[color:var(--ds-text-muted)] text-sm mt-1">
              Erstelle eine Anfrage, um Dokumente digital unterschreiben zu lassen.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const cfg = STATUS_CONFIG[req.status];
            const Icon = cfg.icon;
            return (
              <div
                key={req.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] hover:border-indigo-500/30 transition-all"
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", cfg.tileClass)}>
                  <Icon size={18} className={cfg.iconClass} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[color:var(--ds-text)]">{req.documentName}</span>
                    <Badge variant="default" className={cn("text-[10px] border", cfg.badgeClass)}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-[color:var(--ds-text-muted)] mt-0.5">
                    {req.recipientName} · {req.recipientEmail} · Gültig bis {new Date(req.expiresAt).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
	                  {req.status === "draft" && (
	                    <button
	                      onClick={() => markPrepared(req)}
	                      className="p-2 rounded-lg text-[color:var(--ds-text-muted)] hover:text-indigo-600 hover:bg-indigo-500/10 transition-all"
	                      title="Als extern versendet markieren"
	                    >
	                      <Send size={14} />
	                    </button>
	                  )}
	                  <a
	                    href={`/dashboard/brain/${encodeURIComponent(req.id)}`}
	                    className="p-2 rounded-lg text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text-muted)] hover:bg-[color:var(--ds-hover)] transition-all"
	                    title="Brain-Seite öffnen"
	                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
