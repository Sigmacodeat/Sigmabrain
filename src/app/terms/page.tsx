import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AGB / Terms of Service",
  robots: { index: false },
};

// NOTE: Legally required placeholder. A SaaS without Terms has no
// enforceable liability caps, payment terms or usage rules — have counsel
// draft the real AGB (and an order form for Enterprise) BEFORE launch.
// The section list below is the brief for that lawyer, not the contract.

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#06060f] px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-violet-400 hover:underline">← Sigmabrain</Link>
        <h1 className="text-3xl font-black text-[#e8e8f0] mt-8 mb-2">AGB / Terms of Service</h1>
        <p className="text-xs text-[#4a4a6a] mb-8">Allgemeine Geschäftsbedingungen / General Terms of Service</p>

        <div className="space-y-6 text-sm text-[#8888aa] leading-relaxed">
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs">
            PLATZHALTER — vor Launch anwaltlich erstellen lassen. Die Gliederung unten ist
            das Briefing für die Kanzlei, kein Vertragstext.
            PLACEHOLDER — have counsel draft before launch. The outline below is the
            brief for the lawyer, not the contract.
          </div>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Vorgesehene Gliederung / Intended outline</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Geltungsbereich, Vertragspartner, Vertragsschluss (B2B-only-Klausel)</li>
              <li>Leistungsbeschreibung: gehostete Pläne (Pro/Team/Enterprise), Fair-Use-Limits, Verfügbarkeit</li>
              <li>Open-Source-Engine: MIT-Lizenz bleibt unberührt; Abgrenzung Hosted-Leistung vs. Software</li>
              <li>Preise, Zahlung (Stripe), Laufzeit, Verlängerung, Kündigung, Upgrades/Downgrades</li>
              <li>Pflichten des Kunden: Zugangsdaten, zulässige Inhalte, keine Rechtsberatung durch das Produkt</li>
              <li>Datenschutz & Verschwiegenheit: AVV (Art. 28 DSGVO), Verschwiegenheitsverpflichtung
                (§ 203 Abs. 4 StGB) für Berufsgeheimnisträger, Datenexport & Löschung bei Vertragsende</li>
              <li>KI-spezifische Klauseln: kein Training mit Kundendaten, Quellenangaben sind Hilfsmittel,
                fachliche Verantwortung bleibt beim Nutzer</li>
              <li>Haftung & Haftungsbegrenzung, höhere Gewalt</li>
              <li>Partnerprogramm-Bedingungen (2-Ebenen-Provision, Auszahlung, Missbrauch) — separates Dokument, hier referenziert</li>
              <li>Schlussbestimmungen: anwendbares Recht, Gerichtsstand, Änderungen der AGB</li>
            </ol>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Kontakt / Contact</h2>
            <p>hello@sigmabrain.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
