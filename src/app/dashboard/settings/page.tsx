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
  Briefcase,
  Euro,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ENGINE_REPO_INSTALL } from "@/content/site";
import { loadKanzleiSettings, saveKanzleiSettings, type KanzleiSettings } from "@/lib/kanzlei-settings";

const ALL_TABS = [
  { id: "brain", label: "Brain", icon: Database, allowed: ["admin", "lawyer", "assistant"] as string[] },
  { id: "api", label: "API Keys", icon: Key, allowed: ["admin"] as string[] },
  { id: "dream", label: "Dream Cycle", icon: Zap, allowed: ["admin", "lawyer"] as string[] },
  { id: "kanzlei", label: "Kanzlei", icon: Briefcase, allowed: ["admin", "lawyer", "assistant"] as string[] },
  { id: "team", label: "Team", icon: Users, allowed: ["admin"] as string[] },
  { id: "account", label: "Account", icon: Settings, allowed: ["admin", "lawyer", "assistant", "client_viewer"] as string[] },
];

function MaskedInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange?: (value: string) => void;
}) {
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
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2.5 pr-20 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50 font-mono transition-colors"
      />
      <div className="absolute right-2 flex items-center gap-1">
        <button
          onClick={() => setShow(!show)}
          className="p-1.5 text-[#585866] hover:text-[#585866] transition-colors"
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        {value && (
          <button onClick={copy} className="p-1.5 text-[#585866] hover:text-[#585866] transition-colors">
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-4 border-b border-[#e2e4ec] last:border-0">
      <div>
        <p className="text-sm font-medium text-[#15151d]">{label}</p>
        {desc && <p className="text-xs text-[#585866] mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("brain");
  const [referralUrl, setReferralUrl] = useState("");
  const [referrals, setReferrals] = useState<number | null>(null);
  const [engineStatus, setEngineStatus] = useState<"idle" | "checking" | "online" | "offline">("idle");
  const [keysSaved, setKeysSaved] = useState(false);
  const [kanzleiSaved, setKanzleiSaved] = useState(false);
  const [kanzleiSaveError, setKanzleiSaveError] = useState<string | null>(null);

  const [brainUrl, setBrainUrl] = useState("http://localhost:3001");
  const [searchMode, setSearchMode] = useState("balanced");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [zeroEntropyKey, setZeroEntropyKey] = useState("");
  const [dreamEnabled, setDreamEnabled] = useState(false);

  // Role & team
  const [userRole, setUserRole] = useState<string>("lawyer");
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  // Kanzlei settings
  const [kanzleiName, setKanzleiName] = useState("");
  const [anwaltName, setAnwaltName] = useState("");
  const [kanzleiAdresse, setKanzleiAdresse] = useState("");
  const [kanzleiEmail, setKanzleiEmail] = useState("");
  const [kanzleiTelefon, setKanzleiTelefon] = useState("");
  const [kammerNummer, setKammerNummer] = useState("");
  const [ustId, setUstId] = useState("");
  const [stundensatz, setStundensatz] = useState("200");
  const [abrechnungstakt, setAbrechnungstakt] = useState("15");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [zahlungszielTage, setZahlungszielTage] = useState("14");
  const [rechnungFooter, setRechnungFooter] = useState("Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.");
  const [tarifModell, setTarifModell] = useState<"rvg" | "ratg" | "custom">("custom");
  const [datevKontenrahmen, setDatevKontenrahmen] = useState<"SKR03" | "SKR04" | "SKR49">("SKR03");
  const [datevBeraterNr, setDatevBeraterNr] = useState("");
  const [datevMandantenNr, setDatevMandantenNr] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [emailFrom, setEmailFrom] = useState("");
  const [rechtsgebietSaetze, setRechtsgebietSaetze] = useState<Record<string, number>>({
    allgemein: 200,
    vertragsrecht: 220,
    prozessrecht: 250,
    arbeitsrecht: 230,
    datenschutz: 280,
    steuerrecht: 260,
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.referralCode) {
          setReferralUrl(`${window.location.origin}/?ref=${data.user.referralCode}`);
          setReferrals(typeof data.referrals === "number" ? data.referrals : 0);
        }
        if (data?.user?.role) {
          setUserRole(data.user.role);
        }
      })
      .catch(() => {});

    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.members) setTeamMembers(data.members);
      })
      .catch(() => {});

    loadKanzleiSettings()
      .then((saved) => {
        setKanzleiName(saved.kanzleiName);
        setAnwaltName(saved.anwaltName);
        setKanzleiAdresse(saved.kanzleiAdresse ?? "");
        setKanzleiEmail(saved.kanzleiEmail ?? "");
        setKanzleiTelefon(saved.kanzleiTelefon ?? "");
        setKammerNummer(saved.kammerNummer ?? "");
        setUstId(saved.ustId);
        setStundensatz(saved.stundensatz);
        setAbrechnungstakt(saved.abrechnungstakt ?? "15");
        setBankName(saved.bankName ?? "");
        setIban(saved.iban ?? "");
        setBic(saved.bic ?? "");
        setZahlungszielTage(saved.zahlungszielTage ?? "14");
        setRechnungFooter(saved.rechnungFooter ?? "");
        if (saved.tarifModell) setTarifModell(saved.tarifModell);
        setDatevKontenrahmen(saved.datevKontenrahmen ?? "SKR03");
        setDatevBeraterNr(saved.datevBeraterNr ?? "");
        setDatevMandantenNr(saved.datevMandantenNr ?? "");
        setSmtpHost(saved.smtpHost ?? "");
        setSmtpPort(saved.smtpPort ?? "587");
        setSmtpUser(saved.smtpUser ?? "");
        setSmtpPassword(saved.smtpPassword ?? "");
        setSmtpSecure(saved.smtpSecure ?? false);
        setEmailFrom(saved.emailFrom ?? "");
        setRechtsgebietSaetze(saved.rechtsgebietSaetze);
      })
      .catch((err) => {
        console.error("[settings] failed to load saved settings:", err instanceof Error ? err.message : String(err));
      });

    // Load persisted API keys
    fetch("/api/settings/api-keys")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.openaiKey !== undefined) setOpenaiKey(data.openaiKey);
        if (data?.anthropicKey !== undefined) setAnthropicKey(data.anthropicKey);
        if (data?.zeroEntropyKey !== undefined) setZeroEntropyKey(data.zeroEntropyKey);
      })
      .catch(() => {});
  }, []);

  async function checkEngineConnection() {
    setEngineStatus("checking");
    try {
      const res = await fetch("/api/stats");
      setEngineStatus(res.ok ? "online" : "offline");
    } catch (err) {
      console.error("[settings] engine check failed:", err instanceof Error ? err.message : String(err));
      setEngineStatus("offline");
    }
  }

  async function saveApiKeys() {
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiKey, anthropicKey, zeroEntropyKey }),
      });
      if (res.ok) {
        setKeysSaved(true);
        setTimeout(() => setKeysSaved(false), 2000);
      }
    } catch (err) {
      console.error("[settings] failed to save API keys:", err instanceof Error ? err.message : String(err));
    }
  }

  async function saveKanzleiProfile() {
    setKanzleiSaveError(null);
    const settings: KanzleiSettings = {
      kanzleiName,
      anwaltName,
      kanzleiAdresse,
      kanzleiEmail,
      kanzleiTelefon,
      kammerNummer,
      ustId,
      stundensatz,
      abrechnungstakt,
      tarifModell,
      rechtsgebietSaetze,
      bankName,
      iban,
      bic,
      zahlungszielTage,
      rechnungFooter,
      datevKontenrahmen,
      datevBeraterNr,
      datevMandantenNr,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpSecure,
      emailFrom,
    };
    try {
      await saveKanzleiSettings(settings);
      setKanzleiSaved(true);
      setTimeout(() => setKanzleiSaved(false), 2000);
    } catch (err) {
      setKanzleiSaveError(err instanceof Error ? err.message : "Kanzlei-Einstellungen konnten nicht gespeichert werden.");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#15151d]">Einstellungen</h1>
        <p className="text-sm text-[#585866] mt-0.5">Sigmabrain Engine & Dashboard konfigurieren</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-[#e2e4ec] pb-px">
        {ALL_TABS.filter((tab) => tab.allowed.includes(userRole)).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-[#585866] hover:text-[#15151d]"
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
          <div className="p-6 border-b border-[#e2e4ec]">
            <h2 className="text-base font-semibold text-[#15151d]">Brain-Konfiguration</h2>
          </div>
          <div className="px-6 divide-y divide-[#e2e4ec]">
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
                  <AlertTriangle size={14} className={engineStatus === "online" ? "text-emerald-600" : "text-amber-600"} />
                  <span className={cn("text-sm", engineStatus === "online" ? "text-emerald-600" : "text-amber-600")}>
                    {engineStatus === "checking" ? "Prüfe…" : engineStatus === "online" ? "Verbunden" : "Nicht verbunden"}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={checkEngineConnection}>
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
                        ? "bg-violet-600/15 text-violet-600 border-violet-500/30"
                        : "text-[#585866] border-[#e2e4ec] hover:border-[#b4b9c8]"
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
                  `bun install -g ${ENGINE_REPO_INSTALL}`,
                  "gbrain init --pglite",
                  "gbrain serve --http --with-worker --port 3001",
                ].map((cmd) => (
                  <div key={cmd} className="flex items-center gap-2 bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-4 py-2.5">
                    <code className="text-xs font-mono text-violet-600 flex-1">{cmd}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(cmd)}
                      className="text-[#585866] hover:text-[#585866] transition-colors shrink-0"
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
          <div className="p-6 border-b border-[#e2e4ec]">
            <h2 className="text-base font-semibold text-[#15151d]">API Keys</h2>
            <p className="text-sm text-[#585866] mt-1">Keys werden lokal gespeichert und nie an Server gesendet.</p>
          </div>
          <div className="px-6 divide-y divide-[#e2e4ec]">
            <Field label="OpenAI API Key" desc="Für Embeddings und Synthese (text-embedding-3-small)">
              <div className="space-y-2">
                <MaskedInput value={openaiKey} placeholder="sk-..." onChange={setOpenaiKey} />
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                  API Key erstellen <ExternalLink size={10} />
                </a>
              </div>
            </Field>

            <Field label="Anthropic API Key" desc="Für KI-Synthese (Claude 3.5 Sonnet)">
              <div className="space-y-2">
                <MaskedInput value={anthropicKey} placeholder="sk-ant-..." onChange={setAnthropicKey} />
                <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                  API Key erstellen <ExternalLink size={10} />
                </a>
              </div>
            </Field>

            <Field label="ZeroEntropy API Key" desc="Optionaler Reranker für höhere Suchqualität (+P@5)">
              <div className="space-y-2">
                <MaskedInput value={zeroEntropyKey} placeholder="ze-..." onChange={setZeroEntropyKey} />
                <Badge variant="info" className="text-xs">Optional — verbessert Recall deutlich</Badge>
              </div>
            </Field>
          </div>
          <div className="p-6 border-t border-[#e2e4ec]">
            <Button variant="glow" size="md" onClick={saveApiKeys}>
              {keysSaved ? "Gespeichert" : "Keys speichern"}
            </Button>
          </div>
        </Card>
      )}

      {/* Dream Cycle */}
      {activeTab === "dream" && (
        <Card>
          <div className="p-6 border-b border-[#e2e4ec]">
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-amber-600" />
              <div>
                <h2 className="text-base font-semibold text-[#15151d]">Dream Cycle</h2>
                <p className="text-sm text-[#585866]">Nächtliche Konsolidierung & Enrichment</p>
              </div>
              <Badge variant={dreamEnabled ? "success" : "warning"} className="ml-auto">
                {dreamEnabled ? "Aktiv" : "Inaktiv"}
              </Badge>
            </div>
          </div>
          <div className="px-6 divide-y divide-[#e2e4ec]">
            <Field label="Dream Cycle aktivieren" desc="Täglich um 3:00 Uhr morgens">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDreamEnabled(!dreamEnabled)}
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    dreamEnabled ? "bg-amber-500" : "bg-[#e2e4ec]"
                  )}
                >
                  <span className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                    dreamEnabled ? "translate-x-5" : "translate-x-1"
                  )} />
                </button>
                <span className="text-sm text-[#585866]">
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
                  <li key={item} className="flex items-start gap-2 text-sm text-[#585866]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </Field>
          </div>
        </Card>
      )}

      {/* Kanzlei */}
      {activeTab === "kanzlei" && (
        <Card>
          <div className="p-6 border-b border-[#e2e4ec]">
            <h2 className="text-base font-semibold text-[#15151d]">Kanzlei-Einstellungen</h2>
            <p className="text-sm text-[#585866] mt-1">Verrechnung, Stundensatz & Abrechnung</p>
          </div>
          <div className="px-6 divide-y divide-[#e2e4ec]">
            <Field label="Kanzlei-Name" desc="Für Rechnungskopf und Mandanten-Portal">
              <Input
                value={kanzleiName}
                onChange={(e) => setKanzleiName(e.target.value)}
                placeholder="Muster Rechtsanwälte Partnerschaft mbB"
              />
            </Field>

            <Field label="Anwalt / Rechnungssteller" desc="Name des Anwalts auf der Rechnung">
              <Input
                value={anwaltName}
                onChange={(e) => setAnwaltName(e.target.value)}
                placeholder="Dr. Max Mustermann, Rechtsanwalt"
              />
            </Field>

            <Field label="Kanzlei-Adresse" desc="Absender und Rechnungskopf">
              <textarea
                value={kanzleiAdresse}
                onChange={(e) => setKanzleiAdresse(e.target.value)}
                placeholder={"Musterstraße 1\n1010 Wien"}
                rows={3}
                className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2.5 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
              />
            </Field>

            <Field label="Kontakt" desc="Telefon, E-Mail und Kammer-/Registerangabe">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input value={kanzleiEmail} onChange={(e) => setKanzleiEmail(e.target.value)} placeholder="kanzlei@example.com" />
                <Input value={kanzleiTelefon} onChange={(e) => setKanzleiTelefon(e.target.value)} placeholder="+43 ..." />
                <Input value={kammerNummer} onChange={(e) => setKammerNummer(e.target.value)} placeholder="RAK / Register" />
              </div>
            </Field>

            <Field label="USt-ID-Nr." desc="Für DATEV-Export und Rechnungen (z. B. DE123456789)">
              <Input
                value={ustId}
                onChange={(e) => setUstId(e.target.value)}
                placeholder="DEXXXXXXXXX"
              />
            </Field>

            <Field label="Tarifmodell" desc="Basis für Gebührenberechnung und Verrechnung">
              <div className="flex gap-2">
                {([
                  { key: "custom", label: "Freier Satz" },
                  { key: "rvg", label: "RVG (Deutschland)" },
                  { key: "ratg", label: "RATG (Österreich)" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTarifModell(opt.key)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                      tarifModell === opt.key
                        ? "bg-violet-600/15 text-violet-600 border-violet-500/30"
                        : "text-[#585866] border-[#e2e4ec] hover:border-[#b4b9c8]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            {tarifModell === "custom" && (
              <>
                <Field label="Stundensatz (€)" desc="Standard-Satz für Zeiterfassung">
                  <div className="flex flex-wrap items-center gap-2">
                    <Euro size={14} className="text-[#585866]" />
                    <Input type="number" value={stundensatz} onChange={(e) => setStundensatz(e.target.value)} placeholder="200" className="w-32" />
                    <span className="text-sm text-[#585866]">/ Stunde</span>
                    <Input type="number" value={abrechnungstakt} onChange={(e) => setAbrechnungstakt(e.target.value)} placeholder="15" className="w-24 ml-2" />
                    <span className="text-sm text-[#585866]">Min.-Takt</span>
                  </div>
                </Field>

                <Field label="Stundensätze pro Rechtsgebiet" desc="Spezifische Sätze je nach Materie">
                  <div className="space-y-2">
                    {Object.entries(rechtsgebietSaetze).map(([gebiet, satz]) => (
                      <div key={gebiet} className="flex items-center gap-3">
                        <span className="text-sm text-[#585866] w-32 capitalize">{gebiet}</span>
                        <Euro size={12} className="text-[#585866]" />
                        <input
                          type="number"
                          value={String(satz)}
                          onChange={(e) => {
                            const updated = { ...rechtsgebietSaetze, [gebiet]: parseInt(e.target.value, 10) || 0 };
                            setRechtsgebietSaetze(updated);
                          }}
                          className="w-24 bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-1.5 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                        />
                        <span className="text-xs text-[#585866]">€/h</span>
                      </div>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {(tarifModell === "rvg" || tarifModell === "ratg") && (
              <div className="py-4">
                <div className="flex items-start gap-3 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-600">
                    {tarifModell === "rvg"
                      ? "RVG-Gebühren werden automatisch nach der deutschen Rechtsanwaltsvergütungsordnung berechnet. Stundensatz ist nur für Beratungen relevant."
                      : "RATG-Gebühren werden automatisch nach der österreichischen Rechtsanwaltstarifordnung berechnet. Stundensatz ist nur für Beratungen relevant."}
                  </p>
                </div>
              </div>
            )}

            <Field label="Bankverbindung" desc="Für den Rechnungsfuß und Zahlungsabgleich">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank" />
                <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN" />
                <Input value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BIC" />
              </div>
            </Field>

            <Field label="Zahlungsziel" desc="Standard-Fälligkeit neuer Rechnungen">
              <div className="flex items-center gap-2">
                <Input type="number" value={zahlungszielTage} onChange={(e) => setZahlungszielTage(e.target.value)} placeholder="14" className="w-24" />
                <span className="text-sm text-[#585866]">Tage netto</span>
              </div>
            </Field>

            <Field label="Rechnungsfuß" desc="Hinweistext unter der Rechnung">
              <textarea
                value={rechnungFooter}
                onChange={(e) => setRechnungFooter(e.target.value)}
                rows={3}
                className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2.5 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
              />
            </Field>

            <Field label="DATEV Kontenrahmen" desc="Für DATEV Unternehmen Online Export">
              <div className="flex gap-2">
                {([
                  { key: "SKR03", label: "SKR03 (DE)" },
                  { key: "SKR04", label: "SKR04 (DE)" },
                  { key: "SKR49", label: "SKR49 (AT)" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setDatevKontenrahmen(opt.key)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                      datevKontenrahmen === opt.key
                        ? "bg-emerald-600/15 text-emerald-600 border-emerald-500/30"
                        : "text-[#585866] border-[#e2e4ec] hover:border-[#b4b9c8]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="DATEV Berater-Nr." desc="Ihre Steuerberater-Nummer für DATEV">
              <Input value={datevBeraterNr} onChange={(e) => setDatevBeraterNr(e.target.value)} placeholder="12345" />
            </Field>

            <Field label="DATEV Mandanten-Nr." desc="Ihre Mandanten-Nummer beim Steuerberater">
              <Input value={datevMandantenNr} onChange={(e) => setDatevMandantenNr(e.target.value)} placeholder="67890" />
            </Field>

            <Field label="SMTP-Server" desc="E-Mail-Versand (z. B. mail.example.com)">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="mail.example.com" className="sm:col-span-2" />
                <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" className="w-24" />
                <label className="flex items-center gap-2 text-sm text-[#585866]">
                  <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} className="accent-violet-500" />
                  TLS
                </label>
              </div>
            </Field>

            <Field label="SMTP-Benutzer" desc="Login für den E-Mail-Versand">
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="kanzlei@example.com" />
            </Field>

            <Field label="SMTP-Passwort" desc="Passwort oder App-Passwort">
              <Input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder="••••••" />
            </Field>

            <Field label="Absender-Adresse" desc="E-Mail-Adresse im From-Feld">
              <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="kanzlei@example.com" />
            </Field>
          </div>
          <div className="p-6 border-t border-[#e2e4ec]">
            {kanzleiSaveError && (
              <p className="text-sm text-red-600 mb-3">Speichern fehlgeschlagen: {kanzleiSaveError}</p>
            )}
            <Button variant="glow" size="md" onClick={saveKanzleiProfile}>
              {kanzleiSaved ? "Gespeichert" : "Einstellungen speichern"}
            </Button>
          </div>
        </Card>
      )}

      {/* Team */}
      {activeTab === "team" && (
        <Card>
          <div className="p-6 border-b border-[#e2e4ec]">
            <h2 className="text-base font-semibold text-[#15151d]">Team</h2>
            <p className="text-sm text-[#585866] mt-1">Kanzlei-Mitarbeiter und Rollen</p>
          </div>
          <div className="px-6 divide-y divide-[#e2e4ec]">
            {teamMembers.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#585866]">Keine Team-Mitglieder gefunden.</div>
            ) : (
              teamMembers.map((member) => (
                <div key={member.id} className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-[#15151d]">{member.name}</div>
                    <div className="text-xs text-[#585866]">{member.email}</div>
                  </div>
                  <select
                    value={member.role}
                    onChange={async (e) => {
                      try {
                        const res = await fetch("/api/team/role", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: member.id, role: e.target.value }),
                        });
                        if (res.ok) {
                          setTeamMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: e.target.value } : m));
                        }
                      } catch (err) {
                        console.error("[team] failed to update role:", err instanceof Error ? err.message : String(err));
                      }
                    }}
                    className="bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-1.5 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="admin">Admin</option>
                    <option value="lawyer">Anwalt</option>
                    <option value="assistant">Sekretariat</option>
                    <option value="client_viewer">Client Viewer</option>
                  </select>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Account */}
      {activeTab === "account" && (
        <Card>
          <div className="p-6 border-b border-[#e2e4ec]">
            <h2 className="text-base font-semibold text-[#15151d]">Account</h2>
          </div>
          <div className="px-6 divide-y divide-[#e2e4ec]">
            <Field label="Plan" desc="Dein aktuelles Abonnement">
              <div className="flex items-center gap-3">
                <Badge variant="accent" className="text-sm px-3 py-1">Free</Badge>
                <Link href="/dashboard/billing">
                  <Button variant="outline" size="sm">
                    Upgrade auf Pro →
                  </Button>
                </Link>
              </div>
            </Field>
            <Field label="Nutzung" desc="Aktueller Monat">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#585866]">Seiten</span>
                    <span className="text-[#15151d] font-mono">0 / 100</span>
                  </div>
                  <div className="h-1.5 bg-[#e2e4ec] rounded-full">
                    <div className="h-full w-0 bg-violet-600 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#585866]">Queries</span>
                    <span className="text-[#15151d] font-mono">0 / 50</span>
                  </div>
                  <div className="h-1.5 bg-[#e2e4ec] rounded-full">
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
                  <Gift size={15} className="text-amber-600 shrink-0" />
                  <p className="text-xs text-[#585866] leading-relaxed">
                    12 Empfehlungen = ein Gratisjahr. Keine Obergrenze.
                    {referrals !== null && (
                      <span className="text-amber-600 font-medium"> Bisher geworben: {referrals}.</span>
                    )}
                  </p>
                </div>
                <MaskedInput
                  value={referralUrl}
                  placeholder="Empfehlungslink wird geladen…"
                />
                <Link
                  href="/partners"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                >
                  Mehr verdienen? Zum Partnerprogramm (30 % wiederkehrend) <ExternalLink size={10} />
                </Link>
              </div>
            </Field>
            <Field
              label="Datenexport (DSGVO)"
              desc="Alle deine Daten — Konto, Nutzung und das komplette Brain (Akten, Dokumente, Fristen) — als JSON-Datei (Art. 20 DSGVO)."
            >
              <a href="/api/export" download>
                <Button variant="outline" size="sm">
                  Daten exportieren ↓
                </Button>
              </a>
            </Field>
          </div>
        </Card>
      )}
    </div>
  );
}
