"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Loader2,
  Info,
  Archive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type CheckStatus = "ok" | "warn" | "fail";

interface ComplianceCheck {
  id: string;
  category: string;
  label: string;
  description: string;
}

// Die Checklisten-DEFINITION ist statisch (Art./§-Katalog). Der STATUS jeder
// Position ist eine Selbsteinschätzung der Kanzlei — er wird pro Brain auf
// der Seite `legal/compliance/selbstauskunft` persistiert, nicht simuliert.
const DSGVO_CHECKS: ComplianceCheck[] = [
  { id: "dsgvo-1", category: "Rechtsgrundlage", label: "Rechtsgrundlage dokumentiert", description: "Für jede Verarbeitung ist eine Rechtsgrundlage nach Art. 6 DSGVO festgelegt" },
  { id: "dsgvo-2", category: "Rechtsgrundlage", label: "Einwilligungen nachweisbar", description: "Einwilligungen sind dokumentiert und widerrufbar (Art. 7 DSGVO)" },
  { id: "dsgvo-3", category: "Betroffenenrechte", label: "Auskunftsverfahren", description: "Verfahren für Betroffenenanfragen (Art. 15 DSGVO)" },
  { id: "dsgvo-4", category: "Betroffenenrechte", label: "Löschungsverfahren", description: "Verfahren für Löschungsanfragen (Art. 17 DSGVO)" },
  { id: "dsgvo-5", category: "Dokumentation", label: "Verzeichnis der Verarbeitungstätigkeiten", description: "Art. 30 DSGVO — Verarbeitungsverzeichnis geführt" },
  { id: "dsgvo-6", category: "Dokumentation", label: "Datenschutz-Folgenabschätzung", description: "DSFA bei risikoreichen Verarbeitungen (Art. 35 DSGVO)" },
  { id: "dsgvo-7", category: "Technisch", label: "Pseudonymisierung", description: "Technische Maßnahmen zur Pseudonymisierung (Art. 32 DSGVO)" },
  { id: "dsgvo-8", category: "Technisch", label: "Verschlüsselung", description: "Verschlüsselung personenbezogener Daten (Art. 32 DSGVO)" },
  { id: "dsgvo-9", category: "Organisatorisch", label: "Zugriffskontrolle", description: "Berechtigungskonzept implementiert" },
  { id: "dsgvo-10", category: "Organisatorisch", label: "Schulung der Mitarbeiter", description: "Regelmäßige Datenschutz-Schulung" },
];

const GWG_CHECKS: ComplianceCheck[] = [
  { id: "gwg-1", category: "Identifizierung", label: "Mandantenidentifizierung", description: "Identitätsprüfung neuer Mandanten (§ 11 GwG)" },
  { id: "gwg-2", category: "Identifizierung", label: "Wirtschaftlicher Eigentümer", description: "Ermittlung des wirtschaftlichen Eigentümers (§ 3 GwG)" },
  { id: "gwg-3", category: "Screening", label: "Sanktionslistenprüfung", description: "Prüfung gegen EU-Sanktionslisten" },
  { id: "gwg-4", category: "Screening", label: "PEP-Prüfung", description: "Politically Exposed Persons Screening (§ 15 GwG)" },
  { id: "gwg-5", category: "Dokumentation", label: "Verdachtsanzeigen", description: "Verfahren für Verdachtsmeldungen nach § 43 GwG" },
  { id: "gwg-6", category: "Dokumentation", label: "Aufbewahrungspflichten", description: "Unterlagen werden 5 Jahre aufbewahrt (§ 8 GwG)" },
];

// GoBD-Checkliste für die Steuer-Vertikale. Die Engine liefert mit gobd.ts
// bereits Bausteine (Aufbewahrungsfrist-Stempel + Hash-Manipulations-Evidenz auf
// Belegen); volle Konformität verlangt zusätzlich diese organisatorischen Punkte
// + Verfahrensdokumentation + Prüfer-Abnahme. Status ist Selbsteinschätzung.
const GOBD_CHECKS: ComplianceCheck[] = [
  { id: "gobd-1", category: "Unveränderbarkeit", label: "Belege unveränderbar gespeichert", description: "Nachträgliche Änderungen ausgeschlossen oder protokolliert; Belege tragen einen Inhalts-Hash (§ 146 Abs. 4 AO, GoBD Rz. 107 ff.)" },
  { id: "gobd-2", category: "Aufbewahrung", label: "10-Jahre-Aufbewahrung", description: "Buchungsbelege werden 10 Jahre aufbewahrt; Frist je Beleg vermerkt (§ 147 Abs. 3 AO)" },
  { id: "gobd-3", category: "Nachvollziehbarkeit", label: "Belegfunktion & Nachvollziehbarkeit", description: "Jede Buchung ist durch einen Beleg nachvollziehbar (GoBD Rz. 36 ff.)" },
  { id: "gobd-4", category: "Dokumentation", label: "Verfahrensdokumentation", description: "Verfahrensdokumentation beschreibt den DV-gestützten Ablage- und Buchungsprozess (GoBD Rz. 151 ff.)" },
  { id: "gobd-5", category: "Auswertbarkeit", label: "Maschinelle Auswertbarkeit", description: "Steuerlich relevante Daten sind maschinell auswertbar/exportierbar — z. B. DATEV-Export (GoBD Rz. 126 ff.)" },
  { id: "gobd-6", category: "Kontrolle", label: "Internes Kontrollsystem", description: "IKS zur Sicherung der Ordnungsmäßigkeit eingerichtet (GoBD Rz. 100 ff.)" },
  { id: "gobd-7", category: "Sicherheit", label: "Datensicherheit & Zugriffsschutz", description: "Schutz vor Verlust und unberechtigtem Zugriff (GoBD Rz. 103 ff.)" },
];

