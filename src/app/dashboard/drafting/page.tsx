"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Loader2,
  Send,
  Copy,
  Check,
  BookOpen,
  Scale,
  PenTool,
  Save,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { caseFrontmatter, type DocumentEntry } from "@/lib/legal-types";
import { AI_NOTICE, AI_BADGE_LABEL, AI_FRONTMATTER } from "@/lib/ai-act";
import { agentActionFrontmatter } from "@/lib/approval";
import type { BrainPage } from "@/lib/types";

const TEMPLATES = [
  {
    key: "klage",
    label: "Klage",
    icon: Scale,
    prompt: (data: Record<string, string>) =>
      `Entwirf eine Klageschrift für den Rechtsstreit: ${data.title}. Kläger: ${data.klaeger}, Beklagter: ${data.beklagter}. Streitgegenstand: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "klageerwiderung",
    label: "Klageerwiderung",
    icon: Scale,
    prompt: (data: Record<string, string>) =>
      `Entwirf eine Klageerwiderung für den Rechtsstreit: ${data.title}. Beklagter: ${data.beklagter}, Kläger: ${data.klaeger}. Verteidigung: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "berufung",
    label: "Berufung",
    icon: Scale,
    prompt: (data: Record<string, string>) =>
      `Entwirf eine Berufungsschrift für den Rechtsstreit: ${data.title}. Berufungsführer: ${data.klaeger}, Berufungsgegner: ${data.beklagter}. Sachverhalt: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "beschwerde",
    label: "Beschwerde",
    icon: Scale,
    prompt: (data: Record<string, string>) =>
      `Entwirf eine Beschwerdeschrift für: ${data.title}. Beschwerdeführer: ${data.klaeger}, Beschwerdegegner: ${data.beklagter}. Sachverhalt: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "mahnung",
    label: "Mahnung",
    icon: PenTool,
    prompt: (data: Record<string, string>) =>
      `Entwirf eine Mahnung/Schreiben für: ${data.title}. Empfänger: ${data.beklagter}, Absender: ${data.klaeger}. Sachverhalt: ${data.facts}. Forderung: ${data.legalBasis}.`,
  },
  {
    key: "antragschrift",
    label: "Antragschrift",
    icon: FileText,
    prompt: (data: Record<string, string>) =>
      `Entwirf eine Antragschrift für: ${data.title}. Antragsteller: ${data.klaeger}, Antragsgegner: ${data.beklagter}. Sachverhalt: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "einstweilige",
    label: "Einstw. Verfügung",
    icon: FileText,
    prompt: (data: Record<string, string>) =>
      `Entwirf einen Antrag auf einstweilige Verfügung für: ${data.title}. Antragsteller: ${data.klaeger}, Antragsgegner: ${data.beklagter}. Sachverhalt: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "vergleich",
    label: "Vergleichsvertrag",
    icon: FileText,
    prompt: (data: Record<string, string>) =>
      `Entwirf einen Vergleichsvertrag für den Rechtsstreit: ${data.title}. Partei A: ${data.klaeger}, Partei B: ${data.beklagter}. Streitgegenstand: ${data.facts}.`,
  },
  {
    key: "vollstreckung",
    label: "Vollstreckung",
    icon: FileText,
    prompt: (data: Record<string, string>) =>
      `Entwirf einen Antrag auf Erlass eines Vollstreckungsbescheids für: ${data.title}. Gläubiger: ${data.klaeger}, Schuldner: ${data.beklagter}. Forderung: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "beweisantrag",
    label: "Beweisantrag",
    icon: FileText,
    prompt: (data: Record<string, string>) =>
      `Entwirf einen Beweisantrag für den Rechtsstreit: ${data.title}. Antragsteller: ${data.klaeger}. Zu beweisende Tatsachen: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "gutachten",
    label: "Rechtsgutachten",
    icon: BookOpen,
    prompt: (data: Record<string, string>) =>
      `Entwirf ein Rechtsgutachten im Gutachtenstil zu: ${data.title}. Sachverhalt: ${data.facts}. Rechtsfrage: ${data.legalBasis}.`,
  },
  {
    key: "stellungnahme",
    label: "Stellungnahme",
    icon: BookOpen,
    prompt: (data: Record<string, string>) =>
      `Entwirf eine Stellungnahme für: ${data.title}. Von: ${data.klaeger}, Gegenüber: ${data.beklagter}. Sachverhalt: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
  {
    key: "widerruf",
    label: "Widerruf",
    icon: PenTool,
    prompt: (data: Record<string, string>) =>
      `Entwirf einen Widerruf/Rücktritt für: ${data.title}. Von: ${data.klaeger}, Gegenüber: ${data.beklagter}. Sachverhalt: ${data.facts}. Rechtsgrundlage: ${data.legalBasis}.`,
  },
];

export default function DraftingPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("klage");
  const [formData, setFormData] = useState<Record<string, string>>({
    title: "",
    klaeger: "",
    beklagter: "",
    facts: "",
    legalBasis: "",
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [docxReady, setDocxReady] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState<string | null>(null);
  const [cases, setCases] = useState<BrainPage[]>([]);
  const [selectedCaseSlug, setSelectedCaseSlug] = useState("");

  const template = TEMPLATES.find((t) => t.key === selectedTemplate)!;

  useEffect(() => {
    api.brain.listPages({ type: "legal_case", limit: 200 })
      .then((pages) => setCases(pages))
      .catch(() => setCases([]));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setResult(null);
    try {
      const res = await api.query.think(template.prompt(formData));
      setResult(res.answer);
      setDraftSaved(null);
    } catch {
      setResult("Fehler bei der Generierung. Bitte versuche es erneut.");
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadDocx(text: string) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${template.label}</title></head>
<body style="font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;">
<h1 style="font-size:16pt;">${template.label}: ${formData.title}</h1>
<p><strong>Kläger/Absender:</strong> ${formData.klaeger || "—"}</p>
<p><strong>Beklagter/Empfänger:</strong> ${formData.beklagter || "—"}</p>
<p><strong>Rechtsgrundlage:</strong> ${formData.legalBasis || "—"}</p>
<hr/>
<pre style="font-family:Calibri,sans-serif;white-space:pre-wrap;">${text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
<hr/>
<p style="font-size:9pt;color:#777;font-style:italic;">${AI_NOTICE}</p>
</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.label}_${formData.title.slice(0,40).replace(/[^a-zA-Z0-9äöüß]/g,"_")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    setDocxReady(true);
    setTimeout(() => setDocxReady(false), 2000);
  }

  async function saveDraftToBrain(text: string) {
    setSavingDraft(true);
    setDraftSaved(null);
    try {
      const now = new Date();
      const safeTitle = (formData.title || template.label).toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      const slug = `legal/drafts/${now.toISOString().split("T")[0]}-${template.key}-${safeTitle || now.getTime()}`;
      await api.brain.createPage({
        slug,
        title: `${template.label}: ${formData.title || "Entwurf"}`,
        type: "legal_document",
        content: text,
        frontmatter: {
          type: "legal_document",
          document_kind: template.key,
          status: "draft",
          case_slug: selectedCaseSlug || undefined,
          claimant: formData.klaeger || undefined,
          respondent: formData.beklagter || undefined,
          legal_basis: formData.legalBasis || undefined,
          generated_at: now.toISOString(),
          source: "drafting",
          ...AI_FRONTMATTER,
        },
      });

      if (selectedCaseSlug) {
        const page = await api.brain.getPage(selectedCaseSlug);
        const fm = caseFrontmatter(page);
        const documents = fm.documents ?? [];
        const entry: DocumentEntry = {
          id: `doc-${Date.now()}`,
          name: `${template.label}: ${formData.title || "Entwurf"}`,
          uploadedAt: now.toISOString(),
          slug,
          source: "drafting",
          kind: template.key,
        };
        await api.brain.updatePage({
          slug: selectedCaseSlug,
          title: page.title,
          content: page.content,
          frontmatter: {
            ...fm,
            documents: [...documents, entry],
          },
        });
      }

      setDraftSaved(slug);
      return slug;
    } catch (e) {
      setDraftSaved(e instanceof Error ? `Fehler: ${e.message}` : "Fehler beim Speichern");
      return null;
    } finally {
      setSavingDraft(false);
    }
  }

  // Vier-Augen-Prinzip: KI-Entwurf speichern UND zur Freigabe durch einen
  // zweiten Menschen einreichen (agent_action, status=pending). Der Entwurf
  // wird erst „freigegeben", wenn jemand in der Freigabe-Queue zustimmt.
  async function submitForApproval(text: string) {
    setSubmitting(true);
    try {
      const slug = await saveDraftToBrain(text);
      if (!slug) return;
      const actionSlug = `legal/approvals/${Date.now()}-${template.key}`;
      await api.brain.createPage({
        slug: actionSlug,
        title: `Freigabe: ${template.label} — ${formData.title || "Entwurf"}`,
        type: "agent_action",
        content: text.slice(0, 4000),
        frontmatter: agentActionFrontmatter({
          action_type: "document_finalize",
          proposed_by: "Schriftsatz-Generator (KI)",
          target_slug: slug,
          summary: `${template.label}: ${formData.title || "Entwurf"}${selectedCaseSlug ? ` · Akte ${selectedCaseSlug}` : ""}`,
        }),
      });
      setDraftSaved(`approval:${actionSlug}`);
    } catch (e) {
      setDraftSaved(e instanceof Error ? `Fehler: ${e.message}` : "Fehler beim Einreichen");
    } finally {
      setSubmitting(false);
    }
  }

  const canGenerate = formData.title.trim() && formData.facts.trim();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
          <PenTool size={20} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Schriftsatz-Generator</h1>
          <p className="text-sm text-[#8888aa]">Schriftsätze und Gutachten mit KI-Unterstützung erstellen</p>
        </div>
      </div>

      {/* Template selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setSelectedTemplate(t.key); setResult(null); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all",
                selectedTemplate === t.key
                  ? "bg-violet-600/10 border-violet-500/30 text-violet-400"
                  : "bg-[#0a0a18] border-[#1e1e3a] text-[#8888aa] hover:text-[#e8e8f0]"
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Form */}
      <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4 space-y-4">
        <h2 className="text-sm font-semibold text-[#e8e8f0]">{template.label} — Angaben</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#8888aa] mb-1.5">Titel / Betreff</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="z.B. Vertragsbruch Muster GmbH"
              aria-label="z.B. Vertragsbruch Muster GmbH"
              className="bg-[#0a0a18] border-[#1e1e3a] text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8888aa] mb-1.5">Rechtsgrundlage</label>
            <Input
              value={formData.legalBasis}
              onChange={(e) => setFormData({ ...formData, legalBasis: e.target.value })}
              placeholder="z.B. § 823 BGB"
              aria-label="z.B. § 823 BGB"
              className="bg-[#0a0a18] border-[#1e1e3a] text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:border-violet-500/50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#8888aa] mb-1.5">Kläger / Absender</label>
            <Input
              value={formData.klaeger}
              onChange={(e) => setFormData({ ...formData, klaeger: e.target.value })}
              placeholder="Name"
              aria-label="Name"
              className="bg-[#0a0a18] border-[#1e1e3a] text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8888aa] mb-1.5">Beklagter / Empfänger</label>
            <Input
              value={formData.beklagter}
              onChange={(e) => setFormData({ ...formData, beklagter: e.target.value })}
              placeholder="Name"
              aria-label="Name"
              className="bg-[#0a0a18] border-[#1e1e3a] text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:border-violet-500/50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#8888aa] mb-1.5">Sachverhalt</label>
          <textarea
            value={formData.facts}
            onChange={(e) => setFormData({ ...formData, facts: e.target.value })}
            rows={4}
            placeholder="Beschreibe den Sachverhalt…"
            aria-label="Beschreibe den Sachverhalt"
            className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50 resize-y"
          />
        </div>
        <div>
          <label className="block text-xs text-[#8888aa] mb-1.5">Mit Akte verknüpfen</label>
          <select
            value={selectedCaseSlug}
            onChange={(e) => setSelectedCaseSlug(e.target.value)}
            className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50"
          >
            <option value="">Keine Akte</option>
            {cases.map((c) => {
              const fm = caseFrontmatter(c);
              return (
                <option key={c.slug} value={c.slug}>
                  {fm.case_number ? `${fm.case_number} - ` : ""}{c.title}
                </option>
              );
            })}
          </select>
        </div>
        <Button
          variant="primary"
          className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
          disabled={!canGenerate || generating}
          onClick={handleGenerate}
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {template.label} generieren
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-violet-400 font-medium">Entwurf</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-medium">
                {AI_BADGE_LABEL}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => saveDraftToBrain(result)}
                disabled={savingDraft || submitting}
                className="text-[#8a8aa8] hover:text-emerald-400 transition-colors flex items-center gap-1 text-xs disabled:opacity-60"
                title="Entwurf im Brain speichern"
              >
                {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Speichern
              </button>
              <button
                onClick={() => submitForApproval(result)}
                disabled={savingDraft || submitting}
                className="text-[#8a8aa8] hover:text-violet-400 transition-colors flex items-center gap-1 text-xs disabled:opacity-60"
                title="Entwurf einem zweiten Bearbeiter zur Freigabe vorlegen (Vier-Augen-Prinzip)"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                Zur Freigabe
              </button>
              <button
                onClick={() => downloadDocx(result)}
                className="text-[#8a8aa8] hover:text-blue-400 transition-colors flex items-center gap-1 text-xs"
                title="Als Word-Dokument herunterladen"
              >
                {docxReady ? <Check size={14} className="text-emerald-400" /> : <FileText size={14} />}
                Word
              </button>
              <button
                onClick={() => copyToClipboard(result)}
                className="text-[#8a8aa8] hover:text-[#8888aa] transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div className="text-sm text-[#e8e8f0] whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
            {result}
          </div>
          <p className="text-[11px] text-amber-300/70 leading-relaxed border-t border-[#1e1e3a] pt-2">
            {AI_NOTICE}
          </p>
          {draftSaved && (
            <p className={cn("text-xs", draftSaved.startsWith("Fehler:") ? "text-red-400" : draftSaved.startsWith("approval:") ? "text-violet-400" : "text-emerald-400")}>
              {draftSaved.startsWith("Fehler:")
                ? draftSaved
                : draftSaved.startsWith("approval:")
                ? "Zur Freigabe eingereicht — sichtbar im Menü unter Freigaben."
                : `Gespeichert: ${draftSaved}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
