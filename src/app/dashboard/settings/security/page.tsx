"use client";

import { useState } from "react";
import { Shield, QrCode, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SecuritySettingsPage() {
  const [step, setStep] = useState<"idle" | "setup" | "verify">("idle");
  const [secret, setSecret] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  async function startSetup() {
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSecret(data.secret);
      setQrUrl(data.qrData);
      setStep("setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup fehlgeschlagen");
    }
  }

  async function verify() {
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnabled(true);
      setStep("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verifizierung fehlgeschlagen");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-600/15 border border-amber-500/20 flex items-center justify-center">
          <Shield size={20} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#e8e8f0]">Sicherheit</h1>
          <p className="text-sm text-[#8888aa]">Zwei-Faktor-Authentifizierung</p>
        </div>
      </div>

      {enabled ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <div>
            <p className="text-sm text-emerald-400 font-medium">2FA ist aktiviert</p>
            <p className="text-xs text-[#8888aa]">Ihr Account ist durch TOTP-geschützt.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4 space-y-4">
          <div className="flex items-start gap-3">
            <KeyRound size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[#e8e8f0] font-medium">Zwei-Faktor-Authentifizierung (2FA)</p>
              <p className="text-xs text-[#8888aa] mt-1">
                Schützen Sie Ihren Account mit einem zeitbasierten Einmalcode (TOTP).
                Scannen Sie den QR-Code mit einer Authenticator-App (z.B. Google Authenticator, Authy).
              </p>
            </div>
          </div>

          {step === "idle" && (
            <Button
              variant="primary"
              className="bg-amber-600 hover:bg-amber-500 text-white gap-2 text-sm"
              onClick={startSetup}
            >
              <QrCode size={14} />
              2FA einrichten
            </Button>
          )}

          {step === "setup" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#1e1e3a] bg-[#0a0a18] p-4 text-center space-y-2">
                <p className="text-xs text-[#8888aa]">QR-Code scannen:</p>
                <QRCodeSVG data={qrUrl} size={180} />
                <p className="text-[10px] text-[#8a8aa8] font-mono break-all">{secret}</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="6-stelliger Code"
                  maxLength={6}
                  className="flex-1 bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-amber-500/50 text-center tracking-widest"
                />
                <Button
                  variant="primary"
                  className="bg-amber-600 hover:bg-amber-500 text-white text-sm"
                  onClick={verify}
                  disabled={token.length !== 6}
                >
                  Verifizieren
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Simple SVG QR-Code renderer (placeholder — real QR generation needs a library) */
function QRCodeSVG({ data, size }: { data: string; size: number }) {
  // Placeholder: show a grid pattern. In production use qrcode library.
  return (
    <div
      className="inline-block border border-[#1e1e3a] bg-white rounded"
      style={{ width: size, height: size }}
      title={data}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: 25 }).map((_, y) =>
          Array.from({ length: 25 }).map((_, x) => {
            const hash = (x * 7 + y * 13 + data.length * 3) % 2;
            return (
              <rect
                key={`${x}-${y}`}
                x={x * (size / 25)}
                y={y * (size / 25)}
                width={size / 25}
                height={size / 25}
                fill={hash === 0 ? "#000" : "#fff"}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
