import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum / Imprint",
  robots: { index: false },
};

// NOTE: Legally required placeholder. Fill in real operator details and have
// counsel review BEFORE launch — an incomplete Impressum is abmahnfähig in DE.

export default function ImprintPage() {
  return (
    <div className="min-h-screen bg-[#06060f] px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-violet-400 hover:underline">← Sigmabrain</Link>
        <h1 className="text-3xl font-black text-[#e8e8f0] mt-8 mb-2">Impressum</h1>
        <p className="text-xs text-[#4a4a6a] mb-8">Angaben gemäß § 5 DDG / Information pursuant to § 5 DDG</p>

        <div className="space-y-6 text-sm text-[#8888aa] leading-relaxed">
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs">
            PLATZHALTER — vor Launch mit echten Betreiberdaten füllen und anwaltlich prüfen lassen.
            PLACEHOLDER — fill in real operator details and have counsel review before launch.
          </div>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Betreiber / Operator</h2>
            <p>[Firmenname / Company name]<br />[Straße, Hausnummer]<br />[PLZ, Ort, Land]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Kontakt / Contact</h2>
            <p>E-Mail: hello@sigmabrain.com<br />[Telefon / Phone]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Vertretungsberechtigt / Represented by</h2>
            <p>[Name der vertretungsberechtigten Person]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Registereintrag / Register entry</h2>
            <p>[Handelsregister, Registernummer, Registergericht — falls vorhanden]</p>
          </section>
          <section>
            <h2 className="text-[#e8e8f0] font-semibold mb-2">Umsatzsteuer-ID / VAT ID</h2>
            <p>[USt-IdNr. gemäß § 27a UStG — falls vorhanden]</p>
          </section>
        </div>
      </div>
    </div>
  );
}
