import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz — Sigmabrain",
  robots: { index: false },
};

// HINWEIS: Gesetzlich erforderlicher Platzhalter. Vor Launch eine
// vollständige, DSGVO-konforme Datenschutzerklärung erstellen und
// anwaltlich prüfen lassen.

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#06060f] px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/de" className="text-sm text-violet-400 hover:underline">← Sigmabrain</Link>
        <h1 className="text-3xl font-black text-[#e8e8f0] mt-8 mb-2">Datenschutzerklärung</h1>
        <p className="text-xs text-[#4a4a6a] mb-8">Stand: Juni 2026</p>

        <div className="space-y-6 text-sm text-[#8888aa] leading-relaxed">
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs">
            PLATZHALTER — vor Launch eine vollständige, DSGVO-konforme Datenschutzerklärung
            erstellen und anwaltlich prüfen lassen.
          </div>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Grundsatz</h2>
            <p>
              Sigmabrain ist als datensparsames Produkt konzipiert: Self-hosted-Installationen senden
              keine Inhalte an uns. Bei gehosteten Plänen werden Inhalte ausschließlich zur Erbringung
              des Dienstes verarbeitet — niemals zum Training fremder Modelle.
            </p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Zu ergänzen vor Launch</h2>
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
