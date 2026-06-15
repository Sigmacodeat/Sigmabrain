"use client";

import { useState, useCallback } from "react";
import { Mail, Upload, Link, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseEml, type ParsedEmail } from "@/lib/email-parser";
import { api } from "@/lib/api";
import type { BrainPage } from "@/lib/types";

export default function EmailImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [parsed, setParsed] = useState<ParsedEmail[]>([]);
  const [cases, setCases] = useState<BrainPage[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
    const results: ParsedEmail[] = [];
    for (const file of acceptedFiles) {
      const text = await file.text();
      results.push(parseEml(text));
    }
    setParsed(results);
    // Load cases for matching
    try {
      const pages = await api.brain.listPages({ type: "legal_case", limit: 100 });
      setCases(pages);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Akten konnten nicht geladen werden.");
    }
  }, []);

  async function importEmails() {
    setImporting(true);
    setImportError(null);
    let count = 0;
    for (const email of parsed) {
      let caseSlug = email.suggestedCaseSlug;
      if (!caseSlug) {
        const matched = cases.find((c) => {
          const fm = c.frontmatter as Record<string, unknown>;
          return String(fm.client_email ?? "").toLowerCase() === email.from.toLowerCase();
        });
        if (matched) caseSlug = matched.slug;
      }
      if (!caseSlug) continue;

      try {
        await api.brain.createPage({
          slug: `legal/email/${Date.now()}-${count}`,
          title: `E-Mail: ${email.subject.slice(0, 80)}`,
          type: "email",
          content: `Von: ${email.fromName} <${email.from}>\nAn: ${email.to}\nDatum: ${email.date}\n\n${email.body}`,
          frontmatter: {
            type: "email",
            from_email: email.from,
            from_name: email.fromName,
            subject: email.subject,
            date: email.date,
            case_slug: caseSlug,
            confidence: email.confidence,
            attachment_count: email.attachments.length,
          },
        });
        count++;
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Import fehlgeschlagen.");
      }
    }
    setImported(count);
    setImporting(false);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
          <Mail size={20} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">E-Mail-Import</h1>
          <p className="text-sm text-[#8888aa]">Mandanten-E-Mails automatisch Akten zuordnen</p>
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".eml") || f.name.endsWith(".msg"));
          void onDrop(files);
        }}
        className="rounded-xl border border-dashed border-[#23233f] bg-[#0d0d1a] p-8 text-center hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all duration-300 cursor-pointer"
        onClick={() => document.getElementById("email-file-input")?.click()}
      >
        <Upload size={32} className="mx-auto text-[#1e1e3a] mb-3" />
        <p className="text-sm text-[#8888aa]">.eml-Dateien hierher ziehen oder klicken</p>
        <input
          id="email-file-input"
          type="file"
          multiple
          accept=".eml"
          className="hidden"
          onChange={(e) => { const files = Array.from(e.target.files || []); void onDrop(files); }}
        />
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {importError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {importError}
        </div>
      )}

      {parsed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e8e8f0]">{parsed.length} E-Mail(s) erkannt</h2>
            <Button
              variant="primary"
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2 text-sm"
              onClick={importEmails}
              disabled={importing}
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
              {importing ? "Importiere…" : "Akten zuordnen"}
            </Button>
          </div>

          {imported > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 size={14} className="inline mr-1" />
              {imported} E-Mail(s) erfolgreich zugeordnet.
            </div>
          )}

          <div className="space-y-2">
            {parsed.map((email, i) => (
              <div key={i} className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#e8e8f0] truncate">{email.subject}</span>
                  {email.confidence === "high" ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">Hoch</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">Unsicher</span>
                  )}
                </div>
                <div className="text-xs text-[#8888aa]">
                  {email.fromName} &lt;{email.from}&gt; · {email.date}
                </div>
                {email.suggestedCaseSlug && (
                  <div className="flex items-center gap-1 text-xs text-blue-400">
                    <Link size={12} />
                    Vorgeschlagene Akte: {email.suggestedCaseSlug}
                  </div>
                )}
                {email.attachments.length > 0 && (
                  <div className="text-xs text-[#8a8aa8]">{email.attachments.length} Anhänge</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
