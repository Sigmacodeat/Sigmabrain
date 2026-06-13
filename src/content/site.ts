// Sigmabrain — central bilingual content system.
// EN is the default locale (global market), DE lives under /de.
// One source of truth: layouts render from these objects, never duplicate copy in JSX.

export type Lang = "en" | "de";

/** Build a locale-aware path. p("de", "/pricing") => "/de/pricing"; p("en", "") => "/" */
export function p(lang: Lang, path: string): string {
  if (lang === "de") return path === "" || path === "/" ? "/de" : `/de${path}`;
  return path === "" ? "/" : path;
}

/** The same page in the other language (for the language switcher). */
export function altPath(lang: Lang, pathname: string): string {
  if (lang === "en") return pathname === "/" ? "/de" : `/de${pathname}`;
  const stripped = pathname.replace(/^\/de/, "");
  return stripped === "" ? "/" : stripped;
}

// ---------------------------------------------------------------------------
// Navigation + Footer
// ---------------------------------------------------------------------------

export const NAV = {
  en: {
    features: "Features",
    solutions: "Solutions",
    pricing: "Pricing",
    compare: "Compare",
    partners: "Partners",
    docs: "Docs",
    signIn: "Sign in",
    cta: "Start free",
    solutionItems: [
      { label: "VC & Private Equity", href: "/solutions/vc", desc: "Deal memory, founder tracking, meeting prep" },
      { label: "Law Firms", href: "/solutions/legal", desc: "Case synthesis on your own infrastructure" },
      { label: "Tax & Accounting Firms", href: "/solutions/tax", desc: "The practice memory next to your practice software" },
      { label: "Consulting & Agencies", href: "/solutions/consulting", desc: "Institutional memory for project teams" },
      { label: "Executive Search & Recruiting", href: "/solutions/recruiting", desc: "Your proprietary talent graph" },
    ],
  },
  de: {
    features: "Features",
    solutions: "Lösungen",
    pricing: "Preise",
    compare: "Vergleich",
    partners: "Partner",
    docs: "Docs",
    signIn: "Anmelden",
    cta: "Kostenlos starten",
    solutionItems: [
      { label: "VC & Private Equity", href: "/solutions/vc", desc: "Deal-Gedächtnis, Founder-Tracking, Meeting-Prep" },
      { label: "Kanzleien", href: "/solutions/legal", desc: "Akten-Synthese auf eigener Infrastruktur" },
      { label: "Steuerberater & WP", href: "/solutions/tax", desc: "Das Kanzleigedächtnis neben DATEV" },
      { label: "Beratung & Agenturen", href: "/solutions/consulting", desc: "Institutional Memory für Projektteams" },
      { label: "Executive Search & Recruiting", href: "/solutions/recruiting", desc: "Euer proprietärer Talent-Graph" },
    ],
  },
} as const;

