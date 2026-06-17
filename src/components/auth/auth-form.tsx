"use client";

// Login + Signup — one component, two modes, two languages.
// Glass card on the marketing background; full keyboard / screen-reader support.
// v2: adds WorkOS SSO buttons (Microsoft, Google).

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigmaLogo } from "@/components/brand/logo";
import { SubsumioLogo } from "@/components/brand/subsumio-logo";
import { brandForHost } from "@/lib/brand";
import { MarketingBackground } from "@/components/marketing/chrome";
import { p, type Lang } from "@/content/site";
import { INDUSTRY_PROFILES, isValidIndustry } from "@/lib/industry-pack";
import { styleForIndustry } from "@/lib/industry-theme";

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
    industryPlaceholder: "Please choose…",
    otherIndustry: "Other",
    errors: {
      invalid_credentials: "Email or password is incorrect.",
      email_taken: "An account with this email already exists.",
      weak_password: "Password must be at least 8 characters.",
      invalid_email: "Please enter a valid email address.",
      invalid_name: "Please enter your name.",
      sso_required: "Please use the Microsoft or Google button to sign in.",
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
    industryPlaceholder: "Bitte wählen…",
    otherIndustry: "Andere",
    errors: {
      invalid_credentials: "E-Mail oder Passwort ist falsch.",
      email_taken: "Ein Konto mit dieser E-Mail existiert bereits.",
      weak_password: "Das Passwort braucht mindestens 8 Zeichen.",
      invalid_email: "Bitte gib eine gültige E-Mail-Adresse ein.",
      invalid_name: "Bitte gib deinen Namen ein.",
      sso_required: "Bitte nutze die Microsoft- oder Google-Anmeldung.",
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
  // Pricing-tier CTAs deep-link with ?plan=pro|team → after signup, land on
  // billing with auto-checkout for that plan. Explicit ?next= wins.
  const planParam = params.get("plan");
  const planNext = planParam === "pro" || planParam === "team"
    ? `/dashboard/billing?checkout=${planParam}`
    : null;
  const next = params.get("next") || planNext || "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Product-line landing pages (Subsumio/Taxumio) deep-link to
  // /signup?industry=legal — prefill from the URL when it's a known value.
  const industryParam = params.get("industry") ?? "";
  const [industry, setIndustry] = useState(isValidIndustry(industryParam) ? industryParam : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoConfigured, setSsoConfigured] = useState(false);
  const [isSubsumio, setIsSubsumio] = useState(false);
  useEffect(() => {
    const o = new URLSearchParams(window.location.search).get("brand");
    setIsSubsumio(o === "subsumio" || (o !== "sigmabrain" && brandForHost(window.location.host) === "subsumio"));
  }, []);

  useEffect(() => {
    // Probe whether WorkOS SSO is configured
    fetch("/api/auth/sso/workos")
      .then((r) => setSsoConfigured(r.ok))
      .catch(() => setSsoConfigured(false));
  }, []);

  async function startSso(provider: "MicrosoftOAuth" | "GoogleOAuth") {
    setSsoLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/sso/workos?provider=${provider}`);
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error ?? t.errors.generic);
      }
    } catch {
      setError(t.errors.generic);
    } finally {
      setSsoLoading(false);
    }
  }

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
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center px-6 py-12" lang={lang} style={styleForIndustry(industry)}>
      <MarketingBackground />
      <div className="relative z-10 w-full max-w-md">
        <Link href={p(lang, "")} className="flex justify-center mb-8" aria-label={isSubsumio ? "Subsumio home" : "Sigmabrain home"}>
          {isSubsumio
            ? <SubsumioLogo size={40} />
            : <SigmaLogo size={38} wordmarkClassName="text-xl font-bold text-[#e8e8f0] tracking-tight" />}
        </Link>

        <div className="glass rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h1 className="text-2xl font-black text-[#e8e8f0] mb-1">{m.title}</h1>
          <p className="text-sm text-[#8888aa] mb-7">{m.sub}</p>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === "signup" && (
              <label className="block">
                <span className="text-xs font-medium text-[#8888aa] mb-1.5 block">{t.name}</span>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7878a0]" aria-hidden />
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#7878a0] focus:outline-none focus:border-violet-500/60"
                  />
                </div>
              </label>
            )}
            <label className="block">
              <span className="text-xs font-medium text-[#8888aa] mb-1.5 block">{t.email}</span>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7878a0]" aria-hidden />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#7878a0] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#8888aa] mb-1.5 block">{t.password}</span>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7878a0]" aria-hidden />
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#7878a0] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
              {mode === "signup" && <span className="text-xs text-[#7878a0] mt-1 block">{t.passwordHint}</span>}
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
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8f0] focus:outline-none focus:border-[var(--brand-primary)]"
                >
                  <option value="">{t.industryPlaceholder}</option>
                  {Object.values(INDUSTRY_PROFILES).map((profile) => (
                    <option key={profile.key} value={profile.key}>{profile.label[lang]}</option>
                  ))}
                  <option value="other">{t.otherIndustry}</option>
                </select>
                <span className="text-xs text-[#7878a0] mt-1 block">{t.industryHint}</span>
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

          {ssoConfigured && (
            <div className="mt-5">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1e1e3a]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#0a0a18] px-2 text-[#7878a0]">
                    {lang === "de" ? "oder" : "or"}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startSso("MicrosoftOAuth")}
                  disabled={ssoLoading}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#1e1e3a] bg-[#0a0a18] text-sm text-[#e8e8f0] hover:border-[#2e2e4a] hover:bg-[#12122a] transition-all disabled:opacity-50"
                >
                  <Building2 size={16} className="text-blue-400" />
                  Microsoft
                </button>
                <button
                  type="button"
                  onClick={() => startSso("GoogleOAuth")}
                  disabled={ssoLoading}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#1e1e3a] bg-[#0a0a18] text-sm text-[#e8e8f0] hover:border-[#2e2e4a] hover:bg-[#12122a] transition-all disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.05-3.71 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
              </div>
              {ssoLoading && (
                <p className="text-xs text-[#7878a0] text-center mt-2">
                  {lang === "de" ? "Weiterleitung zum Anbieter..." : "Redirecting to provider..."}
                </p>
              )}
            </div>
          )}

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
