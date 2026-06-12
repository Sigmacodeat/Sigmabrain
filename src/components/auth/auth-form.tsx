"use client";

// Login + Signup — one component, two modes, two languages.
// Glass card on the marketing background; full keyboard / screen-reader support.

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, User as UserIcon, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaLogo } from "@/components/brand/logo";
import { MarketingBackground } from "@/components/marketing/chrome";
import { p, type Lang } from "@/content/site";

const COPY = {
  en: {
    login: {
      title: "Welcome back",
      sub: "Your brain kept working while you were gone.",
      cta: "Sign in",
      switchText: "No account yet?",
      switchCta: "Start free",
    },
    signup: {
      title: "Create your brain",
      sub: "Free to start. First answer in minutes.",
      cta: "Create account",
      switchText: "Already have an account?",
      switchCta: "Sign in",
    },
    email: "Email",
    password: "Password",
    passwordHint: "At least 8 characters",
    name: "Name",
    industry: "Your industry (optional)",
    industryHint: "Tunes your dashboard — example questions, getting-started guides.",
    industries: {
      "": "Please choose…",
      legal: "Law firm / legal team",
      tax: "Tax & accounting",
      vc: "VC / Private Equity",
      consulting: "Consulting / agency",
      recruiting: "Executive search / recruiting",
      insurance: "Insurance",
      medical: "Medical practice",
      other: "Other",
    } as Record<string, string>,
    errors: {
      invalid_credentials: "Email or password is incorrect.",
      email_taken: "An account with this email already exists.",
      weak_password: "Password must be at least 8 characters.",
      invalid_email: "Please enter a valid email address.",
      invalid_name: "Please enter your name.",
      generic: "Something went wrong. Please try again.",
    } as Record<string, string>,
    referralNote: "You were referred — your first month on a paid plan is free.",
  },
  de: {
    login: {
      title: "Willkommen zurück",
      sub: "Dein Brain hat weitergearbeitet, während du weg warst.",
      cta: "Anmelden",
      switchText: "Noch kein Konto?",
      switchCta: "Kostenlos starten",
    },
    signup: {
      title: "Erstelle dein Brain",
      sub: "Kostenloser Start. Erste Antwort in Minuten.",
      cta: "Konto erstellen",
      switchText: "Schon ein Konto?",
      switchCta: "Anmelden",
    },
    email: "E-Mail",
    password: "Passwort",
    passwordHint: "Mindestens 8 Zeichen",
    name: "Name",
    industry: "Deine Branche (optional)",
    industryHint: "Stimmt dein Dashboard ab — Beispiel-Fragen, Einstiegs-Guides.",
    industries: {
      "": "Bitte wählen…",
      legal: "Kanzlei / Rechtsabteilung",
      tax: "Steuerberatung & WP",
      vc: "VC / Private Equity",
      consulting: "Beratung / Agentur",
      recruiting: "Executive Search / Recruiting",
      insurance: "Versicherung",
      medical: "Arztpraxis",
      other: "Andere",
    } as Record<string, string>,
    errors: {
      invalid_credentials: "E-Mail oder Passwort ist falsch.",
      email_taken: "Ein Konto mit dieser E-Mail existiert bereits.",
      weak_password: "Das Passwort braucht mindestens 8 Zeichen.",
      invalid_email: "Bitte gib eine gültige E-Mail-Adresse ein.",
      invalid_name: "Bitte gib deinen Namen ein.",
      generic: "Etwas ist schiefgelaufen. Bitte versuch es erneut.",
    } as Record<string, string>,
    referralNote: "Du wurdest empfohlen — dein erster Monat auf einem Bezahlplan ist gratis.",
  },
} as const;

function AuthFormInner({ mode, lang }: { mode: "login" | "signup"; lang: Lang }) {
  const t = COPY[lang];
  const m = t[mode];
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Product-line landing pages (Subsumio/Taxumio) deep-link to
  // /signup?industry=legal — prefill from the URL when it's a known value.
  const industryParam = params.get("industry") ?? "";
  const [industry, setIndustry] = useState(
    industryParam && industryParam in COPY.en.industries ? industryParam : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { name, email, password, locale: lang, ...(industry ? { industry } : {}) }
            : { email, password },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t.errors[data.error] ?? t.errors.generic);
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError(t.errors.generic);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center px-6 py-12" lang={lang}>
      <MarketingBackground />
      <div className="relative z-10 w-full max-w-md">
        <Link href={p(lang, "")} className="flex justify-center mb-8" aria-label="Sigmabrain home">
          <SigmaLogo size={38} wordmarkClassName="text-xl font-bold text-[#e8e8f0] tracking-tight" />
        </Link>

        <div className="glass rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h1 className="text-2xl font-black text-[#e8e8f0] mb-1">{m.title}</h1>
          <p className="text-sm text-[#8888aa] mb-7">{m.sub}</p>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === "signup" && (
              <label className="block">
                <span className="text-xs font-medium text-[#8888aa] mb-1.5 block">{t.name}</span>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a6a]" aria-hidden />
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:outline-none focus:border-violet-500/60"
                  />
                </div>
              </label>
            )}
            <label className="block">
              <span className="text-xs font-medium text-[#8888aa] mb-1.5 block">{t.email}</span>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a6a]" aria-hidden />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:outline-none focus:border-violet-500/60"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#8888aa] mb-1.5 block">{t.password}</span>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a6a]" aria-hidden />
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:outline-none focus:border-violet-500/60"
                />
              </div>
              {mode === "signup" && <span className="text-xs text-[#4a4a6a] mt-1 block">{t.passwordHint}</span>}
              {mode === "login" && (
                <Link href={p(lang, "/forgot")} className="text-xs text-violet-400 hover:underline mt-1.5 inline-block">
                  {lang === "de" ? "Passwort vergessen?" : "Forgot password?"}
                </Link>
              )}
            </label>

            {mode === "signup" && (
              <label className="block">
                <span className="text-xs font-medium text-[#8888aa] mb-1.5 block">{t.industry}</span>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/60"
                >
                  {Object.entries(t.industries).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <span className="text-xs text-[#4a4a6a] mt-1 block">{t.industryHint}</span>
              </label>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" aria-hidden />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            <Button type="submit" variant="glow" size="lg" className="w-full" loading={loading}>
              {m.cta} <ArrowRight size={15} />
            </Button>
          </form>

          <p className="text-xs text-[#8888aa] text-center mt-6">
            {m.switchText}{" "}
            <Link
              href={`${p(lang, mode === "login" ? "/signup" : "/login")}${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="text-violet-400 hover:underline font-medium"
            >
              {m.switchCta}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthForm(props: { mode: "login" | "signup"; lang: Lang }) {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#06060f]" />}>
      <AuthFormInner {...props} />
    </Suspense>
  );
}