export const FOOTER = {
  en: {
    tagline: "The brain your firm never had.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "/features" },
          { label: "Pricing", href: "/pricing" },
          { label: "Compare us honestly", href: "/compare" },
          { label: "Dashboard", href: "/dashboard", external: false },
          { label: "Download the app", href: "/download" },
          { label: "Open Source Engine", href: "https://github.com/garrytan/gbrain", external: true },
        ],
      },
      {
        title: "Solutions",
        links: [
          { label: "VC & Private Equity", href: "/solutions/vc" },
          { label: "Law Firms", href: "/solutions/legal" },
          { label: "Subsumio · the law firm's brain", href: "/subsumio" },
          { label: "Tax & Accounting Firms", href: "/solutions/tax" },
          { label: "Taxumio · the tax firm's memory", href: "/taxumio" },
          { label: "Consulting & Agencies", href: "/solutions/consulting" },
          { label: "Executive Search & Recruiting", href: "/solutions/recruiting" },
        ],
      },
      {
        title: "Grow with us",
        links: [
          { label: "Partner program", href: "/partners" },
          { label: "Refer a customer — earn 30%", href: "/partners#affiliate" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Security & data protection", href: "/security" },
          { label: "Terms of service", href: "/terms" },
          { label: "Privacy", href: "/privacy" },
          { label: "Imprint", href: "/imprint" },
        ],
      },
    ],
    note: "Built on the open-source Sigmabrain engine (MIT). Your data, your keys, your hardware — or our EU cloud.",
  },
  de: {
    tagline: "Das Gedächtnis deiner Firma.",
    columns: [
      {
        title: "Produkt",
        links: [
          { label: "Features", href: "/features" },
          { label: "Preise", href: "/pricing" },
          { label: "Ehrlicher Vergleich", href: "/compare" },
          { label: "Dashboard", href: "/dashboard", external: false },
          { label: "App herunterladen", href: "/download" },
          { label: "Open-Source-Engine", href: "https://github.com/garrytan/gbrain", external: true },
        ],
      },
      {
        title: "Lösungen",
        links: [
          { label: "VC & Private Equity", href: "/solutions/vc" },
          { label: "Kanzleien", href: "/solutions/legal" },
          { label: "Subsumio · das Kanzlei-Gehirn", href: "/subsumio" },
          { label: "Steuerberater & WP", href: "/solutions/tax" },
          { label: "Taxumio · das Kanzleigedächtnis", href: "/taxumio" },
          { label: "Beratung & Agenturen", href: "/solutions/consulting" },
          { label: "Executive Search & Recruiting", href: "/solutions/recruiting" },
        ],
      },
      {
        title: "Wachse mit uns",
        links: [
          { label: "Partnerprogramm", href: "/partners" },
          { label: "Kunden empfehlen — 30 % verdienen", href: "/partners#affiliate" },
        ],
      },
      {
        title: "Rechtliches",
        links: [
          { label: "Sicherheit & Datenschutz", href: "/security" },
          { label: "AGB", href: "/terms" },
          { label: "Datenschutz-Erklärung", href: "/privacy" },
          { label: "Impressum", href: "/imprint" },
        ],
      },
    ],
    note: "Basiert auf der Open-Source-Engine von Sigmabrain (MIT). Deine Daten, deine Keys, deine Hardware — oder unsere EU-Cloud.",
  },
} as const;

// ---------------------------------------------------------------------------
// Pricing (single source of truth — used by landing teaser + /pricing page)
// ---------------------------------------------------------------------------

export interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}

