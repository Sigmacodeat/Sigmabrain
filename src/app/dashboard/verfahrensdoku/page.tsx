"use client";

import { useEffect, useState } from "react";
import {
  ScrollText,
  FileText,
  Save,
  Printer,
  Download,
  Info,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { buildVerfahrensdoku, type VerfahrensdokuInput } from "@/lib/gobd-verfahrensdoku";
import { loadKanzleiSettings } from "@/lib/kanzlei-settings";

const DOC_SLUG = "legal/gobd/verfahrensdokumentation";

/** Escape vor Injektion in HTML-Strings (Druck/Word-Export) — verhindert XSS. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Minimaler Markdown→HTML-Konverter für den Export (Überschriften, Listen,
 *  Tabellen, Blockquote, fett/kursiv, Trennlinie). Inhalt wird vorab escaped. */
function markdownToHtml(md: string): string {
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList) { out.push("</ul>"); inList = false; }
  };
  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [header, , ...body] = tableRows; // zweite Zeile = Trenner
    out.push("<table><thead><tr>");
    for (const c of header) out.push(`<th>${inline(c.trim())}</th>`);
    out.push("</tr></thead><tbody>");
    for (const row of body) {
      out.push("<tr>");
      for (const c of row) out.push(`<td>${inline(c.trim())}</td>`);
      out.push("</tr>");
    }
    out.push("</tbody></table>");
    tableRows = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("|")) {
      const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|");
      tableRows.push(cells);
      continue;
    }
    flushTable();

    if (line.startsWith("### ")) { flushList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); }
    else if (line.startsWith("## ")) { flushList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (line.startsWith("# ")) { flushList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); }
    else if (line.startsWith("> ")) { flushList(); out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); }
    else if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    }
    else if (line.trim() === "---") { flushList(); out.push("<hr/>"); }
    else if (line.trim() === "") { flushList(); }
    else { flushList(); out.push(`<p>${inline(line)}</p>`); }
  }
  flushList();
  flushTable();
  return out.join("\n");
}

