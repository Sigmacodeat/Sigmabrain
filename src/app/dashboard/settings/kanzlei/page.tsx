"use client";

import { useState, useEffect } from "react";
import { Building2, Save, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadKanzleiSettings, saveKanzleiSettings, type KanzleiSettings } from "@/lib/kanzlei-settings";

export default function KanzleiSettingsPage() {
  const [settings, setSettings] = useState<KanzleiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadKanzleiSettings()
      .then((s) => { setSettings(s); setLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Laden fehlgeschlagen."); setLoading(false); });
  }, []);

  const update = (field: keyof KanzleiSettings, value: string) => {
    setSettings((s) => (s ? { ...s, [field]: value } : s));
    setSaved(false);
  };

  async function handleSave() {
    if (!settings) return;
    setError(null);
    try {
      await saveKanzleiSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex items-center gap-2 text-[#8888aa]">
        <Loader2 size={16} className="animate-spin" /> Lade Kanzlei-Einstellungen…
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-red-300">{error ?? "Einstellungen konnten nicht geladen werden."}</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-600/15 border border-slate-500/20 flex items-center justify-center">
          <Building2 size={20} className="text-slate-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Kanzlei-Einstellungen</h1>
          <p className="text-sm text-[#8888aa]">Briefkopf, Bankverbindung, Logo für Rechnungen</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Kanzleiname" value={settings.kanzleiName} onChange={(v) => update("kanzleiName", v)} />
          <Field label="Straße" value={settings.street ?? ""} onChange={(v) => update("street", v)} />
          <Field label="PLZ" value={settings.zip ?? ""} onChange={(v) => update("zip", v)} />
          <Field label="Ort" value={settings.city ?? ""} onChange={(v) => update("city", v)} />
          <Field label="Telefon" value={settings.kanzleiTelefon ?? ""} onChange={(v) => update("kanzleiTelefon", v)} />
          <Field label="E-Mail" value={settings.kanzleiEmail ?? ""} onChange={(v) => update("kanzleiEmail", v)} />
          <Field label="Webseite" value={settings.website ?? ""} onChange={(v) => update("website", v)} />
          <Field label="USt-IdNr" value={settings.ustId} onChange={(v) => update("ustId", v)} />
          <Field label="Steuernummer" value={settings.taxNumber ?? ""} onChange={(v) => update("taxNumber", v)} />
          <Field label="Bank" value={settings.bankName ?? ""} onChange={(v) => update("bankName", v)} />
          <Field label="IBAN" value={settings.iban ?? ""} onChange={(v) => update("iban", v)} />
          <Field label="BIC" value={settings.bic ?? ""} onChange={(v) => update("bic", v)} />
          <div className="md:col-span-2">
            <Field label="Logo-URL (optional)" value={settings.logoUrl ?? ""} onChange={(v) => update("logoUrl", v)} />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            className="bg-slate-600 hover:bg-slate-500 text-white gap-2 text-sm"
            onClick={() => void handleSave()}
          >
            <Save size={14} />
            Speichern
          </Button>
          {saved && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={14} />
              Gespeichert
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[#8a8aa8]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-slate-500/50"
      />
    </div>
  );
}