export const PRICING: Record<Lang, { title: string; sub: string; tiers: PricingTier[]; footnote: string }> = {
  en: {
    title: "Start free. Scale when it pays for itself.",
    sub: "No credit card to start. No vendor lock-in — the engine is open source.",
    tiers: [
      {
        id: "oss", name: "Open Source", price: "$0", period: "forever",
        blurb: "Self-hosted. Full engine, your keys, your hardware.",
        features: ["Complete engine (MIT)", "Hybrid search + knowledge graph", "AI synthesis with citations", "Unlimited pages — it's your machine", "Community support"],
        cta: "Deploy yourself", href: "https://github.com/garrytan/gbrain",
      },
      {
        id: "pro", name: "Pro", price: "€79", period: "/month",
        blurb: "Hosted. For one professional who lives on their knowledge.",
        features: ["Fully managed — no API keys needed", "25,000 pages", "Fair-use queries with live usage meter", "24/7 Dream Cycle (dedupe, citations, contradictions)", "Email & document import", "Priority email support"],
        cta: "Start Pro", href: "/signup", highlight: true,
      },
      {
        id: "team", name: "Team", price: "€290", period: "/month",
        blurb: "5 seats included, +€49 per extra seat. One shared brain, scoped access.",
        features: ["Everything in Pro", "Shared institutional memory", "Per-user scoped access — fuzz-tested, zero leaks", "Admin & usage analytics", "Onboarding session included"],
        cta: "Start Team", href: "/signup",
      },
      {
        id: "ent", name: "Enterprise", price: "Custom", period: "from €12k/yr",
        blurb: "Compliance-grade. 25+ seats, your infrastructure or EU cloud.",
        features: ["EU or on-prem hosting", "DPA, SLA, SSO", "Maximum-recall search mode", "Dedicated support & integration help"],
        cta: "Talk to us", href: "mailto:hello@sigmabrain.com",
      },
    ],
    footnote: "Annual billing −20%. Fair use means generous limits shown transparently in your dashboard — no surprise bills, no silent throttling.",
  },
  de: {
    title: "Starte kostenlos. Skaliere, wenn es sich rechnet.",
    sub: "Keine Kreditkarte zum Start. Kein Vendor Lock-in — die Engine ist Open Source.",
    tiers: [
      {
        id: "oss", name: "Open Source", price: "0 €", period: "für immer",
        blurb: "Self-hosted. Volle Engine, deine Keys, deine Hardware.",
        features: ["Komplette Engine (MIT)", "Hybrid-Suche + Wissensgraph", "KI-Synthese mit Zitaten", "Unbegrenzte Seiten — es ist dein Rechner", "Community-Support"],
        cta: "Selbst deployen", href: "https://github.com/garrytan/gbrain",
      },
      {
        id: "pro", name: "Pro", price: "79 €", period: "/Monat",
        blurb: "Gehostet. Für Professionals, die von ihrem Wissen leben.",
        features: ["Voll verwaltet — keine API-Keys nötig", "25.000 Seiten", "Fair-Use-Queries mit Live-Verbrauchsanzeige", "24/7 Dream Cycle (Dedupe, Zitate, Widersprüche)", "E-Mail- & Dokumenten-Import", "Priorisierter E-Mail-Support"],
        cta: "Pro starten", href: "/signup", highlight: true,
      },
      {
        id: "team", name: "Team", price: "290 €", period: "/Monat",
        blurb: "5 Seats inklusive, +49 € je weiterer Seat. Ein gemeinsames Brain, sauber getrennte Zugriffe.",
        features: ["Alles aus Pro", "Geteiltes Firmen-Gedächtnis", "Zugriff pro Nutzer gescoped — fuzz-getestet, null Leaks", "Admin & Nutzungs-Analytics", "Onboarding-Session inklusive"],
        cta: "Team starten", href: "/signup",
      },
      {
        id: "ent", name: "Enterprise", price: "Individuell", period: "ab 12.000 €/Jahr",
        blurb: "Compliance-tauglich. 25+ Seats, eure Infrastruktur oder EU-Cloud.",
        features: ["EU- oder On-Prem-Hosting", "AVV, SLA, SSO", "Maximum-Recall-Suchmodus", "Dedizierter Support & Integrationshilfe"],
        cta: "Sprich mit uns", href: "mailto:hello@sigmabrain.com",
      },
    ],
    footnote: "Jahreszahlung −20 %. Fair Use heißt: großzügige Limits, transparent im Dashboard — keine Überraschungsrechnung, kein stilles Drosseln.",
  },
};

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