function exportHtmlDocument(title: string, markdown: string): string {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; margin: 40px; color: #222; font-size: 12pt; line-height: 1.5; }
  h1 { font-size: 20pt; color: #4338ca; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
  h2 { font-size: 15pt; color: #4338ca; margin-top: 24px; }
  h3 { font-size: 12.5pt; color: #333; margin-top: 16px; }
  blockquote { background: #f3f0ff; border-left: 4px solid #6366f1; margin: 16px 0; padding: 10px 16px; color: #444; font-size: 10.5pt; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11pt; }
  th { background: #f1f3f4; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  em { color: #666; }
</style></head><body>
${markdownToHtml(markdown)}
</body></html>`;
}

export default function VerfahrensdokuPage() {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<VerfahrensdokuInput>({
    kanzleiName: "",
    anwaltName: "",
    ustId: "",
    verantwortlich: "",
    systeme: "Sigmabrain, DATEV-Export, beA",
    belegEingang: "",
    erfassung: "",
    ablageOrt: "Sigmabrain-Brain (steuerlich relevante Belege mit GoBD-Stempel)",
    backup: "",
    zugriffsschutz: "",
    iks: "",
    stand: today,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadKanzleiSettings().then((s) => {
      setForm((prev) => ({
        ...prev,
        kanzleiName: s.kanzleiName ?? "",
        anwaltName: s.anwaltName ?? "",
        ustId: s.ustId ?? "",
        verantwortlich: prev.verantwortlich || (s.anwaltName ?? ""),
      }));
    }).catch(() => {});
    // Bereits gespeicherten Entwurf laden, falls vorhanden.
    api.brain.getPage(DOC_SLUG)
      .then((p) => {
        const fm = (p.frontmatter ?? {}) as Record<string, unknown>;
        const stored = fm.verfahrensdoku_input;
        if (stored && typeof stored === "object") {
          setForm((prev) => ({ ...prev, ...(stored as Partial<VerfahrensdokuInput>) }));
        }
      })
      .catch(() => {});
  }, []);

  const markdown = buildVerfahrensdoku(form);

  function set<K extends keyof VerfahrensdokuInput>(key: K, value: VerfahrensdokuInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await api.brain.updatePage({
        slug: DOC_SLUG,
        title: "GoBD-Verfahrensdokumentation",
        type: "document",
        content: markdown,
        frontmatter: {
          type: "document",
          gobd_verfahrensdoku: true,
          verfahrensdoku_input: form,
          updated_via: "dashboard",
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  function printPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(exportHtmlDocument("GoBD-Verfahrensdokumentation", markdown));
    w.document.close();
    w.onload = () => setTimeout(() => w.print(), 300);
  }

  function downloadWord() {
    const blob = new Blob([exportHtmlDocument("GoBD-Verfahrensdokumentation", markdown)], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gobd-verfahrensdokumentation-${form.stand}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = (
    label: string,
    key: keyof VerfahrensdokuInput,
    placeholder: string,
    textarea = false,
  ) => (
    <div>
      <label className="text-xs text-[#585866] block mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50 resize-y"
        />
      ) : (
        <input
          type="text"
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
        />
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <ScrollText size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#15151d]">GoBD-Verfahrensdokumentation</h1>
            <p className="text-sm text-[#585866]">Vorlage aus Kanzlei-Stammdaten + Ablaufbeschreibung (GoBD Rz. 151 ff.)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={printPdf} className="gap-1.5 text-xs">
            <Printer size={14} /> PDF / Drucken
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadWord} className="gap-1.5 text-xs">
            <Download size={14} /> Word (.doc)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5 text-xs"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? "Gespeichert" : "Im Brain speichern"}
          </Button>
        </div>
      </div>

      {/* Honest framing */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-400 leading-relaxed">
          Dies erzeugt eine <strong>Vorlage</strong>, kein prüfungssicheres Dokument. Die
          Verfahrensdokumentation muss an den tatsächlichen Kanzleiablauf angepasst,
          anwaltlich/steuerlich geprüft und vom Berater bzw. Betriebsprüfer abgenommen
          werden. Sigmabrain liefert technische GoBD-Bausteine — keine Konformitätszusage.
        </p>
      </div>

      {saveError && <div className="text-xs text-red-400">{saveError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#15151d]">Stammdaten</h2>
            {field("Kanzlei / Unternehmen", "kanzleiName", "z.B. Kanzlei Muster")}
            {field("Vertretungsberechtigte/r", "anwaltName", "z.B. RA Dr. Muster")}
            {field("USt-IdNr.", "ustId", "DE123456789")}
            {field("Verantwortlich für die Ordnungsmäßigkeit", "verantwortlich", "Name der zuständigen Person")}
            {field("Stand (Datum)", "stand", today)}
          </div>

          <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#15151d]">Ablaufbeschreibung</h2>
            {field("Eingesetzte DV-Systeme", "systeme", "Sigmabrain, DATEV, beA …")}
            {field("Belegeingang", "belegEingang", "Wie kommen Belege herein? (Post, E-Mail, Upload, Scan)", true)}
            {field("Erfassung & Verbuchung", "erfassung", "Wie/wann werden Belege erfasst und verbucht?", true)}
            {field("Ablage & Aufbewahrungsort", "ablageOrt", "Wo werden Belege unveränderbar abgelegt?", true)}
          </div>

          <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#15151d]">Betrieb & Kontrolle</h2>
            {field("Datensicherung / Backup", "backup", "Sicherungskonzept, Frequenz, Aufbewahrung der Backups", true)}
            {field("Zugriffsschutz", "zugriffsschutz", "Berechtigungskonzept, Authentifizierung", true)}
            {field("Internes Kontrollsystem (IKS)", "iks", "Funktionstrennung, Plausibilitätskontrollen", true)}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-2 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center gap-2 text-[#585866]">
            <FileText size={14} className="text-violet-400" />
            <span className="text-sm font-semibold text-[#15151d]">Vorschau (Markdown)</span>
          </div>
          <pre className="text-[11px] text-[#585866] font-mono whitespace-pre-wrap leading-relaxed max-h-[70vh] overflow-y-auto">
            {markdown}
          </pre>
        </div>
      </div>
    </div>
  );
}
