"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { AnonymizeResponse } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  person: "Personen",
  organization: "Unternehmen",
  iban: "IBAN",
  bic: "BIC",
  email: "E-Mail",
  phone: "Telefon",
  aktenzeichen: "Aktenzeichen",
  tax_id: "Steuer-ID",
  address: "Adressen",
  ip: "IP-Adressen",
  credit_card: "Kartennummern",
};

export default function AnonymizePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnonymizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.legal.anonymize(input);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anonymisierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result.anonymized);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center">
          <ShieldCheck size={20} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#15151d]">Anonymisierung</h1>
          <p className="text-sm text-[#585866]">
            Identifizierende Daten entfernen vor Weitergabe oder Cloud-Verarbeitung (§ 203 StGB)
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Eingabe */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-[#585866] font-semibold">Original</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Text einfügen — z. B. Schriftsatz, Mandanten-Mail, Sachverhalt …"
            className="w-full h-80 bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-4 py-3 text-sm text-[#15151d] font-mono leading-relaxed focus:outline-none focus:border-emerald-500/50 resize-none"
          />
          <Button onClick={run} disabled={loading || !input.trim()} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            Anonymisieren
          </Button>
        </div>

        {/* Ergebnis */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider text-[#585866] font-semibold">Anonymisiert</label>
            {result && (
              <button onClick={copyResult} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Kopiert" : "Kopieren"}
              </button>
            )}
          </div>
          <textarea
            readOnly
            value={result?.anonymized ?? ""}
            placeholder="Das Ergebnis erscheint hier."
            className="w-full h-80 bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-4 py-3 text-sm text-[#15151d] font-mono leading-relaxed focus:outline-none resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-600">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#585866]">{result.count} Ersetzungen:</span>
            {Object.entries(result.stats).map(([type, n]) => (
              <Badge key={type} variant="default" className="text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-700">
                {TYPE_LABELS[type] ?? type}: {n}
              </Badge>
            ))}
            <Badge variant="default" className="text-xs bg-[#e2e4ec] border-[#2a2a4a] text-[#585866]">
              {result.llm_used ? "Namen via KI erkannt" : "nur Muster-Erkennung (kein KI-Schlüssel)"}
            </Badge>
          </div>

          {result.replacements.length > 0 && (
            <details className="rounded-lg border border-[#e2e4ec] bg-[#ffffff]">
              <summary className="px-4 py-3 text-sm text-[#15151d] cursor-pointer select-none">
                Re-Identifikations-Mapping ({result.replacements.length}) — nur für Berechtigte
              </summary>
              <div className="px-4 pb-3 max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-[#585866] text-left">
                    <tr><th className="py-1 pr-4">Platzhalter</th><th className="py-1">Original</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {result.replacements.map((r, i) => (
                      <tr key={i} className="border-t border-[#e2e4ec]/60">
                        <td className="py-1 pr-4 text-emerald-600 whitespace-nowrap">{r.placeholder}</td>
                        <td className="py-1 text-[#c8c8e0] break-all">{r.original}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <p className="text-xs text-[#585866]">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
