"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Key,
  Database,
  Zap,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  Gift,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "brain", label: "Brain", icon: Database },
  { id: "api", label: "API Keys", icon: Key },
  { id: "dream", label: "Dream Cycle", icon: Zap },
  { id: "account", label: "Account", icon: Settings },
];

function MaskedInput({ value, placeholder }: { value: string; placeholder: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex items-center">
      <input
        type={show ? "text" : "password"}
        value={value || ""}
        placeholder={placeholder}
        readOnly={!!value}
        className="w-full bg-[#0d0d1a] border border-[#1e1e3a] rounded-lg px-3 py-2.5 pr-20 text-sm text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:outline-none focus:border-violet-500/50 font-mono transition-colors"
      />
      <div className="absolute right-2 flex items-center gap-1">
        <button
          onClick={() => setShow(!show)}
          className="p-1.5 text-[#4a4a6a] hover:text-[#8888aa] transition-colors"
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        {value && (
          <button onClick={copy} className="p-1.5 text-[#4a4a6a] hover:text-[#8888aa] transition-colors">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-4 border-b border-[#1e1e3a] last:border-0">
      <div>
        <p className="text-sm font-medium text-[#e8e8f0]">{label}</p>
        {desc && <p className="text-xs text-[#4a4a6a] mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("brain");
  const [referralUrl, setReferralUrl] = useState("");
  const [referrals, setReferrals] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.referralCode) {
          setReferralUrl(`${window.location.origin}/?ref=${data.user.referralCode}`);
          setReferrals(typeof data.referrals === "number" ? data.referrals : 0);
        }
      })
      .catch(() => {});
  }, []);

  const [brainUrl, setBrainUrl] = useState("http://localhost:3001");
  const [searchMode, setSearchMode] = useState("balanced");
  const [openaiKey] = useState("");
  const [anthropicKey] = useState("");
  const [zeroEntropyKey] = useState("");
  const [dreamEnabled, setDreamEnabled] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e8e8f0]">Einstellungen</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">Sigmabrain Engine & Dashboard konfigurieren</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-[#1e1e3a] pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-[#8888aa] hover:text-[#e8e8f0]"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Brain Settings */}
      {activeTab === "brain" && (
        <Card>
          <div className="p-6 border-b border-[#1e1e3a]">
            <h2 className="text-base font-semibold text-[#e8e8f0]">Brain-Konfiguration</h2>
          </div>
          <div className="px-6 divide-y divide-[#1e1e3a]">
            <Field label="Engine-URL" desc="URL des laufenden Sigmabrain-Engine-Servers">
              <Input
                value={brainUrl}
                onChange={(e) => setBrainUrl(e.target.value)}
                placeholder="http://localhost:3001"
              />
            </Field>

            <Field label="Verbindungsstatus" desc="Prüft ob die Sigmabrain Engine erreichbar ist">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-sm text-amber-400">Nicht verbunden</span>
                </div>
                <Button variant="secondary" size="sm">
                  Verbinden
                </Button>
              </div>
            </Field>

            <Field label="Suche-Modus" desc="Qualitäts-/Kosten-Tradeoff für Hybrid-Suche">
              <div className="flex gap-2">
                {["conservative", "balanced", "tokenmax"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                      searchMode === mode
                        ? "bg-violet-600/15 text-violet-400 border-violet-500/30"
                        : "text-[#8888aa] border-[#1e1e3a] hover:border-[#3a3a6a]"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Engine starten" desc="Befehle zum Starten der lokalen Sigmabrain Engine">
              <div className="space-y-2">
                {[
                  "bun install -g github:garrytan/gbrain",
                  "gbrain init --pglite",
                  "gbrain serve --port 3001",
                ].map((cmd) => (
                  <div key={cmd} className="flex items-center gap-2 bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-4 py-2.5">
                    <code className="text-xs font-mono text-violet-400 flex-1">{cmd}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(cmd)}
                      className="text-[#4a4a6a] hover:text-[#8888aa] transition-colors shrink-0"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </Field>
          </div>
        </Card>
      )}

      {/* API Keys */}
      {activeTab === "api" && (
        <Card>
          <div className="p-6 border-b border-[#1e1e3a]">
            <h2 className="text-base font-semibold text-[#e8e8f0]">API Keys</h2>
            <p className="text-sm text-[#8888aa] mt-1">Keys werden lokal gespeichert und nie an Server gesendet.</p>
          </div>
          <div className="px-6 divide-y divide-[#1e1e3a]">
            <Field label="OpenAI API Key" desc="Für Embeddings und Synthese (text-embedding-3-small)">
              <div className="space-y-2">
                <MaskedInput value={openaiKey} placeholder="sk-..." />
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline">
                  API Key erstellen <ExternalLink size={10} />
                </a>
              </div>
            </Field>

            <Field label="Anthropic API Key" desc="Für KI-Synthese (Claude 3.5 Sonnet)">
              <div className="space-y-2">
                <MaskedInput value={anthropicKey} placeholder="sk-ant-..." />
                <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline">
                  API Key erstellen <ExternalLink size={10} />
                </a>
              </div>
            </Field>

            <Field label="ZeroEntropy API Key" desc="Optionaler Reranker für höhere Suchqualität (+P@5)">
              <div className="space-y-2">
                <MaskedInput value={zeroEntropyKey} placeholder="ze-..." />
                <Badge variant="info" className="text-xs">Optional — verbessert Recall deutlich</Badge>
              </div>
            </Field>
          </div>
          <div className="p-6 border-t border-[#1e1e3a]">
            <Button variant="glow" size="md">
              Keys speichern
            </Button>
          </div>
        </Card>
      )}

      {/* Dream Cycle */}
      {activeTab === "dream" && (
        <Card>
          <div className="p-6 border-b border-[#1e1e3a]">
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-amber-400" />
              <div>
                <h2 className="text-base font-semibold text-[#e8e8f0]">Dream Cycle</h2>
                <p className="text-sm text-[#8888aa]">Nächtliche Konsolidierung & Enrichment</p>
              </div>
              <Badge variant={dreamEnabled ? "success" : "warning"} className="ml-auto">
                {dreamEnabled ? "Aktiv" : "Inaktiv"}
              </Badge>
            </div>
          </div>
          <div className="px-6 divide-y divide-[#1e1e3a]">
            <Field label="Dream Cycle aktivieren" desc="Täglich um 3:00 Uhr morgens">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDreamEnabled(!dreamEnabled)}
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    dreamEnabled ? "bg-amber-500" : "bg-[#1e1e3a]"
                  )}
                >
                  <span className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                    dreamEnabled ? "translate-x-5" : "translate-x-1"
                  )} />
                </button>
                <span className="text-sm text-[#8888aa]">
                  {dreamEnabled ? "Läuft täglich um 3:00 Uhr" : "Deaktiviert"}
                </span>
              </div>
            </Field>
            <Field label="Was passiert im Dream Cycle" desc="">
              <ul className="space-y-2">
                {[
                  "Duplikate in Personen- und Firmen-Seiten erkennen & mergen",
                  "Kaputte Zitate reparieren und neu verlinken",
                  "Salience Score für alle Seiten berechnen",
                  "Widersprüche in Fakten markieren",
                  "Aufgaben für den nächsten Tag vorbereiten",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#8888aa]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </Field>
          </div>
        </Card>
      )}

      {/* Account */}
      {activeTab === "account" && (
        <Card>
          <div className="p-6 border-b border-[#1e1e3a]">
            <h2 className="text-base font-semibold text-[#e8e8f0]">Account</h2>
          </div>
          <div className="px-6 divide-y divide-[#1e1e3a]">
            <Field label="Plan" desc="Dein aktuelles Abonnement">
              <div className="flex items-center gap-3">
                <Badge variant="accent" className="text-sm px-3 py-1">Free</Badge>
                <Button variant="outline" size="sm">
                  Upgrade auf Pro →
                </Button>
              </div>
            </Field>
            <Field label="Nutzung" desc="Aktueller Monat">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#8888aa]">Seiten</span>
                    <span className="text-[#e8e8f0] font-mono">0 / 100</span>
                  </div>
                  <div className="h-1.5 bg-[#1e1e3a] rounded-full">
                    <div className="h-full w-0 bg-violet-600 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#8888aa]">Queries</span>
                    <span className="text-[#e8e8f0] font-mono">0 / 50</span>
                  </div>
                  <div className="h-1.5 bg-[#1e1e3a] rounded-full">
                    <div className="h-full w-0 bg-violet-600 rounded-full" />
                  </div>
                </div>
              </div>
            </Field>
            <Field
              label="Empfehlen & sparen"
              desc="Du bekommst 1 Monat gratis pro geworbenem Kunden — der Geworbene auch."
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-lg px-4 py-3">
                  <Gift size={15} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-[#8888aa] leading-relaxed">
                    12 Empfehlungen = ein Gratisjahr. Keine Obergrenze.
                    {referrals !== null && (
                      <span className="text-amber-400 font-medium"> Bisher geworben: {referrals}.</span>
                    )}
                  </p>
                </div>
                <MaskedInput
                  value={referralUrl}
                  placeholder="Empfehlungslink wird geladen…"
                />
                <Link
                  href="/partners"
                  className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
                >
                  Mehr verdienen? Zum Partnerprogramm (30 % wiederkehrend) <ExternalLink size={10} />
                </Link>
              </div>
            </Field>
          </div>
        </Card>
      )}
    </div>
  );
}
