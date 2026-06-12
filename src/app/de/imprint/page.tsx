import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum — Sigmabrain",
  robots: { index: false },
};

// HINWEIS: Gesetzlich erforderlicher Platzhalter. Vor Launch mit echten
// Betreiberdaten füllen und anwaltlich prüfen lassen — ein unvollständiges
// Impressum ist abmahnfähig.

export default function ImprintPage() {
  return (
    <div className="min-h-screen bg-[#06060f] px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/de" className="text-sm text-violet-400 hover:underline">← Sigmabrain</Link>
        <h1 className="text-3xl font-black text-[#e8e8f0] mt-8 mb-2">Impressum</h1>
        <p className="text-xs text-[#4a4a6a] mb-8">Angaben gemäß § 5 DDG</p>

        <div className="space-y-6 text-sm text-[#8888aa] leading-relaxed">
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs">
            PLATZHALTER — vor Launch mit echten Betreiberdaten füllen und anwaltlich prüfen lassen.
          </div>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Betreiber</h2>
            <p>[Firmenname]<br />[Straße, Hausnummer]<br />[PLZ, Ort, Land]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Kontakt</h2>
            <p>E-Mail: hello@sigmabrain.com<br />[Telefon]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Vertretungsberechtigt</h2>
            <p>[Name der vertretungsberechtigten Person]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Registereintrag</h2>
            <p>[Handelsregister, Registernummer, Registergericht — falls vorhanden]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Umsatzsteuer-ID</h2>
            <p>[USt-IdNr. gemäß § 27a UStG — falls vorhanden]</p>
          </section>
        </div>
      </div>
    </div>
  );
}
