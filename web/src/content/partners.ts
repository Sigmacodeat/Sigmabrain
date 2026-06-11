// Partner program page — affiliate, in-product referral, vertical partners. EN + DE.

import type { Lang } from "./site";

export interface PartnersContent {
  metaTitle: string;
  metaDesc: string;
  badge: string;
  h1a: string;
  h1b: string;
  sub: string;
  tiers: {
    id: string;
    icon: string;
    name: string;
    headline: string;
    desc: string;
    points: string[];
    cta: string;
    href: string;
    highlight?: boolean;
  }[];
  structureTitle: string;
  structureSub: string;
  structureLevels: { level: string; rate: string; desc: string }[];
  structureNote: string;
  territoryTitle: string;
  territoryText: string;
  calcTitle: string;
  calcSub: string;
  calcNote: string;
  howTitle: string;
  how: { step: string; title: string; desc: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  ctaTitle: string;
  ctaSub: string;
  ctaButton: string;
}

export const PARTNERS: Record<Lang, PartnersContent> = {
  en: {
    metaTitle: "Sigmabrain Partner Program — earn 30% recurring",
    metaDesc: "Recommend Sigmabrain, earn 30% recurring commission for 12 months. Affiliate, referral and certified implementation partner tracks.",
    badge: "Partner program",
    h1a: "Recommend the brain.",
    h1b: "Keep the commission.",
    sub: "Three ways to earn with Sigmabrain — from a single shared link to a certified implementation practice. All built on one principle: recurring commission on recurring revenue.",
    tiers: [
      {
        id: "affiliate",
        icon: "Megaphone",
        name: "Affiliates",
        headline: "30% recurring · 12 months",
        desc: "For creators, newsletters, course authors and communities whose audience runs on knowledge.",
        points: [
          "25% of every payment for 12 months per customer you refer directly",
          "+5% override on customers referred by affiliates you recruited — two levels, never more",
          "90-day cookie window",
          "Monthly payouts from €50, real-time dashboard",
          "Ready-made assets: demos, screenshots, comparison pages",
        ],
        cta: "Apply as affiliate",
        href: "mailto:partners@sigmabrain.com?subject=Affiliate%20application",
        highlight: true,
      },
      {
        id: "referral",
        icon: "Gift",
        name: "Customer referrals",
        headline: "Give a month, get a month",
        desc: "Already a customer? Your referral link lives in your dashboard.",
        points: [
          "You get 1 month free for every referral who becomes a paying customer",
          "They get their first month free too — your link is worth taking",
          "No caps: 12 referrals = a free year",
          "Counts on Pro and Team plans",
        ],
        cta: "Find your link in Settings",
        href: "/dashboard/settings",
      },
      {
        id: "vertical",
        icon: "Handshake",
        name: "Certified partners",
        headline: "20% lifetime + your services revenue",
        desc: "For consultants, fund-ops advisors, legal-tech integrators and IT firms who implement Sigmabrain for clients.",
        points: [
          "20% revenue share for the lifetime of every client you bring",
          "You keep 100% of your implementation and consulting fees",
          "“Sigmabrain Certified Partner” status after 3 live clients",
          "Direct line to our engineering for integrations",
        ],
        cta: "Apply as partner",
        href: "mailto:partners@sigmabrain.com?subject=Certified%20partner%20application",
      },
    ],
    structureTitle: "Two levels. Never more.",
    structureSub: "A state-of-the-art two-tier structure — every cent of commission follows real subscription revenue, nothing else.",
    structureLevels: [
      { level: "Level 1 — you refer a customer", rate: "25% recurring · 12 months", desc: "A customer signs up through your link and pays. You earn 25% of every payment for 12 months — upgrades included." },
      { level: "Level 2 — your recruited affiliate refers a customer", rate: "5% override · 12 months", desc: "You brought another affiliate into the program, and they bring a paying customer. You earn a 5% override on that customer's payments — passive income on distribution you built." },
    ],
    structureNote: "Why we hard-cap at two levels: commissions are paid exclusively on actual subscription revenue — never for recruiting partners, never on entry fees (there are none), never on level three. That keeps the program clearly on the right side of German and Austrian law on progressive customer acquisition (§ 16 (2) UWG / § 27 öUWG) — and on the right side of the trust that confidentiality-first customers buy us for.",
    territoryTitle: "Territory exclusivity?",
    territoryText: "Honest answer: not yet. Exclusive territories sold before product-market fit are promises, not territories — and EU competition law makes exclusivity contracts a matter for lawyers, not landing pages. What we offer instead, today: become a Regional Launch Partner — performance-gated priority in your region, right of first refusal if we ever introduce exclusivity there, and the full 5% override on every affiliate you recruit locally. Passive income from revenue you helped create, not from a map.",
    calcTitle: "What 30% recurring actually means",
    calcSub: "Refer 10 Team customers (€290/month). That's €870 every month — €10,440 over the 12-month commission window. From ten recommendations.",
    calcNote: "Commission rates at or above 30% are sustainable only for high-margin products — ours is one. Industry standard is 20–30%; we start at the top of the range because early partners matter most.",
    howTitle: "How it works",
    how: [
      { step: "01", title: "Apply & get your link", desc: "We review applications within 48 hours. You get a tracked link and a partner dashboard." },
      { step: "02", title: "Recommend honestly", desc: "Share with audiences who actually need a company brain. We'd rather have 10 real fits than 1,000 clicks." },
      { step: "03", title: "Get paid monthly", desc: "Stripe-powered payouts every month, from €50. You see every referral and its status in real time." },
    ],
    faqTitle: "Partner FAQ",
    faq: [
      { q: "When do commissions start and stop?", a: "Affiliate commissions run for 12 months per referred customer, starting with their first payment. Certified partners earn 20% for as long as the client stays." },
      { q: "What if a customer upgrades?", a: "Your commission follows their actual payments. Refer a Pro customer who upgrades to Team — your 30% applies to the Team price." },
      { q: "Can I be both an affiliate and a certified partner?", a: "Yes. Many partners start with the affiliate track and certify once they've implemented for a few clients." },
      { q: "Is there a self-referral or coupon abuse policy?", a: "Self-referrals don't pay out, and we monitor for abuse. Honest programs stay generous — that's the deal." },
      { q: "How exactly does the two-level structure work?", a: "You earn 25% on customers you refer directly. If you recruit another affiliate, you additionally earn a 5% override on the customers they refer — same 12-month window per customer. There is no level three, by design: commission follows product revenue, not recruitment chains." },
      { q: "Can I get territory exclusivity?", a: "Not today — see the honest answer above. Apply as a Regional Launch Partner instead: performance-gated regional priority, right of first refusal on any future exclusivity, and the 5% override on every affiliate you recruit in your region." },
    ],
    ctaTitle: "Your audience needs a brain. You need recurring revenue.",
    ctaSub: "Applications reviewed within 48 hours.",
    ctaButton: "Apply now",
  },
  de: {
    metaTitle: "Sigmabrain Partnerprogramm — 30 % wiederkehrend verdienen",
    metaDesc: "Sigmabrain empfehlen, 30 % wiederkehrende Provision für 12 Monate verdienen. Affiliate-, Referral- und zertifizierte Implementierungspartner-Tracks.",
    badge: "Partnerprogramm",
    h1a: "Empfiehl das Brain.",
    h1b: "Behalte die Provision.",
    sub: "Drei Wege, mit Sigmabrain zu verdienen — vom geteilten Link bis zur zertifizierten Implementierungs-Practice. Alle nach einem Prinzip: wiederkehrende Provision auf wiederkehrenden Umsatz.",
    tiers: [
      {
        id: "affiliate",
        icon: "Megaphone",
        name: "Affiliates",
        headline: "30 % wiederkehrend · 12 Monate",
        desc: "Für Creator, Newsletter, Kurs-Anbieter und Communities, deren Publikum von Wissen lebt.",
        points: [
          "25 % jeder Zahlung, 12 Monate lang, pro direkt geworbenem Kunden",
          "+5 % Override auf Kunden von Affiliates, die du rekrutiert hast — zwei Ebenen, nie mehr",
          "90 Tage Cookie-Fenster",
          "Monatliche Auszahlung ab 50 €, Echtzeit-Dashboard",
          "Fertige Assets: Demos, Screenshots, Vergleichsseiten",
        ],
        cta: "Als Affiliate bewerben",
        href: "mailto:partners@sigmabrain.com?subject=Affiliate-Bewerbung",
        highlight: true,
      },
      {
        id: "referral",
        icon: "Gift",
        name: "Kunden-Empfehlungen",
        headline: "Einen Monat schenken, einen bekommen",
        desc: "Schon Kunde? Dein Empfehlungslink wartet im Dashboard.",
        points: [
          "Du bekommst 1 Monat gratis für jede Empfehlung, die zahlender Kunde wird",
          "Der Geworbene bekommt seinen ersten Monat ebenfalls gratis — dein Link lohnt sich für beide",
          "Keine Obergrenze: 12 Empfehlungen = ein Gratisjahr",
          "Gilt für Pro- und Team-Pläne",
        ],
        cta: "Link in den Einstellungen",
        href: "/dashboard/settings",
      },
      {
        id: "vertical",
        icon: "Handshake",
        name: "Zertifizierte Partner",
        headline: "20 % lifetime + euer Dienstleistungsumsatz",
        desc: "Für Berater, Fund-Ops-Spezialisten, Legal-Tech-Integratoren und IT-Häuser, die Sigmabrain bei Kunden implementieren.",
        points: [
          "20 % Revenue-Share — lebenslang für jeden gebrachten Kunden",
          "100 % eurer Implementierungs- und Beratungshonorare bleiben bei euch",
          "Status „Sigmabrain Certified Partner“ ab 3 Live-Kunden",
          "Direkter Draht zu unserem Engineering für Integrationen",
        ],
        cta: "Als Partner bewerben",
        href: "mailto:partners@sigmabrain.com?subject=Partner-Bewerbung",
      },
    ],
    structureTitle: "Zwei Ebenen. Nie mehr.",
    structureSub: "Eine State-of-the-Art-Zweistufen-Struktur — jeder Cent Provision folgt echtem Abo-Umsatz, sonst nichts.",
    structureLevels: [
      { level: "Ebene 1 — du wirbst einen Kunden", rate: "25 % wiederkehrend · 12 Monate", desc: "Ein Kunde registriert sich über deinen Link und zahlt. Du verdienst 25 % jeder Zahlung, 12 Monate lang — Upgrades inklusive." },
      { level: "Ebene 2 — dein rekrutierter Affiliate wirbt einen Kunden", rate: "5 % Override · 12 Monate", desc: "Du hast einen weiteren Affiliate ins Programm gebracht, und der bringt einen zahlenden Kunden. Du verdienst 5 % Override auf dessen Zahlungen — passives Einkommen aus Vertrieb, den du aufgebaut hast." },
    ],
    structureNote: "Warum wir hart bei zwei Ebenen deckeln: Provisionen fließen ausschließlich auf echten Abo-Umsatz — nie fürs Anwerben von Partnern, nie auf Einstiegsgebühren (es gibt keine), nie auf Ebene drei. Das hält das Programm klar auf der richtigen Seite des Verbots progressiver Kundenwerbung (§ 16 Abs. 2 UWG / § 27 öUWG) — und auf der richtigen Seite des Vertrauens, für das uns verschwiegenheitspflichtige Kunden kaufen.",
    territoryTitle: "Gebietsexklusivität?",
    territoryText: "Ehrliche Antwort: noch nicht. Exklusivgebiete, die vor Product-Market-Fit verkauft werden, sind Versprechen, keine Gebiete — und EU-Wettbewerbsrecht macht Exklusivitätsverträge zur Sache von Anwälten, nicht von Landingpages. Was wir stattdessen heute anbieten: Werde Regional Launch Partner — leistungsgebundener Vorrang in deiner Region, Vorkaufsrecht (Right of First Refusal), falls wir dort je Exklusivität einführen, und der volle 5-%-Override auf jeden Affiliate, den du lokal rekrutierst. Passives Einkommen aus Umsatz, den du mit aufgebaut hast — nicht aus einer Landkarte.",
    calcTitle: "Was 30 % wiederkehrend wirklich heißt",
    calcSub: "Wirb 10 Team-Kunden (290 €/Monat). Das sind 870 € jeden Monat — 10.440 € über das 12-Monats-Provisionsfenster. Aus zehn Empfehlungen.",
    calcNote: "Provisionen ab 30 % sind nur bei margenstarken Produkten tragfähig — unseres ist eines. Branchenstandard sind 20–30 %; wir starten am oberen Ende, weil frühe Partner am meisten zählen.",
    howTitle: "So funktioniert's",
    how: [
      { step: "01", title: "Bewerben & Link erhalten", desc: "Wir prüfen Bewerbungen innerhalb von 48 Stunden. Du bekommst einen getrackten Link und ein Partner-Dashboard." },
      { step: "02", title: "Ehrlich empfehlen", desc: "Teile mit Publikum, das wirklich ein Company Brain braucht. Uns sind 10 echte Fits lieber als 1.000 Klicks." },
      { step: "03", title: "Monatlich kassieren", desc: "Stripe-basierte Auszahlung jeden Monat, ab 50 €. Jede Empfehlung und ihr Status in Echtzeit sichtbar." },
    ],
    faqTitle: "Partner-FAQ",
    faq: [
      { q: "Wann beginnt und endet die Provision?", a: "Affiliate-Provisionen laufen 12 Monate pro geworbenem Kunden, ab dessen erster Zahlung. Zertifizierte Partner verdienen 20 %, solange der Kunde bleibt." },
      { q: "Was passiert bei einem Upgrade?", a: "Deine Provision folgt den tatsächlichen Zahlungen. Wirbst du einen Pro-Kunden, der auf Team upgradet, gelten deine 30 % auf den Team-Preis." },
      { q: "Kann ich Affiliate UND zertifizierter Partner sein?", a: "Ja. Viele starten als Affiliate und zertifizieren sich nach den ersten Implementierungen." },
      { q: "Gibt es Regeln gegen Selbst-Empfehlung und Coupon-Missbrauch?", a: "Selbst-Empfehlungen werden nicht ausgezahlt, und wir überwachen Missbrauch. Ehrliche Programme bleiben großzügig — das ist der Deal." },
      { q: "Wie funktioniert die Zwei-Ebenen-Struktur genau?", a: "Du verdienst 25 % auf direkt geworbene Kunden. Rekrutierst du einen weiteren Affiliate, verdienst du zusätzlich 5 % Override auf dessen geworbene Kunden — gleiches 12-Monats-Fenster pro Kunde. Eine Ebene drei gibt es bewusst nicht: Provision folgt Produktumsatz, nicht Anwerbeketten." },
      { q: "Kann ich Gebietsexklusivität bekommen?", a: "Heute nicht — siehe die ehrliche Antwort oben. Bewirb dich stattdessen als Regional Launch Partner: leistungsgebundener Regional-Vorrang, Vorkaufsrecht auf etwaige künftige Exklusivität und der 5-%-Override auf jeden Affiliate, den du in deiner Region rekrutierst." },
    ],
    ctaTitle: "Dein Publikum braucht ein Brain. Du brauchst wiederkehrenden Umsatz.",
    ctaSub: "Bewerbungen werden innerhalb von 48 Stunden geprüft.",
    ctaButton: "Jetzt bewerben",
  },
};