export const LANDING = {
  en: {
    badge: "Open-source engine · Self-hosted or EU cloud",
    h1a: "Your firm forgets.",
    h1b: "Sigmabrain doesn't.",
    sub: "Every meeting, deal, email and document — turned into one answer instead of ten search results. With citations, and an honest note on what it doesn't know yet.",
    ctaPrimary: "Start free",
    ctaSecondary: "See it answer",
    demo: {
      windowTitle: "sigmabrain — ask",
      you: "You",
      q: "What do I need to know before my meeting with Alice tomorrow?",
      a: `Alice runs engineering at Acme (Series-B fintech). You last spoke April 22.

**3 things still open:**
1. Security review overdue (deadline May 1, no update)
2. 500-seat pricing sent April 25 — no reply yet
3. You promised a CISO intro — not done

⚠️ Gap: nothing new on Alice in 6 weeks. She may have replied on channels the brain doesn't see — ask.`,
      sourcesLabel: "Sources:",
      sources: ["people/alice", "meetings/alice-q1", "customers/acme"],
    },
    stats: [
      { value: "97.9%", label: "Recall@5 on BrainBench" },
      { value: "+31.4", label: "P@5 points vs. vector-only RAG" },
      { value: "146k", label: "pages in the largest production brain" },
      { value: "0", label: "leaks in multi-tenant fuzz testing" },
    ],
    statsNote: "Engine benchmarks from the open-source core that powers Sigmabrain.",
    featuresTitle: "Not another RAG tool.",
    featuresSub: "The only stack that ships synthesis, graph traversal and gap analysis in one box.",
    features: [
      { icon: "Brain", color: "violet", title: "Answers, not chunks", desc: "Synthesized, cited prose across people, companies, deals and ideas — plus what the brain doesn't know yet." },
      { icon: "Network", color: "blue", title: "Self-wiring knowledge graph", desc: "Typed edges (invested_in, works_at, advises) extracted on every write. No extra LLM calls." },
      { icon: "Search", color: "emerald", title: "Hybrid retrieval", desc: "Vector + BM25 + graph traversal, fused. Finds what either method alone misses." },
      { icon: "Zap", color: "amber", title: "Dream Cycle", desc: "A 24/7 background agent dedupes, fixes citations, surfaces contradictions and preps your morning." },
      { icon: "Shield", color: "rose", title: "Your data stays yours", desc: "Self-host on your hardware, or pick our EU cloud. Open-source core — auditable, no lock-in." },
      { icon: "Layers", color: "purple", title: "Team-safe by design", desc: "Per-user scoped access across every read path. Fuzz-tested for zero cross-user leaks." },
    ],
    howTitle: "Signal → Brain → Answer",
    how: [
      { step: "01", icon: "Database", title: "Feed it", desc: "Meetings, emails, PDFs, notes. Sigmabrain chunks, embeds and indexes automatically." },
      { step: "02", icon: "GitBranch", title: "It wires itself", desc: "People, companies and relationships become a graph — while you sleep, the Dream Cycle keeps it clean." },
      { step: "03", icon: "Brain", title: "Ask, don't search", desc: "Plain-language questions. Synthesized answers with sources and explicit gaps." },
    ],
    verticalsTitle: "Built for teams that run on knowledge",
    verticalsSub: "One brain, tuned for your industry.",
    verticalCards: [
      { href: "/solutions/vc", title: "VC & Private Equity", desc: "Who invested in what? What's open with this founder? Walk into every meeting prepared.", cta: "For investors" },
      { href: "/solutions/legal", title: "Law Firms", desc: "Synthesize case files on infrastructure you control. The privacy-first alternative.", cta: "For law firms" },
      { href: "/solutions/tax", title: "Tax & Accounting Firms", desc: "Your practice software knows the numbers. The brain knows the why — advisory history, client context, open items.", cta: "For tax & accounting" },
      { href: "/solutions/consulting", title: "Consulting & Agencies", desc: "Pitch history, project learnings, client context — new hires productive in days.", cta: "For consultancies" },
      { href: "/solutions/recruiting", title: "Executive Search & Recruiting", desc: "Who fits the brief, who can intro you — a proprietary talent graph that compounds.", cta: "For search firms" },
    ],
    scenariosTitle: "What a workday with Sigmabrain looks like",
    scenariosSub: "Illustrative scenarios based on what the engine does in production.",
    scenarios: [
      { role: "An investor", text: "Uploads deal memos and meeting notes, then asks: “What's still open with the founders I met this week?” — one answer, every commitment listed, sources linked." },
      { role: "A lawyer", text: "Drops 500 pages of case files into a self-hosted brain and asks: “Where do the opposing party's statements contradict each other?” — contradictions surfaced with page citations." },
      { role: "A consulting team", text: "Indexes five years of decks and project docs. A new hire asks: “Have we solved something like this before?” — and finds the 2023 playbook in seconds." },
    ],
    faqTitle: "Questions, answered",
    faq: [
      { q: "How is this different from Notion AI, Glean or a vector database?", a: "Those return documents or chunks. Sigmabrain returns a synthesized answer with citations, walks a typed knowledge graph for relationship questions (“who invested in X?”), and tells you what it doesn't know — the gap analysis is the part that changes how you work." },
      { q: "Where does my data live?", a: "Your choice. Self-host the open-source engine on your own hardware, or use our managed EU cloud. Enterprise plans support on-prem and a signed DPA." },
      { q: "Do I need API keys or a server?", a: "Not on hosted plans — sign up and your brain runs. Self-hosters bring their own keys and get the full engine for free." },
      { q: "What happens when I hit my plan limits?", a: "You see usage live in the dashboard and we ask before anything changes. No surprise bills, no silent throttling." },
      { q: "Is the open-source version crippled?", a: "No. The engine is MIT-licensed and complete. Paid plans add managed hosting, team access control, support and compliance — not core features." },
    ],
    ctaTitle: "Your brain is waiting.",
    ctaSub: "Three minutes to first answer on hosted plans. No credit card.",
    ctaButton: "Start Sigmabrain free",
  },
  de: {
    badge: "Open-Source-Engine · Self-hosted oder EU-Cloud",
    h1a: "Deine Firma vergisst.",
    h1b: "Sigmabrain nicht.",
    sub: "Jedes Meeting, jeder Deal, jede Mail, jedes Dokument — als eine Antwort statt zehn Suchtreffern. Mit Quellen und einem ehrlichen Hinweis, was noch fehlt.",
    ctaPrimary: "Kostenlos starten",
    ctaSecondary: "Antwort ansehen",
    demo: {
      windowTitle: "sigmabrain — fragen",
      you: "Du",
      q: "Was muss ich vor dem Meeting mit Alice morgen wissen?",
      a: `Alice leitet Engineering bei Acme (Series-B Fintech). Letztes Gespräch: 22. April.

**3 offene Punkte:**
1. Security Review überfällig (Deadline 1. Mai, kein Update)
2. 500-Seat-Pricing am 25. April gesendet — keine Antwort
3. CISO-Intro zugesagt — noch offen

⚠️ Lücke: Seit 6 Wochen nichts Neues zu Alice. Antwort kam evtl. über Kanäle, die das Brain nicht sieht — nachfragen.`,
      sourcesLabel: "Quellen:",
      sources: ["people/alice", "meetings/alice-q1", "customers/acme"],
    },
    stats: [
      { value: "97,9 %", label: "Recall@5 im BrainBench" },
      { value: "+31,4", label: "P@5-Punkte vs. reines Vector-RAG" },
      { value: "146k", label: "Seiten im größten Produktions-Brain" },
      { value: "0", label: "Leaks im Multi-Tenant-Fuzz-Test" },
    ],
    statsNote: "Engine-Benchmarks des Open-Source-Kerns, der Sigmabrain antreibt.",
    featuresTitle: "Kein weiteres RAG-Tool.",
    featuresSub: "Der einzige Stack mit Synthese, Graph-Traversal und Gap-Analyse in einer Box.",
    features: [
      { icon: "Brain", color: "violet", title: "Antworten statt Chunks", desc: "Synthetisierte, zitierte Prosa über Personen, Firmen, Deals und Ideen — plus das, was dem Brain noch fehlt." },
      { icon: "Network", color: "blue", title: "Selbstverdrahtender Wissensgraph", desc: "Typisierte Kanten (invested_in, works_at, advises) bei jedem Schreibvorgang. Ohne zusätzliche LLM-Calls." },
      { icon: "Search", color: "emerald", title: "Hybrid-Retrieval", desc: "Vector + BM25 + Graph-Traversal, fusioniert. Findet, was jede Methode allein übersieht." },
      { icon: "Zap", color: "amber", title: "Dream Cycle", desc: "Ein 24/7-Hintergrund-Agent dedupliziert, fixiert Zitate, findet Widersprüche und bereitet deinen Morgen vor." },
      { icon: "Shield", color: "rose", title: "Deine Daten bleiben deine", desc: "Self-hosted auf deiner Hardware oder in unserer EU-Cloud. Open-Source-Kern — auditierbar, kein Lock-in." },
      { icon: "Layers", color: "purple", title: "Team-sicher gebaut", desc: "Zugriff pro Nutzer gescoped, über jeden Lesepfad. Fuzz-getestet auf null Leaks." },
    ],
    howTitle: "Signal → Brain → Antwort",
    how: [
      { step: "01", icon: "Database", title: "Füttern", desc: "Meetings, E-Mails, PDFs, Notizen. Sigmabrain chunked, embedded und indiziert automatisch." },
      { step: "02", icon: "GitBranch", title: "Es verdrahtet sich selbst", desc: "Personen, Firmen und Beziehungen werden zum Graphen — nachts hält der Dream Cycle alles sauber." },
      { step: "03", icon: "Brain", title: "Fragen statt suchen", desc: "Fragen in normaler Sprache. Synthetisierte Antworten mit Quellen und expliziten Lücken." },
    ],
    verticalsTitle: "Gebaut für Teams, die von Wissen leben",
    verticalsSub: "Ein Brain, abgestimmt auf deine Branche.",
    verticalCards: [
      { href: "/solutions/vc", title: "VC & Private Equity", desc: "Wer hat in was investiert? Was ist mit diesem Founder offen? In jedes Meeting vorbereitet gehen.", cta: "Für Investoren" },
      { href: "/solutions/legal", title: "Kanzleien", desc: "Akten synthetisieren auf Infrastruktur, die ihr kontrolliert. Die Privacy-First-Alternative.", cta: "Für Kanzleien" },
      { href: "/solutions/tax", title: "Steuerberater & WP", desc: "DATEV kennt die Zahlen. Das Brain kennt das Warum — Gestaltungs-Historie, Mandantenkontext, offene Punkte.", cta: "Für Steuerkanzleien" },
      { href: "/solutions/consulting", title: "Beratung & Agenturen", desc: "Pitch-Historie, Projekt-Learnings, Kundenkontext — neue Kollegen in Tagen produktiv.", cta: "Für Beratungen" },
      { href: "/solutions/recruiting", title: "Executive Search & Recruiting", desc: "Wer passt aufs Mandat, wer kann euch vorstellen — ein proprietärer Talent-Graph, der sich verzinst.", cta: "Für Personalberater" },
    ],
    scenariosTitle: "So sieht ein Arbeitstag mit Sigmabrain aus",
    scenariosSub: "Illustrative Szenarien — basierend auf dem, was die Engine produktiv leistet.",
    scenarios: [
      { role: "Eine Investorin", text: "Lädt Deal-Memos und Meeting-Notizen hoch und fragt: „Was ist mit den Foundern dieser Woche noch offen?“ — eine Antwort, jede Zusage gelistet, Quellen verlinkt." },
      { role: "Ein Anwalt", text: "Legt 500 Seiten Akten in ein self-hosted Brain und fragt: „Wo widersprechen sich die Aussagen der Gegenseite?“ — Widersprüche mit Seiten-Zitaten." },
      { role: "Ein Beratungsteam", text: "Indiziert fünf Jahre Decks und Projektdokumente. Ein neuer Kollege fragt: „Haben wir so etwas schon mal gelöst?“ — und findet das Playbook von 2023 in Sekunden." },
    ],
    faqTitle: "Fragen, beantwortet",
    faq: [
      { q: "Was unterscheidet das von Notion AI, Glean oder einer Vektor-Datenbank?", a: "Die liefern Dokumente oder Chunks. Sigmabrain liefert eine synthetisierte Antwort mit Zitaten, läuft für Beziehungsfragen („wer hat in X investiert?“) über einen typisierten Wissensgraphen und sagt dir, was es nicht weiß — die Gap-Analyse verändert, wie du arbeitest." },
      { q: "Wo liegen meine Daten?", a: "Deine Wahl. Self-hoste die Open-Source-Engine auf eigener Hardware oder nutze unsere verwaltete EU-Cloud. Enterprise-Pläne unterstützen On-Prem und einen AVV." },
      { q: "Brauche ich API-Keys oder einen Server?", a: "Auf gehosteten Plänen nicht — anmelden, Brain läuft. Self-Hoster bringen eigene Keys mit und bekommen die volle Engine kostenlos." },
      { q: "Was passiert, wenn ich an Plan-Limits stoße?", a: "Du siehst den Verbrauch live im Dashboard, und wir fragen, bevor sich etwas ändert. Keine Überraschungsrechnung, kein stilles Drosseln." },
      { q: "Ist die Open-Source-Version beschnitten?", a: "Nein. Die Engine ist MIT-lizenziert und vollständig. Bezahlte Pläne ergänzen Hosting, Team-Zugriffe, Support und Compliance — keine Kern-Features." },
    ],
    ctaTitle: "Dein Brain wartet.",
    ctaSub: "Drei Minuten bis zur ersten Antwort auf gehosteten Plänen. Keine Kreditkarte.",
    ctaButton: "Sigmabrain kostenlos starten",
  },
} as const;