const STATE_SLUG = "legal/compliance/selbstauskunft";
const STATUS_CYCLE: CheckStatus[] = ["ok", "warn", "fail"];

const STATUS_LABEL: Record<CheckStatus, string> = { ok: "OK", warn: "Offen", fail: "Fehlt" };

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<"dsgvo" | "gwg" | "gobd">("dsgvo");
  const [statuses, setStatuses] = useState<Record<string, CheckStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await api.brain.getPage(STATE_SLUG);
        const fm = (page.frontmatter ?? {}) as Record<string, unknown>;
        const stored = fm.check_statuses;
        if (!cancelled && stored && typeof stored === "object") {
          setStatuses(stored as Record<string, CheckStatus>);
        }
      } catch {
        // Seite existiert noch nicht — alle Checks starten als "warn" (offen)
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (next: Record<string, CheckStatus>) => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.brain.updatePage({
        slug: STATE_SLUG,
        title: "Compliance-Selbstauskunft",
        type: "document",
        frontmatter: {
          check_statuses: next,
          updated_via: "dashboard",
        },
      });
    } catch {
      setSaveError("Speichern fehlgeschlagen — Änderung ist nur lokal sichtbar.");
    } finally {
      setSaving(false);
    }
  }, []);

  function cycleStatus(id: string) {
    setStatuses((prev) => {
      const current = prev[id] ?? "warn";
      const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
      const next = { ...prev, [id]: nextStatus };
      void persist(next);
      return next;
    });
  }

  const checks = activeTab === "dsgvo" ? DSGVO_CHECKS : activeTab === "gwg" ? GWG_CHECKS : GOBD_CHECKS;
  const statusOf = (c: ComplianceCheck): CheckStatus => statuses[c.id] ?? "warn";
  const okCount = checks.filter((c) => statusOf(c) === "ok").length;
  const warnCount = checks.filter((c) => statusOf(c) === "warn").length;
  const failCount = checks.filter((c) => statusOf(c) === "fail").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center" aria-hidden="true">
          <ShieldCheck size={20} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#15151d]">Compliance-Selbstauskunft</h1>
          <p className="text-sm text-[#585866]">DSGVO-, GwG- & GoBD-Checkliste für die Kanzlei — Status pro Punkt selbst pflegen</p>
        </div>
      </div>

      {/* Honest framing: this is a maintained checklist, not an automated audit */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5" role="note">
        <Info size={16} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-amber-400 leading-relaxed">
          Diese Checkliste ist eine <strong>Selbsteinschätzung</strong> und wird im Brain
          gespeichert. Sie ersetzt keine Datenschutz-Beratung und keine automatische Prüfung.
          Klicke auf einen Punkt, um den Status zu ändern (OK → Offen → Fehlt).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" role="tablist" aria-label="Compliance-Bereich">
        <button
          role="tab"
          aria-selected={activeTab === "dsgvo"}
          onClick={() => setActiveTab("dsgvo")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
            activeTab === "dsgvo"
              ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400"
              : "bg-[#ffffff] border-[#e2e4ec] text-[#585866] hover:text-[#15151d]"
          )}
        >
          <Lock size={14} aria-hidden="true" />
          DSGVO
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "gwg"}
          onClick={() => setActiveTab("gwg")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
            activeTab === "gwg"
              ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
              : "bg-[#ffffff] border-[#e2e4ec] text-[#585866] hover:text-[#15151d]"
          )}
        >
          <ShieldAlert size={14} aria-hidden="true" />
          GwG
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "gobd"}
          onClick={() => setActiveTab("gobd")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
            activeTab === "gobd"
              ? "bg-violet-600/10 border-violet-500/30 text-violet-400"
              : "bg-[#ffffff] border-[#e2e4ec] text-[#585866] hover:text-[#15151d]"
          )}
        >
          <Archive size={14} aria-hidden="true" />
          GoBD
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <div className="text-xl font-bold text-emerald-400">{okCount}</div>
          <div className="text-xs text-[#585866]">OK</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <div className="text-xl font-bold text-amber-400">{warnCount}</div>
          <div className="text-xs text-[#585866]">Offen</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <div className="text-xl font-bold text-red-400">{failCount}</div>
          <div className="text-xs text-[#585866]">Fehlt</div>
        </div>
      </div>

      {/* Save state */}
      <div aria-live="polite" className="min-h-5 text-xs">
        {saving && (
          <span className="inline-flex items-center gap-1.5 text-[#585866]">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Speichert…
          </span>
        )}
        {saveError && <span className="text-red-400">{saveError}</span>}
      </div>

      {/* Checks list */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Checkliste wird geladen">
          <Loader2 size={24} className="text-violet-400 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-2">
          {checks.map((check) => {
            const status = statusOf(check);
            return (
              <button
                key={check.id}
                onClick={() => cycleStatus(check.id)}
                aria-label={`${check.label} — Status: ${STATUS_LABEL[status]}. Klicken zum Ändern.`}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400",
                  status === "ok"
                    ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                    : status === "warn"
                    ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40"
                    : "border-red-500/20 bg-red-500/5 hover:border-red-500/40"
                )}
              >
                <div className="shrink-0 mt-0.5" aria-hidden="true">
                  {status === "ok" ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : status === "warn" ? (
                    <AlertTriangle size={16} className="text-amber-400" />
                  ) : (
                    <XCircle size={16} className="text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#15151d]">{check.label}</span>
                    <Badge variant="default" className={cn(
                      "text-[10px] border",
                      status === "ok"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : status === "warn"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {STATUS_LABEL[status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#585866] mt-1">{check.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
