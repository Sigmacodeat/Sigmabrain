"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Smartphone,
  Bell,
  Camera,
  Fingerprint,
  Share2,
  Loader2,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { detectCapabilities, registerPush, capturePhoto, biometricAuth, nativeShare, type MobileCapabilities } from "@/lib/mobile-bridge";

export default function MobilePage() {
  const [caps, setCaps] = useState<MobileCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<string>("");
  const [bioStatus, setBioStatus] = useState<string>("");
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    detectCapabilities().then((c) => {
      setCaps(c);
      setLoading(false);
    });
  }, []);

  async function handlePush() {
    setPushStatus("Registriere…");
    const res = await registerPush();
    setPushStatus(res.error || "Push-Token erhalten");
  }

  async function handlePhoto() {
    setPhoto(null);
    const res = await capturePhoto();
    if (res.base64) {
      setPhoto(`data:image/jpeg;base64,${res.base64}`);
    } else if (res.error) {
      // Fallback: trigger file input
      document.getElementById("mobile-file-input")?.click();
    }
  }

  async function handleBiometric() {
    setBioStatus("Prüfe…");
    const res = await biometricAuth();
    setBioStatus(res.success ? "Authentifiziert" : res.error || "Fehlgeschlagen");
  }

  async function handleShare() {
    await nativeShare({
      title: "Sigmabrain",
      text: "Mein Kanzlei-OS für rechtliche Intelligenz.",
      url: "https://sigmabrain.com",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="text-violet-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-600/15 border border-teal-500/20 flex items-center justify-center">
          <Smartphone size={20} className="text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#15151d]">Mobile</h1>
          <p className="text-sm text-[#585866]">
            {caps?.isNative ? `Native App (${caps.platform})` : "Web / PWA-Modus"}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "push", label: "Push", icon: Bell, available: caps?.push },
          { key: "camera", label: "Kamera", icon: Camera, available: caps?.camera },
          { key: "biometric", label: "Biometrie", icon: Fingerprint, available: caps?.biometric },
          { key: "share", label: "Teilen", icon: Share2, available: caps?.share },
        ].map((f) => (
          <div
            key={f.key}
            className={cn(
              "rounded-xl border p-3 text-center",
              f.available ? "border-emerald-500/20 bg-emerald-500/5" : "border-[#e2e4ec] bg-[#ffffff]"
            )}
          >
            <f.icon size={18} className={cn("mx-auto mb-2", f.available ? "text-emerald-600" : "text-[#74748a]")} />
            <div className="text-xs text-[#585866]">{f.label}</div>
            <div className={cn("text-xs font-medium", f.available ? "text-emerald-600" : "text-[#74748a]")}>
              {f.available ? "Verfügbar" : "Nicht verfügbar"}
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="space-y-3">
        {/* Push */}
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Bell size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#15151d]">Push-Benachrichtigungen</p>
              <p className="text-xs text-[#585866]">
                {pushStatus || (caps?.push ? "Bereit zur Registrierung" : "Nur in nativer App verfügbar")}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            className="bg-teal-600 hover:bg-teal-500 text-white text-sm gap-2"
            disabled={!caps?.push}
            onClick={handlePush}
          >
            <Bell size={14} />
            Registrieren
          </Button>
        </div>

        {/* Camera */}
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Camera size={18} className="text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#15151d]">Dokumenten-Scan</p>
                <p className="text-xs text-[#585866]">
                  {caps?.camera ? "Kamera verfügbar" : "Datei-Upload als Fallback"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm gap-2"
                onClick={handlePhoto}
              >
                <Camera size={14} />
                Scannen
              </Button>
              <input
                id="mobile-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setPhoto(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>
          </div>
          {photo && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2">
              <Image src={photo} alt="Scan" width={320} height={192} unoptimized className="max-h-48 rounded mx-auto object-contain" />
              <p className="text-[11px] text-[#585866] text-center mt-1">Vorschau — speichern in Akte über Upload</p>
            </div>
          )}
        </div>

        {/* Biometric */}
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Fingerprint size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#15151d]">Biometrische Entsperrung</p>
              <p className="text-xs text-[#585866]">
                {bioStatus || (caps?.biometric ? "Face ID / Touch ID / Fingerabdruck" : "Nur in nativer App")}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            className="bg-amber-600 hover:bg-amber-500 text-white text-sm gap-2"
            disabled={!caps?.biometric}
            onClick={handleBiometric}
          >
            <Fingerprint size={14} />
            Testen
          </Button>
        </div>

        {/* Share */}
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Share2 size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#15151d]">Teilen</p>
              <p className="text-xs text-[#585866]">Native Share Sheet oder Web Share API</p>
            </div>
          </div>
          <Button
            variant="primary"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-2"
            disabled={!caps?.share}
            onClick={handleShare}
          >
            <Share2 size={14} />
            Teilen
          </Button>
        </div>
      </div>

      {/* Install hint */}
      {!caps?.isNative && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
          <div className="flex items-start gap-3">
            <QrCode size={18} className="text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-teal-600 font-medium">Native App installieren</p>
              <p className="text-xs text-[#585866] mt-1">
                Für Push, Biometrie und Kamera-Scan: Baue die Capacitor-App mit{" "}
                <code className="font-mono text-xs bg-[#eceef3] px-1.5 py-0.5 rounded">bun run build:mobile</code>.
                Siehe <code className="font-mono text-xs bg-[#eceef3] px-1.5 py-0.5 rounded">mobile/README.md</code>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
