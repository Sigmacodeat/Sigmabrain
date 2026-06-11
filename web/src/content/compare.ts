// /compare — honest competitive comparison. EN + DE.
//
// RULES FOR THIS FILE (UWG-safe comparative content):
// - Every third-party claim comes from a public, linked source (see sources[]).
// - Unknowns are marked "n/a" / "k. A." — never guessed as ✗ or ✓.
// - Rows where competitors beat us say so plainly. The page loses several
//   rows on purpose; that's what makes the rows we win credible.
// - Prices that aren't public are "individual"; reported estimates are
//   labeled as reports, not facts. Snapshot date is shown on the page.

import type { Lang } from "./site";

/** Cell prefix conventions the renderer colorizes:
 *  "✓" green · "✗" rose · "~" amber (partial) · "k. A." / "n/a" gray. */
export interface CompareTable {
  title: string;
  sub: string;
  cols: string[]; // first column is Sigmabrain
  rows: { label: string; cells: string[] }[];
  footnotes: string[];
}

export interface CompareContent {
  metaTitle: string;
  metaDesc: string;
  badge: string;
  h1a: string;
  h1b: string;
  sub: string;
  snapshot: string;
  honestyTitle: string;
  honestyText: string;
  legal: CompareTable;
  km: CompareTable;
  whenThem: { title: string; items: string[] };
  whenUs: { title: string; items: string[] };
  disclaimer: string;
  sourcesTitle: string;
  sources: { label: string; href: string }[];
  faq: { q: string; a: string }[];
  faqTitle: string;
  ctaTitle: string;
  ctaSub: string;
  ctaButton: string;
}

