import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz / Privacy",
  robots: { index: false },
};

// NOTE: Legally required placeholder. A real GDPR-compliant privacy policy must
// be drafted (processors, legal bases, retention, rights) and reviewed by
// counsel BEFORE launch.

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#06060f] px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-violet-400 hover:underline">← Sigmabrain</Link>
        <h1 className="text-3xl font-black text-[#e8e8f0] mt-8 mb-2">Datenschutzerklärung / Privacy Policy</h1>
        <p className="text-xs text-[#4a4a6a] mb-8">Stand / Last updated: Juni 2026</p>

        <div className="space-y-6 text-sm text-[#8888aa] leading-relaxed">
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs">
            PLATZHALTER — vor Launch eine vollständige, DSGVO-konforme Datenschutzerklärung
            erstellen und anwaltlich prüfen lassen. PLACEHOLDER — a complete GDPR-compliant
            privacy policy must be drafted and reviewed by counsel before launch.
          </div>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Grundsatz / Principle</h2>
            <p>
              Sigmabrain ist als datensparsames Produkt konzipiert: Self-hosted-Installationen senden
              keine Inhalte an uns. Bei gehosteten Plänen werden Inhalte ausschließlich zur Erbringung
              des Dienstes verarbeitet — niemals zum Training fremder Modelle.
            </p>
            <p className="mt-2">
              Sigmabrain is designed as a data-minimal product: self-hosted installations send no
              content to us. On hosted plans, content is processed exclusively to provide the
              service — never to train third-party models.
            </p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Zu ergänzen vor Launch / To complete before launch</h2>
            <p>
              Verantwortlicher, Auftragsverarbeiter (Hosting, LLM-Anbieter, Zahlungsdienstleister,
              Affiliate-Tracking), Rechtsgrundlagen, Speicherdauern, Betroffenenrechte,
              Cookies/Tracking, internationale Datentransfers, Kontakt des Datenschutzbeauftragten.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
