"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  ArrowLeft,
  Loader2,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { enqueueMutation, isOnline } from "@/lib/offline-store";
import type { BrainPage } from "@/lib/types";
import type { ContactFrontmatter } from "@/lib/legal-types";

const STATUS_OPTIONS = [
  { value: "open", label: "Offen" },
  { value: "pending", label: "Anhängig" },
  { value: "settled", label: "Erledigt" },
  { value: "won", label: "Gewonnen" },
  { value: "lost", label: "Verloren" },
  { value: "appealed", label: "Berufung" },
  { value: "dormant", label: "Ruhend" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
  { value: "critical", label: "Kritisch" },
];

type ContactRole = NonNullable<ContactFrontmatter["role"]>;

interface ContactOption {
  slug: string;
  name: string;
  role: ContactRole;
}

function contactOptions(pages: BrainPage[]): ContactOption[] {
  return pages.map((p) => {
    const fm = (p.frontmatter ?? {}) as ContactFrontmatter;
    return {
      slug: p.slug,
      name: fm.name || p.title,
      role: fm.role || "other",
    };
  });
}

export default function NewCasePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  const [title, setTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [legalArea, setLegalArea] = useState("");
  const [subArea, setSubArea] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("medium");
  const [clientName, setClientName] = useState("");
  const [clientSlug, setClientSlug] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [opponentSlug, setOpponentSlug] = useState("");
  const [courtName, setCourtName] = useState("");
  const [courtSlug, setCourtSlug] = useState("");
  const [lawyerName, setLawyerName] = useState("");
  const [lawyerSlug, setLawyerSlug] = useState("");
  const [facts, setFacts] = useState("");
  const [tags, setTags] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.brain.listPages({ type: "legal_contact", limit: 500 })
      .then((pages) => { if (!cancelled) setContacts(contactOptions(pages)); })
      .catch(() => { if (!cancelled) setContacts([]); });
    return () => { cancelled = true; };
  }, []);

  const clients = contacts.filter((c) => c.role === "client");
  const opponents = contacts.filter((c) => c.role === "opponent");
  const courts = contacts.filter((c) => c.role === "court");
  const lawyers = contacts.filter((c) => c.role === "lawyer");

  function applyContact(slug: string, role: ContactRole) {
    const contact = contacts.find((c) => c.slug === slug);
    const name = contact?.name ?? "";
    if (role === "client") {
      setClientSlug(slug);
      if (name) setClientName(name);
    } else if (role === "opponent") {
      setOpponentSlug(slug);
      if (name) setOpponentName(name);
    } else if (role === "court") {
      setCourtSlug(slug);
      if (name) setCourtName(name);
    } else if (role === "lawyer") {
      setLawyerSlug(slug);
      if (name) setLawyerName(name);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Titel ist erforderlich");
      return;
    }
    setSaving(true);
    setError(null);

    const slug = `legal/cases/${caseNumber.trim() || Date.now().toString(36)}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    try {
      const pagePayload = {
        slug,
        title,
        type: "legal_case",
        content: facts,
        frontmatter: {
          case_number: caseNumber.trim() || slug.split("/").pop(),
          legal_area: legalArea,
          sub_area: subArea,
          status,
          priority,
          client_name: clientName,
          client_slug: clientSlug || undefined,
          opponent_name: opponentName,
          opponent_slugs: opponentSlug ? [opponentSlug] : undefined,
          court_name: courtName,
          court_slug: courtSlug || undefined,
          own_lawyer_name: lawyerName,
          own_lawyer_slug: lawyerSlug || undefined,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          portal_enabled: portalEnabled,
          version: 0,
        },
      };
      if (isOnline()) {
        await api.brain.createPage(pagePayload);
      } else {
        await enqueueMutation({ type: "createPage", payload: pagePayload });
      }
      router.push(`/dashboard/cases/${encodeURIComponent(slug)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Erstellen der Akte");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard/cases" aria-label="Zurück zur Aktenliste" className="text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)] transition-colors">
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <div className="w-8 h-8 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
          <Briefcase size={16} className="text-violet-600" />
        </div>
        <h1 className="text-lg font-bold text-[color:var(--ds-text)]">Neue Akte</h1>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-600 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[color:var(--ds-text)]">Grunddaten</h2>

          <div>
            <label htmlFor="case-title" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Titel *</label>
            <Input
              id="case-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Musterfall GmbH vs. Schuldner AG"
              className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="case-number" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Aktenzeichen</label>
              <Input
                id="case-number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="z.B. 2026-001"
                className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
              />
            </div>
            <div>
              <label htmlFor="case-status" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Status</label>
              <select
                id="case-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="case-legal-area" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Rechtsgebiet</label>
              <Input
                id="case-legal-area"
                value={legalArea}
                onChange={(e) => setLegalArea(e.target.value)}
                placeholder="z.B. Zivilrecht"
                className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
              />
            </div>
            <div>
              <label htmlFor="case-sub-area" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Untergebiet</label>
              <Input
                id="case-sub-area"
                value={subArea}
                onChange={(e) => setSubArea(e.target.value)}
                placeholder="z.B. Vertragsrecht"
                className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
              />
            </div>
          </div>

          <div>
            <span id="case-priority-label" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Priorität</span>
            <div className="flex gap-2" role="group" aria-labelledby="case-priority-label">
              {PRIORITY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPriority(o.value)}
                  aria-pressed={priority === o.value}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                    priority === o.value
                      ? o.value === "critical"
                        ? "bg-red-500/10 border-red-500/30 text-red-600"
                        : o.value === "high"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                        : o.value === "low"
                        ? "bg-gray-500/10 border-gray-500/30 text-gray-400"
                        : "bg-blue-500/10 border-blue-500/30 text-blue-600"
                      : "bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text-muted)]"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[color:var(--ds-text)]">Beteiligte</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="case-client" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Mandant</label>
              <Input
                id="case-client"
                value={clientName}
                onChange={(e) => { setClientName(e.target.value); if (clientSlug) setClientSlug(""); }}
                placeholder="Name des Mandanten"
                className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
              />
              {clients.length > 0 && (
                <select
                  value={clientSlug}
                  onChange={(e) => applyContact(e.target.value, "client")}
                  className="mt-2 w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-xs text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
                >
                  <option value="">Kontakt verknüpfen…</option>
                  {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label htmlFor="case-opponent" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Gegner</label>
              <Input
                id="case-opponent"
                value={opponentName}
                onChange={(e) => { setOpponentName(e.target.value); if (opponentSlug) setOpponentSlug(""); }}
                placeholder="Name der Gegenseite"
                className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
              />
              {opponents.length > 0 && (
                <select
                  value={opponentSlug}
                  onChange={(e) => applyContact(e.target.value, "opponent")}
                  className="mt-2 w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-xs text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
                >
                  <option value="">Kontakt verknüpfen…</option>
                  {opponents.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="case-court" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Gericht</label>
              <Input
                id="case-court"
                value={courtName}
                onChange={(e) => { setCourtName(e.target.value); if (courtSlug) setCourtSlug(""); }}
                placeholder="z.B. LG Wien"
                className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
              />
              {courts.length > 0 && (
                <select
                  value={courtSlug}
                  onChange={(e) => applyContact(e.target.value, "court")}
                  className="mt-2 w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-xs text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
                >
                  <option value="">Kontakt verknüpfen…</option>
                  {courts.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label htmlFor="case-lawyer" className="block text-xs text-[color:var(--ds-text-muted)] mb-1.5">Zuständiger Anwalt</label>
              <Input
                id="case-lawyer"
                value={lawyerName}
                onChange={(e) => { setLawyerName(e.target.value); if (lawyerSlug) setLawyerSlug(""); }}
                placeholder="Name des Anwalts"
                className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
              />
              {lawyers.length > 0 && (
                <select
                  value={lawyerSlug}
                  onChange={(e) => applyContact(e.target.value, "lawyer")}
                  className="mt-2 w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-xs text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
                >
                  <option value="">Kontakt verknüpfen…</option>
                  {lawyers.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Facts */}
        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[color:var(--ds-text)]"><label htmlFor="case-facts">Sachverhalt</label></h2>
          <textarea
            id="case-facts"
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            rows={6}
            placeholder="Beschreibe den Sachverhalt…"
            className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2.5 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-violet-500/50 resize-y"
          />
        </div>

        {/* Tags */}
        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[color:var(--ds-text)]"><label htmlFor="case-tags">Tags</label></h2>
          <Input
            id="case-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Komma-getrennte Tags: z.B. Vertragsbruch, Schadensersatz"
            className="bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
          />
        </div>

        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={portalEnabled}
              onChange={(e) => setPortalEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-[color:var(--ds-text)]">Für Mandantenportal-Vorschau freigeben</span>
              <span className="block text-xs text-[color:var(--ds-text-muted)] mt-0.5">
                Nur freigegebene Akten erscheinen in der Portal-Vorschau. Ein echter Mandantenlogin bleibt ein separates Deployment.
              </span>
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/dashboard/cases">
            <Button type="button" variant="ghost" className="text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)]">
              Abbrechen
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Akte erstellen
          </Button>
        </div>
      </form>
    </div>
  );
}