export const COMPARE: Record<Lang, CompareContent> = {
  en: {
    metaTitle: "Sigmabrain vs. Harvey, Legora, CoCounsel, Glean — an honest comparison",
    metaDesc: "Where enterprise legal AI beats Sigmabrain (legal research, drafting), and where Sigmabrain wins (your own files, self-hosting, open source, price). No sugarcoating — every claim sourced.",
    badge: "Honest comparison · June 2026",
    h1a: "We lose several rows of this table.",
    h1b: "That's why you can trust the rest.",
    sub: "Sigmabrain is not a legal research tool and not a contract drafter. It's the knowledge layer over your firm's OWN files. Here is exactly where the market leaders are better — and where we are.",
    snapshot: "Snapshot: June 2026. Third-party data from public sources (linked below). Prices marked “individual” are not published by the vendor.",
    honestyTitle: "What Sigmabrain is NOT built for",
    honestyText: "If you need any of the following as your primary tool, buy it from the companies below — they are genuinely good at it: legal research against case-law databases (CoCounsel/Westlaw, Lexis+ AI, vLex, Beck-Noxtua/beck-online), contract drafting and redlining (Harvey, Legora, Spellbook in Word), M&A due-diligence workflows (Luminance, Harvey). Sigmabrain answers a different question: what does YOUR firm already know — across matters, emails, memos and meetings — with citations and explicit gaps.",
    legal: {
      title: "Sigmabrain vs. enterprise legal AI",
      sub: "Harvey, Legora, CoCounsel (Thomson Reuters), Beck-Noxtua, Luminance — against the knowledge layer.",
      cols: ["Sigmabrain", "Harvey", "Legora", "CoCounsel", "Beck-Noxtua", "Luminance"],
      rows: [
        { label: "Legal research w/ case-law database", cells: ["✗ none — not our category", "✓ (LexisNexis partnership)", "✓", "✓ Westlaw — category leader", "✓ beck-online, German law", "✗ contract focus"] },
        { label: "Drafting / contract redlining", cells: ["✗", "✓", "✓", "✓", "✓", "✓ (contracts)"] },
        { label: "Legal-specific model / training", cells: ["✗ general LLMs via API", "✓", "✓", "✓", "✓ own German legal AI", "✓"] },
        { label: "Public legal benchmark (Vals VLAIR)", cells: ["✗ not tested — retrieval benchmarks only", "✓ top scores", "k. A.", "✓ top scores", "k. A.", "k. A."] },
        { label: "Q&A over your own documents, cited", cells: ["✓ page-level citations", "✓", "✓", "✓", "✓", "✓"] },
        { label: "Cross-matter contradiction surfacing", cells: ["✓ Dream Cycle, automatic", "k. A.", "k. A.", "k. A.", "k. A.", "~ in contract review"] },
        { label: "Typed knowledge graph over your data", cells: ["✓ extracted on every write", "k. A.", "k. A.", "✗", "k. A.", "✗"] },
        { label: "Gap analysis (“what's NOT in the file”)", cells: ["✓ in every answer", "k. A.", "k. A.", "k. A.", "k. A.", "k. A."] },
        { label: "Beyond legal (deals, clients, firm memory)", cells: ["✓ cross-domain by design", "✗ legal-focused", "✗", "✗", "✗", "✗"] },
        { label: "Self-hosting on your own hardware", cells: ["✓ full engine, free", "✗ cloud", "✗ cloud", "✗ cloud", "✗ sovereign EU cloud, no self-host", "✓ on-premise offered"] },
        { label: "Open-source, auditable code", cells: ["✓ MIT-licensed engine", "✗", "✗", "✗", "✗", "✗"] },
        { label: "Published entry price", cells: ["€79/user/mo · €0 self-hosted", "individual (reports: ~$1,200/seat/mo, 20+ seats)", "individual", "from ~$639/user/mo incl. Westlaw (public configurator)", "individual (min. 3 licenses)", "individual (reports: $50k+/yr small teams)"] },
        { label: "Seat minimum", cells: ["✓ none — 1 user works", "✗ 20–50 (reports)", "k. A.", "✓ solo plans exist", "✗ 3 licenses", "k. A."] },
      ],
      footnotes: [
        "“k. A.” = no public information found; we do not guess competitors' gaps.",
        "Harvey/CoCounsel benchmark standing: Vals Legal AI Report (VLAIR). Sigmabrain has not participated in any legal benchmark — our published numbers are retrieval benchmarks (Recall@5, P@5), a different discipline.",
        "Luminance offers on-premise deployment — self-hosting is NOT unique to Sigmabrain. The difference: our engine is open source (auditable) and free to self-host.",
      ],
    },
    km: {
      title: "Sigmabrain vs. enterprise knowledge tools",
      sub: "Glean and Notion AI organize company knowledge — the closest neighbors to what Sigmabrain actually does.",
      cols: ["Sigmabrain", "Glean", "Notion AI"],
      rows: [
        { label: "Q&A over company knowledge, cited", cells: ["✓ + explicit gap analysis", "✓", "~ within Notion content"] },
        { label: "Knowledge graph", cells: ["✓ typed edges (invested_in, works_at, …), queryable", "✓ enterprise graph (people, docs, activity)", "✗"] },
        { label: "SaaS connectors (Slack, Jira, Drive, …)", cells: ["~ folders, email, MCP, API — no 100+ connector catalog", "✓ 100+ connectors — category leader", "~ Notion ecosystem"] },
        { label: "Document ingestion (PDF, DOCX, EML, XLSX, audio)", cells: ["✓ native, incl. scanned-PDF OCR fallback", "✓ via connectors", "~ imports"] },
        { label: "Self-hosting", cells: ["✓ full engine, free", "✗ SaaS-only", "✗ SaaS-only"] },
        { label: "Open source", cells: ["✓ MIT", "✗", "✗"] },
        { label: "Entry price & minimum", cells: ["€79/user/mo, no minimum · €0 self-hosted", "~$50/user/mo, ~100-seat minimum (reports: ~$60k/yr entry)", "~$10/user/mo add-on"] },
      ],
      footnotes: [
        "Glean's connector catalog and enterprise rollout tooling are ahead of ours — for a 5,000-person company wiring 30 SaaS tools, Glean is the safer pick today.",
        "Notion AI assumes your knowledge lives in Notion. Sigmabrain assumes it lives in files, emails and notes — wherever they are.",
      ],
    },
    whenThem: {
      title: "Choose the others when…",
      items: [
        "You need legal research with citable case law → CoCounsel, Lexis+ AI, vLex; German law → Beck-Noxtua.",
        "You draft and redline contracts in Word all day → Spellbook; enterprise workflows → Harvey, Legora.",
        "You run M&A due diligence and want on-premise from an established vendor → also evaluate Luminance.",
        "You're 1,000+ employees and need 30 SaaS tools indexed → Glean.",
      ],
    },
    whenUs: {
      title: "Choose Sigmabrain when…",
      items: [
        "The knowledge that wins your cases sits in YOUR files, emails and notes — and nobody can query it.",
        "Confidentiality rules out third-party clouds: self-host the full engine, audit every line (MIT).",
        "You're below enterprise size: no seat minimum, €79/user, or €0 self-hosted.",
        "Your firm's memory spans more than law: clients, deals, relationships — one graph, one brain.",
      ],
    },
    disclaimer: "All third-party information from public sources as of June 2026, linked below; no guarantee of completeness. Vendors change pricing and features — corrections welcome at hello@sigmabrain.com and will be published.",
    sourcesTitle: "Sources",
    sources: [
      { label: "Vals Legal AI Report (benchmark)", href: "https://www.vals.ai/industry-reports/vlair-2-27-25" },
      { label: "Harvey pricing reports (Bind Legal)", href: "https://bindlegal.com/resources/comparisons/harvey-pricing-2026/" },
      { label: "Thomson Reuters CoCounsel public pricing", href: "https://sales.legalsolutions.thomsonreuters.com/en-us/products/cocounsel-legal/700/plans-pricing" },
      { label: "Legora ARR (Business Insider)", href: "https://www.businessinsider.com/legal-ai-startup-legora-hits-100-million-arr-2026-4" },
      { label: "Beck-Noxtua (official)", href: "https://www.beck-noxtua.de/" },
      { label: "Luminance on-premise & pricing reports", href: "https://bindlegal.com/resources/comparisons/luminance-pricing-2026/" },
      { label: "Spellbook pricing", href: "https://www.spellbook.legal/pricing" },
      { label: "Glean pricing reports (Vendr)", href: "https://www.vendr.com/marketplace/glean" },
      { label: "Legal AI Germany price comparison (Lulius)", href: "https://www.lulius.ai/blog/legal-ai-vergleich-deutschland" },
    ],
    faqTitle: "Fair questions",
    faq: [
      { q: "Why should I trust a comparison you wrote yourselves?", a: "Because we publish the rows we lose: no legal research, no drafting, no legal benchmark participation, fewer connectors than Glean. Every third-party claim links to a public source, unknowns are marked “k. A.” instead of guessed, and we publish corrections." },
      { q: "Is Sigmabrain a Harvey alternative?", a: "Only if what you actually need is the knowledge layer, not the legal workspace. Many firms will run both: Harvey/Noxtua for research and drafting, Sigmabrain as the queryable memory over their own matters. We replace neither Westlaw nor a lawyer." },
      { q: "Why are you so much cheaper — what's the catch?", a: "Different cost structure, not a trick: no legal content licenses (we index YOUR files, not case law), an open-source engine, and self-hosting where you bring your own hardware and API keys. The catch is real and stated above: we don't do legal research." },
      { q: "Self-hosting exists at Luminance too. What's different?", a: "Correct — and we say so in the table. The difference: our engine is MIT-licensed, so your IT can audit the code that touches client data, and self-hosting is free rather than an enterprise contract." },
    ],
    ctaTitle: "The fairest test: your own files.",
    ctaSub: "Import one closed matter and ask the first question. If it doesn't convince you, you've lost an afternoon — not a six-figure contract.",
    ctaButton: "Try Sigmabrain free",
  },
  de: {
    metaTitle: "Sigmabrain vs. Harvey, Legora, CoCounsel, Glean — der ehrliche Vergleich",
    metaDesc: "Wo Enterprise-Legal-AI Sigmabrain schlägt (Rechtsrecherche, Drafting) — und wo Sigmabrain gewinnt (eigene Akten, Self-Hosting, Open Source, Preis). Ohne Schönreden, jede Angabe mit Quelle.",
    badge: "Ehrlicher Vergleich · Juni 2026",
    h1a: "Wir verlieren mehrere Zeilen dieser Tabelle.",
    h1b: "Deshalb kannst du dem Rest vertrauen.",
    sub: "Sigmabrain ist kein Rechtsrecherche-Tool und kein Vertragsgenerator. Es ist die Wissensschicht über den EIGENEN Akten eurer Kanzlei. Hier steht exakt, wo die Marktführer besser sind — und wo wir.",
    snapshot: "Stand: Juni 2026. Drittanbieter-Daten aus öffentlichen Quellen (unten verlinkt). Mit „individuell“ markierte Preise veröffentlicht der Anbieter nicht.",
    honestyTitle: "Wofür Sigmabrain NICHT gebaut ist",
    honestyText: "Wer Folgendes als Hauptwerkzeug braucht, kauft es bei den Anbietern unten — die sind darin wirklich gut: Rechtsrecherche gegen Rechtsdatenbanken (CoCounsel/Westlaw, Lexis+ AI, vLex, Beck-Noxtua/beck-online), Schriftsatz- und Vertragsentwurf inkl. Redlining (Harvey, Legora, Spellbook in Word), M&A-Due-Diligence-Workflows (Luminance, Harvey). Sigmabrain beantwortet eine andere Frage: Was weiß EURE Kanzlei bereits — über Mandate, Mails, Memos und Besprechungen hinweg — mit Zitaten und expliziten Lücken.",
    legal: {
      title: "Sigmabrain vs. Enterprise-Legal-AI",
      sub: "Harvey, Legora, CoCounsel (Thomson Reuters), Beck-Noxtua, Luminance — gegen die Wissensschicht.",
      cols: ["Sigmabrain", "Harvey", "Legora", "CoCounsel", "Beck-Noxtua", "Luminance"],
      rows: [
        { label: "Rechtsrecherche mit Rechtsdatenbank", cells: ["✗ keine — nicht unsere Kategorie", "✓ (LexisNexis-Partnerschaft)", "✓", "✓ Westlaw — Kategorie-Führer", "✓ beck-online, deutsches Recht", "✗ Vertragsfokus"] },
        { label: "Drafting / Vertrags-Redlining", cells: ["✗", "✓", "✓", "✓", "✓", "✓ (Verträge)"] },
        { label: "Legal-spezifisches Modell / Training", cells: ["✗ generelle LLMs via API", "✓", "✓", "✓", "✓ eigene deutsche Legal-KI", "✓"] },
        { label: "Öffentlicher Legal-Benchmark (Vals VLAIR)", cells: ["✗ nicht getestet — nur Retrieval-Benchmarks", "✓ Top-Werte", "k. A.", "✓ Top-Werte", "k. A.", "k. A."] },
        { label: "Q&A über eigene Dokumente, mit Quellen", cells: ["✓ seitengenaue Zitate", "✓", "✓", "✓", "✓", "✓"] },
        { label: "Widerspruchs-Erkennung über die ganze Akte", cells: ["✓ Dream Cycle, automatisch", "k. A.", "k. A.", "k. A.", "k. A.", "~ in der Vertragsprüfung"] },
        { label: "Typisierter Wissensgraph über eure Daten", cells: ["✓ bei jedem Schreibvorgang extrahiert", "k. A.", "k. A.", "✗", "k. A.", "✗"] },
        { label: "Gap-Analyse („was FEHLT in der Akte“)", cells: ["✓ in jeder Antwort", "k. A.", "k. A.", "k. A.", "k. A.", "k. A."] },
        { label: "Über Legal hinaus (Deals, Mandanten, Firmenwissen)", cells: ["✓ cross-domain gebaut", "✗ legal-fokussiert", "✗", "✗", "✗", "✗"] },
        { label: "Self-Hosting auf eigener Hardware", cells: ["✓ volle Engine, kostenlos", "✗ Cloud", "✗ Cloud", "✗ Cloud", "✗ souveräne EU-Cloud, kein Self-Host", "✓ On-Premise verfügbar"] },
        { label: "Open Source / auditierbarer Code", cells: ["✓ MIT-lizenzierte Engine", "✗", "✗", "✗", "✗", "✗"] },
        { label: "Veröffentlichter Einstiegspreis", cells: ["79 €/User/Monat · 0 € self-hosted", "individuell (Berichte: ~1.200 $/Seat/Monat, 20+ Seats)", "individuell", "ab ~639 $/User/Monat inkl. Westlaw (öffentl. Konfigurator)", "individuell (min. 3 Lizenzen)", "individuell (Berichte: 50k $+/Jahr für kleine Teams)"] },
        { label: "Seat-Minimum", cells: ["✓ keins — 1 User reicht", "✗ 20–50 (Berichte)", "k. A.", "✓ Solo-Pläne existieren", "✗ 3 Lizenzen", "k. A."] },
      ],
      footnotes: [
        "„k. A.“ = keine öffentliche Angabe gefunden; wir raten Lücken der Konkurrenz nicht.",
        "Benchmark-Stand Harvey/CoCounsel: Vals Legal AI Report (VLAIR). Sigmabrain hat an keinem Legal-Benchmark teilgenommen — unsere veröffentlichten Zahlen sind Retrieval-Benchmarks (Recall@5, P@5), eine andere Disziplin.",
        "Luminance bietet On-Premise — Self-Hosting ist NICHT einzigartig bei Sigmabrain. Der Unterschied: unsere Engine ist Open Source (auditierbar) und kostenlos selbst zu hosten.",
      ],
    },
    km: {
      title: "Sigmabrain vs. Enterprise-Wissens-Tools",
      sub: "Glean und Notion AI organisieren Firmenwissen — die nächsten Nachbarn dessen, was Sigmabrain wirklich tut.",
      cols: ["Sigmabrain", "Glean", "Notion AI"],
      rows: [
        { label: "Q&A über Firmenwissen, mit Quellen", cells: ["✓ + explizite Gap-Analyse", "✓", "~ innerhalb von Notion-Inhalten"] },
        { label: "Wissensgraph", cells: ["✓ typisierte Kanten (invested_in, works_at, …), abfragbar", "✓ Enterprise-Graph (Personen, Docs, Aktivität)", "✗"] },
        { label: "SaaS-Konnektoren (Slack, Jira, Drive, …)", cells: ["~ Ordner, E-Mail, MCP, API — kein 100+-Konnektoren-Katalog", "✓ 100+ Konnektoren — Kategorie-Führer", "~ Notion-Ökosystem"] },
        { label: "Dokument-Ingestion (PDF, DOCX, EML, XLSX, Audio)", cells: ["✓ nativ, inkl. Scanned-PDF-OCR-Fallback", "✓ via Konnektoren", "~ Importe"] },
        { label: "Self-Hosting", cells: ["✓ volle Engine, kostenlos", "✗ nur SaaS", "✗ nur SaaS"] },
        { label: "Open Source", cells: ["✓ MIT", "✗", "✗"] },
        { label: "Einstiegspreis & Minimum", cells: ["79 €/User/Monat, kein Minimum · 0 € self-hosted", "~50 $/User/Monat, ~100-Seat-Minimum (Berichte: ~60k $/Jahr Einstieg)", "~10 $/User/Monat Add-on"] },
      ],
      footnotes: [
        "Gleans Konnektoren-Katalog und Enterprise-Rollout-Tooling sind unserem voraus — für 5.000 Mitarbeiter mit 30 SaaS-Tools ist Glean heute die sicherere Wahl.",
        "Notion AI setzt voraus, dass euer Wissen in Notion liegt. Sigmabrain setzt voraus, dass es in Dateien, Mails und Notizen liegt — wo auch immer.",
      ],
    },
    whenThem: {
      title: "Wählt die anderen, wenn…",
      items: [
        "ihr Rechtsrecherche mit zitierfähiger Rechtsprechung braucht → CoCounsel, Lexis+ AI, vLex; deutsches Recht → Beck-Noxtua.",
        "ihr den ganzen Tag Verträge in Word entwerft und redlined → Spellbook; Enterprise-Workflows → Harvey, Legora.",
        "ihr M&A-Due-Diligence fahrt und On-Premise vom etablierten Anbieter wollt → auch Luminance evaluieren.",
        "ihr 1.000+ Mitarbeiter habt und 30 SaaS-Tools indexieren müsst → Glean.",
      ],
    },
    whenUs: {
      title: "Wählt Sigmabrain, wenn…",
      items: [
        "das Wissen, das eure Fälle gewinnt, in EUREN Akten, Mails und Notizen liegt — und niemand es abfragen kann.",
        "Verschwiegenheit Dritt-Clouds ausschließt: volle Engine self-hosted, jede Zeile auditierbar (MIT).",
        "ihr unterhalb der Enterprise-Größe seid: kein Seat-Minimum, 79 €/User, oder 0 € self-hosted.",
        "das Gedächtnis eurer Firma mehr als Recht umfasst: Mandanten, Deals, Beziehungen — ein Graph, ein Brain.",
      ],
    },
    disclaimer: "Alle Drittanbieter-Angaben aus öffentlichen Quellen, Stand Juni 2026, unten verlinkt; keine Gewähr für Vollständigkeit. Anbieter ändern Preise und Funktionen — Korrekturen an hello@sigmabrain.com werden veröffentlicht.",
    sourcesTitle: "Quellen",
    sources: [
      { label: "Vals Legal AI Report (Benchmark)", href: "https://www.vals.ai/industry-reports/vlair-2-27-25" },
      { label: "Harvey-Preis-Berichte (Bind Legal)", href: "https://bindlegal.com/resources/comparisons/harvey-pricing-2026/" },
      { label: "Thomson Reuters CoCounsel öffentliche Preise", href: "https://sales.legalsolutions.thomsonreuters.com/en-us/products/cocounsel-legal/700/plans-pricing" },
      { label: "Legora ARR (Business Insider)", href: "https://www.businessinsider.com/legal-ai-startup-legora-hits-100-million-arr-2026-4" },
      { label: "Beck-Noxtua (offiziell)", href: "https://www.beck-noxtua.de/" },
      { label: "Luminance On-Premise & Preis-Berichte", href: "https://bindlegal.com/resources/comparisons/luminance-pricing-2026/" },
      { label: "Spellbook-Preise", href: "https://www.spellbook.legal/pricing" },
      { label: "Glean-Preis-Berichte (Vendr)", href: "https://www.vendr.com/marketplace/glean" },
      { label: "Legal-AI-Preisvergleich Deutschland (Lulius)", href: "https://www.lulius.ai/blog/legal-ai-vergleich-deutschland" },
    ],
    faqTitle: "Faire Fragen",
    faq: [
      { q: "Warum sollte ich einem Vergleich trauen, den ihr selbst geschrieben habt?", a: "Weil wir die Zeilen veröffentlichen, die wir verlieren: keine Rechtsrecherche, kein Drafting, keine Legal-Benchmark-Teilnahme, weniger Konnektoren als Glean. Jede Drittanbieter-Angabe verlinkt eine öffentliche Quelle, Unbekanntes steht als „k. A.“ statt geraten — und Korrekturen werden veröffentlicht." },
      { q: "Ist Sigmabrain eine Harvey-Alternative?", a: "Nur wenn ihr tatsächlich die Wissensschicht braucht, nicht den Legal-Workspace. Viele Kanzleien werden beides fahren: Harvey/Noxtua für Recherche und Drafting, Sigmabrain als abfragbares Gedächtnis über die eigenen Mandate. Wir ersetzen weder Westlaw noch einen Anwalt." },
      { q: "Warum seid ihr so viel günstiger — wo ist der Haken?", a: "Andere Kostenstruktur, kein Trick: keine Rechtsinhalts-Lizenzen (wir indexieren EURE Akten, nicht Rechtsprechung), eine Open-Source-Engine, und Self-Hosting, bei dem ihr Hardware und API-Keys selbst stellt. Der Haken ist real und steht oben: Wir machen keine Rechtsrecherche." },
      { q: "Self-Hosting gibt es bei Luminance auch. Was ist anders?", a: "Korrekt — und das steht in der Tabelle. Der Unterschied: unsere Engine ist MIT-lizenziert, eure IT kann den Code auditieren, der Mandantendaten berührt, und Self-Hosting ist kostenlos statt Enterprise-Vertrag." },
    ],
    ctaTitle: "Der fairste Test: eure eigenen Akten.",
    ctaSub: "Importiert ein abgeschlossenes Mandat und stellt die erste Frage. Überzeugt es nicht, habt ihr einen Nachmittag verloren — keinen sechsstelligen Vertrag.",
    ctaButton: "Sigmabrain kostenlos testen",
  },
};
