"use client";

// Billing & plan management. Talks to /api/auth/me and /api/billing/checkout.
// Shows an honest "not configured" state until Stripe env vars are set.

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Check, ArrowRight, AlertTriangle, Sparkles, Gift, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Usage {
  month: string;
  queries: number;
  plan: string;
  limits: { pages: number; queriesPerMonth: number; seats: number };
  shared: boolean;
}

/** Fair-use meter — the "live usage display" the pricing page promises. */
function UsageCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [stats, setStats] = useState<{ total_pages: number } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/usage").then((r) => (r.ok ? r.json() : null)).then(setUsage).catch(() => null);
      fetch("/api/stats").then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => null);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!usage) return null;

  const rows = [
    { label: `Queries (${usage.month})`, used: usage.queries, max: usage.limits.queriesPerMonth },
    ...(stats ? [{ label: "Seiten im Brain", used: stats.total_pages, max: usage.limits.pages }] : []),
  ];

  return (
    <Card>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Gauge size={16} className="text-violet-400" aria-hidden />
            <h2 className="text-sm font-semibold text-[#15151d]">Verbrauch (Fair Use)</h2>
          </div>
          {usage.shared && <Badge>Team-Pool</Badge>}
        </div>
        {rows.map((row) => {
          const pct = Math.min(100, Math.round((row.used / row.max) * 100));
          const warn = pct >= 80;
          return (
            <div key={row.label}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs text-[#585866]">{row.label}</span>
                <span className={`text-xs font-mono ${warn ? "text-amber-400" : "text-[#585866]"}`}>
                  {row.used.toLocaleString("de-DE")} / {row.max.toLocaleString("de-DE")}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full bg-[#e2e4ec] overflow-hidden"
                role="progressbar"
                aria-valuenow={row.used}
                aria-valuemin={0}
                aria-valuemax={row.max}
                aria-label={row.label}
              >
                <div
                  className={`h-full rounded-full transition-all ${warn ? "bg-amber-500" : "bg-violet-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-[#585866] leading-relaxed">
          Fair Use heißt: Beim Erreichen des Limits drosseln wir nicht still und es gibt keine
          Überraschungsrechnung — wir melden uns und besprechen das passende Paket.
        </p>
      </div>
    </Card>
  );
}

interface Me {
  user: {
    id: string;
    email: string;
    name: string;
    plan: string;
    referralCode: string;
  } | null;
  referrals?: number;
}

const PLANS = [
  {
    id: "free", name: "Free", price: "0 €",
    features: ["100 Seiten", "1 GB Dateispeicher", "50 Queries/Monat", "1 Brain", "Community-Support"],
  },
  {
    id: "pro", name: "Pro", price: "79 €/Monat",
    features: ["25.000 Seiten", "50 GB Cloud-Dateispeicher", "Fair-Use-Queries", "Dream Cycle 24/7", "E-Mail-, Dokumenten- & WhatsApp-Medien-Import", "Prioritäts-Support"],
    highlight: true,
  },
  {
    id: "team", name: "Team", price: "290 €/Monat",
    features: ["5 Seats inklusive", "250 GB Cloud-Dateispeicher", "Geteiltes Firmen-Brain", "Scoped Access pro Nutzer", "Admin & Analytics", "Onboarding-Session"],
  },
];

function BillingInner() {
  const params = useSearchParams();
  const status = params.get("status");
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null }));
  }, []);

  // Auto-start checkout when arriving from a pricing-tier CTA
  // (/dashboard/billing?checkout=pro|team), once the session is loaded.
  useEffect(() => {
    if (!me?.user || autoTriggered.current) return;
    const checkout = params.get("checkout");
    if ((checkout === "pro" || checkout === "team") && me.user.plan !== checkout) {
      autoTriggered.current = true;
      void upgrade(checkout);
    }
  }, [me, params]);

  async function upgrade(plan: string) {
    setBusy(plan);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.status === 501) {
        setNotice(
          "Stripe ist noch nicht verbunden. Sobald STRIPE_SECRET_KEY und die Preis-IDs gesetzt sind, läuft der Checkout hier durch — der Code ist fertig.",
        );
      } else if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      } else {
        setNotice(data.message ?? "Checkout fehlgeschlagen. Bitte erneut versuchen.");
      }
    } catch {
      setNotice("Netzwerkfehler. Bitte erneut versuchen.");
    }
    setBusy(null);
  }

  const currentPlan = me?.user?.plan ?? "free";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#15151d]">Abrechnung</h1>
        <p className="text-sm text-[#585866] mt-0.5">Plan, Zahlung und Empfehlungs-Guthaben</p>
      </div>

      {status === "success" && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <Sparkles size={16} className="text-emerald-400" />
          <p className="text-sm text-emerald-300">Zahlung erfolgreich — dein Plan wird in Kürze aktualisiert.</p>
        </div>
      )}
      {status === "cancelled" && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle size={16} className="text-amber-400" />
          <p className="text-sm text-amber-300">Checkout abgebrochen — dein bisheriger Plan bleibt aktiv.</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
          <CreditCard size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-300">{notice}</p>
        </div>
      )}

      <UsageCard />

      {/* Current plan */}
      <Card>
        <div className="p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-[#585866] uppercase tracking-wider mb-1">Aktueller Plan</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-[#15151d] capitalize">{currentPlan}</span>
              <Badge variant={currentPlan === "free" ? "default" : "accent"}>
                {currentPlan === "free" ? "Kostenlos" : "Aktiv"}
              </Badge>
            </div>
            {me?.user && <p className="text-xs text-[#585866] mt-1">{me.user.email}</p>}
          </div>
          {typeof me?.referrals === "number" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <Gift size={16} className="text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-[#15151d]">{me.referrals} Empfehlung{me.referrals === 1 ? "" : "en"}</p>
                <p className="text-xs text-[#585866]">= {me.referrals} Gratismonat{me.referrals === 1 ? "" : "e"} verdient</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={`p-6 rounded-2xl border flex flex-col ${
                plan.highlight && !isCurrent
                  ? "border-violet-500/50 bg-gradient-to-b from-violet-500/10 to-[#ffffff]"
                  : "border-[#e2e4ec] bg-[#ffffff]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-[#585866]">{plan.name}</p>
                {isCurrent && <Badge variant="success">Aktiv</Badge>}
              </div>
              <p className="text-2xl font-bold text-[#15151d] mb-4">{plan.price}</p>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[#585866]">
                    <Check size={13} className="text-violet-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.id !== "free" && !isCurrent && (
                <Button
                  variant={plan.highlight ? "glow" : "secondary"}
                  size="md"
                  className="w-full"
                  loading={busy === plan.id}
                  onClick={() => upgrade(plan.id)}
                >
                  Upgrade <ArrowRight size={13} />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#585866]">
        Enterprise (EU-/On-Prem-Hosting, AVV, SSO)?{" "}
        <a href="mailto:hello@sigmabrain.com" className="text-violet-400 hover:underline">Sprich mit uns</a>.
        Jahreszahlung −20 % — im Checkout wählbar.
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6" />}>
      <BillingInner />
    </Suspense>
  );
}
